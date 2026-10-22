import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import type { BomLine, Product, TechnicalRevision, TechnicalSheetSummary } from '../domain/types'

function normalizeRevision(id: string, data: Record<string, unknown>): TechnicalRevision {
  const raw = data as unknown as TechnicalRevision
  return {
    ...raw,
    id,
    construcao: raw.construcao ?? '',
    blocos: raw.blocos ?? { bom: true, medidas: false, checklist: false },
    bom: Array.isArray(raw.bom) ? raw.bom : [],
    tamanhos: Array.isArray(raw.tamanhos) ? raw.tamanhos : [],
    medidas: Array.isArray(raw.medidas) ? raw.medidas : [],
    checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
    operacoes: Array.isArray(raw.operacoes) ? raw.operacoes : [],
    imagens: Array.isArray(raw.imagens) ? raw.imagens : [],
  }
}

function revisionId(numero: number) {
  return String(numero).padStart(3, '0')
}

function revisionRef(empresaId: string, produtoCodigo: string, numero: number) {
  return doc(db, 'empresas', empresaId, 'produtos', produtoCodigo, 'revisoes', revisionId(numero))
}

function summaryRef(empresaId: string, produtoCodigo: string) {
  return doc(db, 'empresas', empresaId, 'fichas', produtoCodigo)
}

export async function getTechnicalRevision(
  empresaId: string,
  produtoCodigo: string,
  numero: number,
) {
  const snap = await getDoc(revisionRef(empresaId, produtoCodigo, numero))
  if (!snap.exists()) return null
  return normalizeRevision(snap.id, snap.data())
}

export async function listTechnicalRevisions(
  empresaId: string,
  produtoCodigo: string,
) {
  const ref = collection(db, 'empresas', empresaId, 'produtos', produtoCodigo, 'revisoes')
  const snap = await getDocs(query(ref, orderBy('numero', 'desc')))
  return snap.docs.map((item) => normalizeRevision(item.id, item.data()))
}

export async function openOrCreateTechnicalDraft(
  empresaId: string,
  uid: string,
  product: Product,
) {
  const productRef = doc(db, 'empresas', empresaId, 'produtos', product.codigo)
  const sumRef = summaryRef(empresaId, product.codigo)

  return runTransaction(db, async (transaction) => {
    const [productSnap, summarySnap] = await Promise.all([
      transaction.get(productRef),
      transaction.get(sumRef),
    ])

    if (!productSnap.exists()) throw new Error('Produto não encontrado.')

    const productData = productSnap.data()
    const summary = summarySnap.exists() ? summarySnap.data() as TechnicalSheetSummary : null

    if (summary?.revisaoRascunho) {
      const draftRef = revisionRef(empresaId, product.codigo, summary.revisaoRascunho)
      const draftSnap = await transaction.get(draftRef)
      if (draftSnap.exists()) return normalizeRevision(draftSnap.id, draftSnap.data())
    }

    const currentRevision = Number(productData.revisaoVigente ?? 0)
    const lastRevision = Number(productData.ultimaRevisao ?? currentRevision ?? 0)
    const next = lastRevision + 1

    let base: TechnicalRevision | null = null
    if (currentRevision > 0) {
      const baseSnap = await transaction.get(revisionRef(empresaId, product.codigo, currentRevision))
      if (baseSnap.exists()) base = normalizeRevision(baseSnap.id, baseSnap.data())
    }

    const draft: Omit<TechnicalRevision, 'id'> = {
      numero: next,
      status: 'rascunho',
      produtoCodigo: product.codigo,
      produtoDescricao: product.descricao,
      motivoRevisao: next > 1 ? '' : undefined,
      construcao: base?.construcao ?? '',
      blocos: base?.blocos ?? { bom: true, medidas: false, checklist: false },
      bom: base?.bom?.map((line) => ({ ...line, id: crypto.randomUUID() })) ?? [],
      tamanhos: base?.tamanhos ?? [],
      medidas: base?.medidas ?? [],
      checklist: base?.checklist?.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })) ?? [],
      operacoes: base?.operacoes?.map((operation, index) => ({
        ...operation,
        id: crypto.randomUUID(),
        ordem: index + 1,
        midias: (operation.midias ?? []).map((media) => ({
          ...media,
          id: crypto.randomUUID(),
          path: undefined,
        })),
      })) ?? [],
      imagens: base?.imagens?.map((image) => ({
        ...image,
        path: undefined,
      })) ?? [],
    }

    const draftRef = revisionRef(empresaId, product.codigo, next)
    transaction.set(draftRef, {
      ...draft,
      criadoEm: serverTimestamp(),
      criadoPor: uid,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(sumRef, {
      produtoCodigo: product.codigo,
      produtoDescricao: product.descricao,
      revisaoVigente: currentRevision || null,
      revisaoRascunho: next,
      status: 'rascunho',
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    }, { merge: true })

    transaction.update(productRef, {
      ultimaRevisao: next,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    return { id: revisionId(next), ...draft } as TechnicalRevision
  })
}

export async function saveTechnicalDraft(
  empresaId: string,
  uid: string,
  revision: TechnicalRevision,
) {
  const ref = revisionRef(empresaId, revision.produtoCodigo, revision.numero)
  const sumRef = summaryRef(empresaId, revision.produtoCodigo)

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) throw new Error('Revisão não encontrada.')
    const currentStatus = String(snap.data().status)
    if (['padrao', 'obsoleta'].includes(currentStatus)) {
      throw new Error('Uma revisão publicada não pode ser alterada. Crie uma nova revisão.')
    }

    transaction.update(ref, {
      motivoRevisao: revision.motivoRevisao ?? '',
      construcao: revision.construcao,
      blocos: revision.blocos,
      bom: revision.bom,
      tamanhos: revision.tamanhos,
      medidas: revision.medidas,
      checklist: revision.checklist,
      operacoes: revision.operacoes,
      imagens: revision.imagens,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })
    transaction.update(sumRef, {
      status: currentStatus,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })
  })
}

export async function submitTechnicalRevision(
  empresaId: string,
  uid: string,
  revision: TechnicalRevision,
) {
  if (!revision.construcao.trim()) throw new Error('Descreva a construção/processo antes de enviar.')
  if (revision.blocos.bom && revision.bom.length === 0) {
    throw new Error('Adicione ao menos um item na BOM.')
  }
  if (revision.blocos.checklist && revision.checklist.length === 0) {
    throw new Error('Adicione ao menos um item ao checklist técnico.')
  }
  if (revision.operacoes.length === 0) {
    throw new Error('Adicione ao menos uma operação à sequência operacional.')
  }
  if (revision.operacoes.some((operation) => !operation.nome.trim() || !operation.descricao.trim())) {
    throw new Error('Preencha nome e instrução principal de todas as operações.')
  }
  if (
    revision.blocos.checklist
    && revision.checklist.some((item) => !item.descricao.trim())
  ) {
    throw new Error('Preencha a descrição de todos os itens do checklist.')
  }

  if (revision.blocos.medidas) {
    if (revision.tamanhos.length === 0) {
      throw new Error('Defina ao menos um tamanho/variante para a tabela de medidas.')
    }
    if (revision.medidas.length === 0) {
      throw new Error('Adicione ao menos um ponto de medida.')
    }
    const incomplete = revision.medidas.some((row) =>
      revision.tamanhos.some((size) => {
        const value = row.valores.find((item) => item.tamanho === size)
        return value?.valor == null || !Number.isFinite(Number(value.valor))
      }),
    )
    if (incomplete) {
      throw new Error('Preencha todos os valores da tabela de medidas antes de enviar.')
    }
  }

  const ref = revisionRef(empresaId, revision.produtoCodigo, revision.numero)
  const sumRef = summaryRef(empresaId, revision.produtoCodigo)
  const batch = writeBatch(db)
  batch.update(ref, {
    status: 'em_validacao',
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
  batch.update(sumRef, {
    status: 'em_validacao',
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
  await batch.commit()
}

export async function returnTechnicalRevisionToDraft(
  empresaId: string,
  uid: string,
  revision: TechnicalRevision,
) {
  const ref = revisionRef(empresaId, revision.produtoCodigo, revision.numero)
  const sumRef = summaryRef(empresaId, revision.produtoCodigo)
  const batch = writeBatch(db)
  batch.update(ref, {
    status: 'rascunho',
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
  batch.update(sumRef, {
    status: 'rascunho',
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
  await batch.commit()
}

export async function publishTechnicalRevision(
  empresaId: string,
  uid: string,
  revision: TechnicalRevision,
) {
  const productRef = doc(db, 'empresas', empresaId, 'produtos', revision.produtoCodigo)
  const sumRef = summaryRef(empresaId, revision.produtoCodigo)
  const currentRef = revisionRef(empresaId, revision.produtoCodigo, revision.numero)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const [productSnap, currentSnap] = await Promise.all([
      transaction.get(productRef),
      transaction.get(currentRef),
    ])

    if (!productSnap.exists() || !currentSnap.exists()) {
      throw new Error('Produto ou revisão não encontrado.')
    }

    const currentRevision = normalizeRevision(currentSnap.id, currentSnap.data())
    if (currentRevision.status !== 'em_validacao') {
      throw new Error('A revisão precisa estar em validação antes de ser publicada.')
    }

    const previous = Number(productSnap.data().revisaoVigente ?? 0)
    let previousRevision: TechnicalRevision | null = null
    let previousRef: ReturnType<typeof revisionRef> | null = null

    if (previous > 0 && previous !== revision.numero) {
      previousRef = revisionRef(empresaId, revision.produtoCodigo, previous)
      const previousSnap = await transaction.get(previousRef)
      if (previousSnap.exists()) {
        previousRevision = normalizeRevision(previousSnap.id, previousSnap.data())
      }
    }

    const previousMaterials = new Set(
      (previousRevision?.bom ?? []).map((line) => line.materialId),
    )
    const currentMaterials = new Set(
      (currentRevision.bom ?? []).map((line) => line.materialId),
    )

    if (previousRef && previousRevision) {
      transaction.update(previousRef, {
        status: 'obsoleta',
        alteradoEm: serverTimestamp(),
        alteradoPor: uid,
      })
    }

    transaction.update(currentRef, {
      status: 'padrao',
      aprovadoPor: uid,
      aprovadoEm: serverTimestamp(),
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.update(productRef, {
      revisaoVigente: revision.numero,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(sumRef, {
      produtoCodigo: currentRevision.produtoCodigo,
      produtoDescricao: currentRevision.produtoDescricao,
      revisaoVigente: currentRevision.numero,
      revisaoRascunho: null,
      status: 'padrao',
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    }, { merge: true })

    for (const materialId of previousMaterials) {
      if (currentMaterials.has(materialId)) continue
      const usageRef = doc(
        db,
        'empresas',
        empresaId,
        'usoMateriais',
        materialId,
        'produtos',
        currentRevision.produtoCodigo,
      )
      transaction.set(usageRef, {
        materialId,
        produtoCodigo: currentRevision.produtoCodigo,
        produtoDescricao: currentRevision.produtoDescricao,
        revisao: currentRevision.numero,
        ativo: false,
        alteradoEm: serverTimestamp(),
        alteradoPor: uid,
      }, { merge: true })
    }

    for (const materialId of currentMaterials) {
      const usageRef = doc(
        db,
        'empresas',
        empresaId,
        'usoMateriais',
        materialId,
        'produtos',
        currentRevision.produtoCodigo,
      )
      transaction.set(usageRef, {
        materialId,
        produtoCodigo: currentRevision.produtoCodigo,
        produtoDescricao: currentRevision.produtoDescricao,
        revisao: currentRevision.numero,
        ativo: true,
        alteradoEm: serverTimestamp(),
        alteradoPor: uid,
      }, { merge: true })
    }

    transaction.set(auditRef, {
      entidade: 'ficha_tecnica',
      entidadeId: currentRevision.produtoCodigo,
      acao: 'revisao_publicada',
      resumo: `${currentRevision.produtoCodigo} · REV ${String(currentRevision.numero).padStart(2, '0')}`,
      uid,
      em: serverTimestamp(),
    })
  })
}

export function createBomLine(material: {
  id: string
  codigo: string
  descricao: string
  unidade: string
  fornecedores: Array<string | {
    fornecedorId: string
    nomeSnapshot: string
    principal: boolean
    referenciaFornecedor?: string
  }>
}): BomLine {
  const principal = material.fornecedores.find((item) => typeof item !== 'string' && item.principal)
  return {
    id: crypto.randomUUID(),
    materialId: material.id,
    codigoSnapshot: material.codigo,
    descricaoSnapshot: material.descricao,
    fornecedorId: typeof principal === 'object' ? principal.fornecedorId : undefined,
    fornecedorSnapshot: typeof principal === 'object' ? principal.nomeSnapshot : typeof material.fornecedores[0] === 'string' ? material.fornecedores[0] : undefined,
    referenciaFornecedorSnapshot: typeof principal === 'object' ? principal.referenciaFornecedor : undefined,
    corRegra: 'nao_aplica',
    consumo: 1,
    consumoPorTamanho: {},
    unidade: material.unidade,
    perdaPercentual: 0,
    observacao: '',
  }
}

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import type {
  FrozenKitLine,
  ProductionOperationTask,
  ProductionVariant,
  TechnicalOperation,
} from '../domain/types'

export type SimulationPackage = {
  schemaVersion: 1
  tipo: 'processo-facil-simulacao'
  id: string
  nome: string
  descricao?: string
  produto: {
    codigo: string
    descricao: string
    classificacoes?: Record<string, string>
  }
  materiais: Array<{
    codigo: string
    descricao: string
    categoria: string
    unidade: string
    fornecedor?: string
    referenciaFornecedor?: string
  }>
  ficha: {
    construcao: string
    cliente?: string
    colecao?: string
    familia?: string
    modelo?: string
    responsavelTecnico?: string
    dadosTecido?: {
      tecidoPrincipal: string
      composicao: string
      gramatura: string
      largura: string
      fornecedor: string
      cor: string
      encolhimentoMaximo: string
      solidezCor: string
    }
    processoCorte?: {
      encaixe: string
      consumoTecido: string
      comprimentoRisco: string
      alturaEnfesto: string
      numeroFolhas: string
      perdasPercentual: string
    }
    agulhasLinhas?: Array<{ maquina: string; agulha: string; linha: string }>
    controleQualidade?: { pontosCriticos: string[]; defeitosNaoAceitos: string[] }
    dnaProduto?: {
      tempoPadraoMin?: number
      maquinaPrincipal?: string
      nivelDificuldade?: 'facil' | 'medio' | 'dificil'
      principaisErros?: string[]
    }
    anexos?: Array<{
      tipo: 'molde' | 'encaixe' | 'desenho' | 'pop' | 'video' | 'relatorio_medidas' | 'aprovacao_cliente' | 'outro'
      nome: string
      url: string
    }>
    tamanhos: string[]
    imagens?: Array<{ url: string; legenda: string }>
    bom: Array<{
      materialCodigo: string
      consumo: number
      consumoPorTamanho?: Record<string, number>
      perdaPercentual?: number
      corRegra?: 'produto' | 'fixa' | 'nao_aplica'
      corFixa?: string
      observacao?: string
    }>
    medidas?: Array<{
      ponto: string
      tolerancia: number
      valores: Record<string, number>
    }>
    checklist?: string[]
    operacoes: Array<{
      codigo: string
      nome: string
      descricao: string
      maquina?: string
      regulagem?: string
      ferramenta?: string
      tempoPadraoMin?: number
      dificuldade?: 'facil' | 'medio' | 'dificil'
      pontosCriticos?: string[]
      instrucoes?: string[]
      midias?: Array<{
        tipo: 'imagem' | 'video'
        url: string
        legenda?: string
      }>
    }>
  }
  op: {
    numero: string
    prazo?: string
    cor?: string
    variantes: Array<{ nome: string; quantidade: number }>
  }
}

export type SimulationImportResult = {
  orderId: string
  orderNumber: string
  productCode: string
  operations: number
  materials: number
  alreadyExists: boolean
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function validatePackage(pkg: unknown): asserts pkg is SimulationPackage {
  if (!pkg || typeof pkg !== 'object') throw new Error('Arquivo inválido.')
  const data = pkg as Partial<SimulationPackage>
  if (data.schemaVersion !== 1 || data.tipo !== 'processo-facil-simulacao') {
    throw new Error('Este arquivo não é um Pacote de Simulação compatível.')
  }
  if (!data.id?.trim() || !data.nome?.trim()) throw new Error('O pacote não possui identificação.')
  if (!data.produto?.codigo?.trim() || !data.produto?.descricao?.trim()) {
    throw new Error('Produto do cenário inválido.')
  }
  if (!Array.isArray(data.materiais) || data.materiais.length === 0) {
    throw new Error('O cenário precisa ter materiais.')
  }
  if (!data.ficha?.construcao?.trim() || !Array.isArray(data.ficha?.operacoes) || data.ficha.operacoes.length === 0) {
    throw new Error('A Ficha Técnica do cenário está incompleta.')
  }
  if (!Array.isArray(data.op?.variantes) || data.op.variantes.length === 0) {
    throw new Error('A OP do cenário precisa ter ao menos uma variante.')
  }
}

function materialDocId(packageId: string, code: string) {
  return `sim-${slug(packageId)}-${slug(code)}`.slice(0, 120)
}

export async function importSimulationPackage(
  empresaId: string,
  uid: string,
  raw: unknown,
): Promise<SimulationImportResult> {
  validatePackage(raw)
  const pkg = raw
  const productCode = pkg.produto.codigo.trim().toUpperCase()
  const orderId = `sim-${slug(pkg.id)}`
  const productRef = doc(db, 'empresas', empresaId, 'produtos', productCode)
  const existingProduct = await getDoc(productRef)

  if (existingProduct.exists()) {
    return {
      orderId,
      orderNumber: pkg.op.numero,
      productCode,
      operations: pkg.ficha.operacoes.length,
      materials: pkg.materiais.length,
      alreadyExists: true,
    }
  }

  const batch = writeBatch(db)
  const now = serverTimestamp()
  const timestamp = Timestamp.now()

  const materialMap = new Map<string, {
    id: string
    codigo: string
    descricao: string
    unidade: string
    fornecedor?: string
  }>()

  for (const material of pkg.materiais) {
    const codigo = material.codigo.trim().toUpperCase()
    const id = materialDocId(pkg.id, codigo)
    materialMap.set(codigo, {
      id,
      codigo,
      descricao: material.descricao.trim(),
      unidade: material.unidade.trim(),
      fornecedor: material.fornecedor?.trim(),
    })

    batch.set(doc(db, 'empresas', empresaId, 'materiais', id), {
      codigo,
      codigoLegado: '',
      descricao: material.descricao.trim(),
      descricaoNormalizada: material.descricao.trim().toUpperCase(),
      categoriaId: '',
      categoria: material.categoria.trim(),
      unidade: material.unidade.trim(),
      fornecedores: material.fornecedor
        ? [{
            fornecedorId: `sim-${slug(material.fornecedor)}`,
            nomeSnapshot: material.fornecedor.trim(),
            principal: true,
            referenciaFornecedor: material.referenciaFornecedor?.trim() ?? '',
          }]
        : [],
      custoUnitario: null,
      leadTimeDias: null,
      loteMinimo: null,
      observacao: `Criado pelo simulador: ${pkg.nome}`,
      buscaNormalizada: [codigo, material.descricao, material.categoria, material.fornecedor]
        .filter(Boolean)
        .join(' ')
        .toUpperCase(),
      ativo: true,
      simulacaoId: pkg.id,
      criadoEm: now,
      criadoPor: uid,
      alteradoEm: now,
      alteradoPor: uid,
    })
  }

  const bom = pkg.ficha.bom.map((line) => {
    const material = materialMap.get(line.materialCodigo.trim().toUpperCase())
    if (!material) throw new Error(`Material ${line.materialCodigo} da BOM não existe no pacote.`)
    return {
      id: crypto.randomUUID(),
      materialId: material.id,
      codigoSnapshot: material.codigo,
      descricaoSnapshot: material.descricao,
      fornecedorSnapshot: material.fornecedor ?? '',
      corRegra: line.corRegra ?? 'nao_aplica',
      corFixa: line.corFixa?.trim() ?? '',
      consumo: Number(line.consumo),
      consumoPorTamanho: line.consumoPorTamanho ?? {},
      unidade: material.unidade,
      perdaPercentual: Number(line.perdaPercentual ?? 0),
      observacao: line.observacao?.trim() ?? '',
    }
  })

  const operations: TechnicalOperation[] = pkg.ficha.operacoes.map((operation, index) => ({
    id: `sim-op-${index + 1}`,
    ordem: index + 1,
    codigo: operation.codigo.trim() || String((index + 1) * 10),
    nome: operation.nome.trim(),
    descricao: operation.descricao.trim(),
    maquina: operation.maquina?.trim() ?? '',
    regulagem: operation.regulagem?.trim() ?? '',
    ferramenta: operation.ferramenta?.trim() ?? '',
    tempoPadraoMin: operation.tempoPadraoMin == null ? null : Number(operation.tempoPadraoMin),
    dificuldade: operation.dificuldade ?? 'medio',
    pontosCriticos: (operation.pontosCriticos ?? []).map((item) => item.trim()).filter(Boolean),
    instrucoes: (operation.instrucoes ?? []).map((item) => item.trim()).filter(Boolean),
    midias: (operation.midias ?? []).map((media, mediaIndex) => ({
      id: `sim-media-${index + 1}-${mediaIndex + 1}`,
      tipo: media.tipo,
      url: media.url,
      legenda: media.legenda?.trim() ?? '',
      ordem: mediaIndex + 1,
    })),
  }))

  const revision = {
    numero: 1,
    status: 'padrao',
    produtoCodigo: productCode,
    produtoDescricao: pkg.produto.descricao.trim(),
    construcao: pkg.ficha.construcao.trim(),
    cliente: pkg.ficha.cliente?.trim() ?? '',
    colecao: pkg.ficha.colecao?.trim() ?? '',
    familia: pkg.ficha.familia?.trim() ?? pkg.produto.classificacoes?.familia ?? '',
    modelo: pkg.ficha.modelo?.trim() ?? pkg.produto.classificacoes?.modelo ?? '',
    responsavelTecnico: pkg.ficha.responsavelTecnico?.trim() ?? '',
    dadosTecido: pkg.ficha.dadosTecido ?? {
      tecidoPrincipal: '', composicao: '', gramatura: '', largura: '', fornecedor: '',
      cor: pkg.op.cor?.trim() ?? '', encolhimentoMaximo: '', solidezCor: '',
    },
    processoCorte: pkg.ficha.processoCorte ?? {
      encaixe: '', consumoTecido: '', comprimentoRisco: '', alturaEnfesto: '',
      numeroFolhas: '', perdasPercentual: '',
    },
    agulhasLinhas: (pkg.ficha.agulhasLinhas ?? []).map((item) => ({
      id: crypto.randomUUID(), ...item,
    })),
    controleQualidade: pkg.ficha.controleQualidade ?? { pontosCriticos: [], defeitosNaoAceitos: [] },
    anexos: (pkg.ficha.anexos ?? []).map((item) => ({ id: crypto.randomUUID(), ...item })),
    dnaProduto: {
      tempoPadraoMin: pkg.ficha.dnaProduto?.tempoPadraoMin ?? null,
      maquinaPrincipal: pkg.ficha.dnaProduto?.maquinaPrincipal ?? '',
      nivelDificuldade: pkg.ficha.dnaProduto?.nivelDificuldade ?? '',
      principaisErros: pkg.ficha.dnaProduto?.principaisErros ?? [],
    },
    motivoRevisao: 'Revisão inicial criada pelo simulador',
    blocos: {
      bom: true,
      medidas: (pkg.ficha.medidas ?? []).length > 0,
      checklist: (pkg.ficha.checklist ?? []).length > 0,
    },
    bom,
    tamanhos: pkg.ficha.tamanhos ?? [],
    medidas: (pkg.ficha.medidas ?? []).map((row, index) => ({
      id: `sim-med-${index + 1}`,
      ponto: row.ponto.trim(),
      tolerancia: Number(row.tolerancia ?? 0),
      valores: Object.entries(row.valores ?? {}).map(([tamanho, valor]) => ({
        tamanho,
        valor: Number(valor),
      })),
    })),
    checklist: (pkg.ficha.checklist ?? []).map((descricao, index) => ({
      id: `sim-check-${index + 1}`,
      descricao: descricao.trim(),
      obrigatorio: true,
    })),
    operacoes: operations,
    imagens: (pkg.ficha.imagens ?? []).map((image, index) => ({
      url: image.url,
      legenda: image.legenda ?? '',
      ordem: index + 1,
    })),
    aprovadoPor: uid,
    aprovadoEm: timestamp,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
    simulacaoId: pkg.id,
  }

  batch.set(productRef, {
    codigo: productCode,
    descricao: pkg.produto.descricao.trim(),
    descricaoNormalizada: pkg.produto.descricao.trim().toUpperCase(),
    classificacoes: pkg.produto.classificacoes ?? {},
    revisaoVigente: 1,
    ultimaRevisao: 1,
    status: 'ativo',
    ativo: true,
    simulacaoId: pkg.id,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })

  batch.set(doc(db, 'empresas', empresaId, 'produtos', productCode, 'revisoes', '001'), revision)

  batch.set(doc(db, 'empresas', empresaId, 'fichas', productCode), {
    produtoCodigo: productCode,
    produtoDescricao: pkg.produto.descricao.trim(),
    revisaoVigente: 1,
    revisaoRascunho: null,
    status: 'padrao',
    simulacaoId: pkg.id,
    alteradoEm: now,
    alteradoPor: uid,
  })

  const variants: ProductionVariant[] = pkg.op.variantes.map((variant, index) => ({
    id: `sim-var-${index + 1}`,
    nome: variant.nome.trim(),
    quantidade: Number(variant.quantidade),
  }))
  const quantidadeTotal = variants.reduce((sum, item) => sum + item.quantidade, 0)

  const itemId = 'sim-item-1'
  const frozenOperations: ProductionOperationTask[] = operations.map((operation, index) => ({
    id: `sim-task-${index + 1}`,
    itemId,
    produtoCodigo: productCode,
    produtoDescricao: pkg.produto.descricao.trim(),
    revisao: 1,
    cor: pkg.op.cor?.trim() ?? '',
    operacao: {
      ...operation,
      midias: operation.midias.map((media) => ({ ...media })),
      instrucoes: [...operation.instrucoes],
      pontosCriticos: [...operation.pontosCriticos],
    },
    status: 'pendente',
  }))

  const kitMap = new Map<string, FrozenKitLine>()
  for (const line of bom) {
    const hasVariable = line.consumoPorTamanho && Object.keys(line.consumoPorTamanho).length > 0
    const baseRequired = hasVariable
      ? variants.reduce((sum, variant) => {
          const consumo = Number(line.consumoPorTamanho?.[variant.nome] ?? line.consumo)
          return sum + consumo * variant.quantidade
        }, 0)
      : line.consumo * quantidadeTotal
    const quantity = baseRequired * (1 + line.perdaPercentual / 100)
    const resolvedColor = line.corRegra === 'produto'
      ? (pkg.op.cor?.trim() ?? '')
      : line.corRegra === 'fixa'
        ? line.corFixa
        : ''
    const key = [line.materialId, line.unidade, resolvedColor].join('|')
    const current = kitMap.get(key)
    if (current) {
      current.quantidadeNecessaria += quantity
    } else {
      kitMap.set(key, {
        id: crypto.randomUUID(),
        materialId: line.materialId,
        codigoSnapshot: line.codigoSnapshot,
        descricaoSnapshot: line.descricaoSnapshot,
        fornecedorSnapshot: line.fornecedorSnapshot,
        unidade: line.unidade,
        quantidadeNecessaria: quantity,
        corRegra: line.corRegra,
        corFixa: resolvedColor || line.corFixa,
      })
    }
  }

  batch.set(doc(db, 'empresas', empresaId, 'ordensProducao', orderId), {
    numero: pkg.op.numero,
    prazo: pkg.op.prazo ?? '',
    status: 'em_fluxo',
    workflowStageId: null,
    itens: [{
      id: itemId,
      produtoCodigo: productCode,
      produtoDescricao: pkg.produto.descricao.trim(),
      revisao: 1,
      cor: pkg.op.cor?.trim() ?? '',
      variantes: variants,
      quantidadeTotal,
    }],
    kit: Array.from(kitMap.values()),
    operacoes: frozenOperations,
    historico: [{
      id: crypto.randomUUID(),
      acao: 'Cenário de simulação importado e OP liberada',
      uid,
      em: timestamp,
    }],
    simulacaoId: pkg.id,
    criadoEm: now,
    criadoPor: uid,
    liberadaEm: now,
    liberadaPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })

  batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
    entidade: 'simulacao',
    entidadeId: pkg.id,
    acao: 'importada',
    resumo: `${pkg.nome} · ${productCode} · ${pkg.op.numero}`,
    uid,
    em: now,
  })

  await batch.commit()

  return {
    orderId,
    orderNumber: pkg.op.numero,
    productCode,
    operations: operations.length,
    materials: pkg.materiais.length,
    alreadyExists: false,
  }
}


export async function importDemoTechnicalPiece(
  empresaId: string,
  uid: string,
  raw: unknown,
): Promise<SimulationImportResult> {
  validatePackage(raw)
  const pkg = raw
  const imported = await importSimulationPackage(empresaId, uid, pkg)

  const productCode = pkg.produto.codigo.trim().toUpperCase()
  const orderId = `sim-${slug(pkg.id)}`
  const batch = writeBatch(db)

  batch.set(doc(db, 'empresas', empresaId, 'produtos', productCode), {
    revisaoVigente: null,
    ultimaRevisao: 1,
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  }, { merge: true })

  batch.set(doc(db, 'empresas', empresaId, 'produtos', productCode, 'revisoes', '001'), {
    status: 'rascunho',
    aprovadoPor: '',
    aprovadoEm: null,
    motivoRevisao: 'Peça demonstrativa pronta para receber imagens e ajustes finais',
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  }, { merge: true })

  batch.set(doc(db, 'empresas', empresaId, 'fichas', productCode), {
    produtoCodigo: productCode,
    produtoDescricao: pkg.produto.descricao.trim(),
    revisaoVigente: null,
    revisaoRascunho: 1,
    status: 'rascunho',
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  }, { merge: true })

  batch.delete(doc(db, 'empresas', empresaId, 'ordensProducao', orderId))

  batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
    entidade: 'ficha_tecnica',
    entidadeId: productCode,
    acao: 'demo_tecnica_criada',
    resumo: `${pkg.produto.descricao.trim()} · REV 01 em rascunho`,
    uid,
    em: serverTimestamp(),
  })

  await batch.commit()

  return {
    ...imported,
    orderId: '',
    orderNumber: '',
    alreadyExists: imported.alreadyExists,
  }
}

export async function resetSimulationJourney(
  empresaId: string,
  uid: string,
  packageId: string,
) {
  const orderId = `sim-${slug(packageId)}`
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const snap = await getDoc(orderRef)
  if (!snap.exists()) throw new Error('A OP de simulação ainda não foi importada.')

  const data = snap.data() as {
    numero: string
    operacoes?: ProductionOperationTask[]
    historico?: unknown[]
  }

  const batch = writeBatch(db)
  batch.update(orderRef, {
    status: 'em_fluxo',
    workflowStageId: null,
    operacoes: (data.operacoes ?? []).map((task) => ({
      ...task,
      status: 'pendente',
      iniciadoEm: null,
      concluidoEm: null,
      operadorUid: '',
      observacao: '',
    })),
    historico: [{
      id: crypto.randomUUID(),
      acao: 'Trajeto da simulação reiniciado',
      uid,
      em: Timestamp.now(),
    }],
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
  batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
    entidade: 'simulacao',
    entidadeId: packageId,
    acao: 'reiniciada',
    resumo: data.numero,
    uid,
    em: serverTimestamp(),
  })
  await batch.commit()
}

export function parseSimulationFile(text: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('O arquivo JSON está inválido.')
  }
  validatePackage(parsed)
  return parsed
}

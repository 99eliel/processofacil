import {
  Timestamp,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import type {
  BomLine,
  FrozenKitLine,
  ProductionOperationTask,
  ProductionOrderItemRecord,
  ProductionOrderRecord,
  ProductionVariant,
  TechnicalRevision,
} from '../domain/types'

export type NewOrderItem = {
  produtoCodigo: string
  produtoDescricao: string
  cor?: string
  variantes: ProductionVariant[]
}

function totalVariants(variants: ProductionVariant[]) {
  return variants.reduce((sum, item) => sum + Number(item.quantidade || 0), 0)
}

export async function createProductionOrder(
  empresaId: string,
  uid: string,
  input: { prazo?: string; itens: NewOrderItem[] },
) {
  const orderRef = doc(collection(db, 'empresas', empresaId, 'ordensProducao'))
  const counterRef = doc(db, 'empresas', empresaId, 'contadores', 'ordensProducao')
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  return runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef)
    const next = Number(counterSnap.data()?.ultimo ?? 0) + 1
    const numero = `OP-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`

    const itens: ProductionOrderItemRecord[] = input.itens.map((item) => ({
      id: crypto.randomUUID(),
      produtoCodigo: item.produtoCodigo,
      produtoDescricao: item.produtoDescricao,
      revisao: null,
      cor: item.cor?.trim() ?? '',
      variantes: item.variantes,
      quantidadeTotal: totalVariants(item.variantes),
    }))

    if (itens.length === 0 || itens.some((item) => item.quantidadeTotal <= 0)) {
      throw new Error('A OP precisa ter ao menos um item com quantidade maior que zero.')
    }

    const history = [{
      id: crypto.randomUUID(),
      acao: 'OP criada',
      uid,
      em: Timestamp.now(),
    }]

    transaction.set(counterRef, { ultimo: next, alteradoEm: serverTimestamp() }, { merge: true })
    transaction.set(orderRef, {
      numero,
      prazo: input.prazo ?? '',
      status: 'rascunho',
      workflowStageId: null,
      itens,
      kit: [],
      operacoes: [],
      historico: history,
      criadoEm: serverTimestamp(),
      criadoPor: uid,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })
    transaction.set(auditRef, {
      entidade: 'ordem_producao',
      entidadeId: orderRef.id,
      acao: 'criada',
      resumo: numero,
      uid,
      em: serverTimestamp(),
    })

    return { id: orderRef.id, numero }
  })
}

function kitKey(line: BomLine, resolvedColor: string) {
  return [
    line.materialId,
    line.unidade,
    resolvedColor || line.corRegra,
  ].join('|')
}

export async function releaseProductionOrder(
  empresaId: string,
  uid: string,
  orderId: string,
  firstWorkflowStageId?: string | null,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  return runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Ordem de Produção não encontrada.')
    const order = { id: orderSnap.id, ...orderSnap.data() } as ProductionOrderRecord
    if (order.status !== 'rascunho') throw new Error('Somente OP em rascunho pode ser liberada.')

    const frozenItems: ProductionOrderItemRecord[] = []
    const frozenOperations: ProductionOperationTask[] = []
    const kitMap = new Map<string, FrozenKitLine>()

    for (const item of order.itens) {
      const productRef = doc(db, 'empresas', empresaId, 'produtos', item.produtoCodigo)
      const productSnap = await transaction.get(productRef)
      if (!productSnap.exists()) throw new Error(`Produto ${item.produtoCodigo} não encontrado.`)
      const vigente = Number(productSnap.data().revisaoVigente ?? 0)
      if (!vigente) throw new Error(`O produto ${item.produtoCodigo} não possui Ficha Técnica padrão.`)

      const revisionRef = doc(
        db,
        'empresas',
        empresaId,
        'produtos',
        item.produtoCodigo,
        'revisoes',
        String(vigente).padStart(3, '0'),
      )
      const revisionSnap = await transaction.get(revisionRef)
      if (!revisionSnap.exists()) throw new Error(`A revisão vigente do produto ${item.produtoCodigo} não foi encontrada.`)
      const revision = { id: revisionSnap.id, ...revisionSnap.data() } as TechnicalRevision
      if (revision.status !== 'padrao') throw new Error(`A revisão vigente do produto ${item.produtoCodigo} não está publicada.`)

      frozenItems.push({ ...item, revisao: vigente })

      for (const operation of revision.operacoes ?? []) {
        frozenOperations.push({
          id: crypto.randomUUID(),
          itemId: item.id,
          produtoCodigo: item.produtoCodigo,
          produtoDescricao: item.produtoDescricao,
          revisao: vigente,
          cor: item.cor,
          operacao: {
            ...operation,
            instrucoes: [...(operation.instrucoes ?? [])],
            pontosCriticos: [...(operation.pontosCriticos ?? [])],
            midias: (operation.midias ?? []).map((media) => ({
              ...media,
              path: undefined,
            })),
          },
          status: 'pendente',
        })
      }

      for (const line of revision.bom ?? []) {
        const hasVariableConsumption = line.consumoPorTamanho
          && Object.keys(line.consumoPorTamanho).length > 0

        if (hasVariableConsumption) {
          const missingVariants = item.variantes
            .filter((variant) => line.consumoPorTamanho?.[variant.nome] == null)
            .map((variant) => variant.nome)

          if (missingVariants.length > 0) {
            throw new Error(
              `O material ${line.codigoSnapshot} não possui consumo definido para: ${missingVariants.join(', ')}.`,
            )
          }
        }

        const baseRequired = hasVariableConsumption
          ? item.variantes.reduce((sum, variant) => {
              const variantConsumption = Number(
                line.consumoPorTamanho?.[variant.nome],
              )
              return sum + variantConsumption * Number(variant.quantidade || 0)
            }, 0)
          : Number(line.consumo) * item.quantidadeTotal

        const required = baseRequired * (1 + Number(line.perdaPercentual || 0) / 100)
        const resolvedColor = line.corRegra === 'produto'
          ? (item.cor?.trim() ?? '')
          : line.corRegra === 'fixa'
            ? (line.corFixa?.trim() ?? '')
            : ''
        const key = kitKey(line, resolvedColor)
        const current = kitMap.get(key)
        if (current) {
          current.quantidadeNecessaria += required
        } else {
          kitMap.set(key, {
            id: crypto.randomUUID(),
            materialId: line.materialId,
            codigoSnapshot: line.codigoSnapshot,
            descricaoSnapshot: line.descricaoSnapshot,
            fornecedorSnapshot: line.fornecedorSnapshot,
            unidade: line.unidade,
            quantidadeNecessaria: required,
            corRegra: line.corRegra,
            corFixa: resolvedColor || line.corFixa,
          })
        }
      }
    }

    const nextStatus = firstWorkflowStageId ? 'em_fluxo' : 'liberada'
    const history = [
      ...(order.historico ?? []),
      {
        id: crypto.randomUUID(),
        acao: 'OP liberada e kit congelado',
        etapaId: firstWorkflowStageId ?? null,
        uid,
        em: Timestamp.now(),
      },
    ]

    transaction.update(orderRef, {
      status: nextStatus,
      workflowStageId: firstWorkflowStageId ?? null,
      itens: frozenItems,
      kit: Array.from(kitMap.values()),
      operacoes: frozenOperations,
      historico: history,
      liberadaEm: serverTimestamp(),
      liberadaPor: uid,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })
    transaction.set(auditRef, {
      entidade: 'ordem_producao',
      entidadeId: orderId,
      acao: 'liberada',
      resumo: `${order.numero} · ${frozenItems.length} item(ns) · ${kitMap.size} material(is)`,
      uid,
      em: serverTimestamp(),
    })

    return { ...order, itens: frozenItems, kit: Array.from(kitMap.values()), operacoes: frozenOperations, status: nextStatus, workflowStageId: firstWorkflowStageId ?? null }
  })
}

export async function advanceProductionOrder(
  empresaId: string,
  uid: string,
  orderId: string,
  currentStageId: string,
  nextStageId: string | null,
  currentStageName: string,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('OP não encontrada.')
    const data = snap.data() as ProductionOrderRecord
    if (data.workflowStageId !== currentStageId) throw new Error('A OP já mudou de etapa. Atualize a tela.')

    const final = !nextStageId
    const history = [
      ...(data.historico ?? []),
      {
        id: crypto.randomUUID(),
        acao: final ? 'Fluxo concluído' : `Etapa concluída: ${currentStageName}`,
        etapaId: nextStageId,
        uid,
        em: Timestamp.now(),
      },
    ]

    transaction.update(orderRef, {
      status: final ? 'concluida' : 'em_fluxo',
      workflowStageId: nextStageId,
      historico: history,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })
    transaction.set(auditRef, {
      entidade: 'ordem_producao',
      entidadeId: orderId,
      acao: final ? 'concluida' : 'etapa_avancada',
      resumo: data.numero,
      uid,
      em: serverTimestamp(),
    })
  })
}


export async function updateProductionOrderDraft(
  empresaId: string,
  uid: string,
  orderId: string,
  input: { prazo?: string; itens: NewOrderItem[] },
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('Ordem de Produção não encontrada.')

    const current = { id: snap.id, ...snap.data() } as ProductionOrderRecord
    if (current.status !== 'rascunho') {
      throw new Error('Somente OP em rascunho pode ser editada.')
    }

    const itens: ProductionOrderItemRecord[] = input.itens.map((item) => ({
      id: crypto.randomUUID(),
      produtoCodigo: item.produtoCodigo,
      produtoDescricao: item.produtoDescricao,
      revisao: null,
      cor: item.cor?.trim() ?? '',
      variantes: item.variantes,
      quantidadeTotal: totalVariants(item.variantes),
    }))

    if (itens.length === 0 || itens.some((item) => item.quantidadeTotal <= 0)) {
      throw new Error('A OP precisa ter ao menos um item com quantidade maior que zero.')
    }

    const history = [
      ...(current.historico ?? []),
      {
        id: crypto.randomUUID(),
        acao: 'Rascunho da OP alterado',
        uid,
        em: Timestamp.now(),
      },
    ]

    transaction.update(orderRef, {
      prazo: input.prazo ?? '',
      itens,
      operacoes: [],
      historico: history,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(auditRef, {
      entidade: 'ordem_producao',
      entidadeId: orderId,
      acao: 'rascunho_alterado',
      resumo: current.numero,
      uid,
      em: serverTimestamp(),
    })
  })
}

export async function cancelProductionOrderDraft(
  empresaId: string,
  uid: string,
  orderId: string,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('Ordem de Produção não encontrada.')

    const current = { id: snap.id, ...snap.data() } as ProductionOrderRecord
    if (current.status !== 'rascunho') {
      throw new Error('Somente OP em rascunho pode ser cancelada por esta ação.')
    }

    const history = [
      ...(current.historico ?? []),
      {
        id: crypto.randomUUID(),
        acao: 'OP cancelada antes da liberação',
        uid,
        em: Timestamp.now(),
      },
    ]

    transaction.update(orderRef, {
      status: 'cancelada',
      historico: history,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(auditRef, {
      entidade: 'ordem_producao',
      entidadeId: orderId,
      acao: 'cancelada',
      resumo: current.numero,
      uid,
      em: serverTimestamp(),
    })
  })
}

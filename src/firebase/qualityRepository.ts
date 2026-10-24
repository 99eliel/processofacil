import {
  Timestamp,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import type {
  ProductionOrderRecord,
  QualityCriterion,
  QualityInspection,
  QualitySample,
} from '../domain/types'

export async function createQualityInspection(
  empresaId: string,
  uid: string,
  order: ProductionOrderRecord,
  criterios: QualityCriterion[],
  amostras: QualitySample[],
  observacao: string,
) {
  if (criterios.length === 0) throw new Error('Adicione pelo menos um critério de inspeção.')
  if (amostras.length === 0) throw new Error('Adicione pelo menos uma amostra.')
  if (order.status === 'rascunho' || order.status === 'cancelada' || order.status === 'concluida') throw new Error('A OP não está disponível para inspeção.')
  if (amostras.some((sample) => sample.resultados.length !== criterios.length || sample.resultados.some((result) => result.tipo === 'numerico' && (result.valor === undefined || !Number.isFinite(result.valor))))) throw new Error('Todas as medições numéricas precisam estar preenchidas.')

  const resultadoGeral: QualityInspection['resultadoGeral'] =
    amostras.every((sample) => sample.aprovada) ? 'aprovada' : 'reprovada'

  const inspectionRef = doc(collection(db, 'empresas', empresaId, 'inspecoes'))
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', order.id)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.set(inspectionRef, {
    opId: order.id,
    opNumero: order.numero,
    criterios,
    amostras,
    resultadoGeral,
    observacao: observacao.trim(),
    inspetorUid: uid,
    criadoEm: now,
    criadoPor: uid,
  })

  const history = [
    ...(order.historico ?? []),
    {
      id: crypto.randomUUID(),
      acao: resultadoGeral === 'aprovada' ? 'Inspeção aprovada' : 'Inspeção reprovada',
      etapaId: order.workflowStageId ?? null,
      uid,
      em: Timestamp.now(),
      observacao: observacao.trim(),
    },
  ]

  batch.update(orderRef, {
    status: resultadoGeral === 'reprovada' ? 'reprovada' : order.status,
    reprovadaNaEtapaId: resultadoGeral === 'reprovada' ? order.workflowStageId ?? null : null,
    historico: history,
    alteradoEm: now,
    alteradoPor: uid,
  })

  batch.set(auditRef, {
    entidade: 'inspecao',
    entidadeId: inspectionRef.id,
    acao: resultadoGeral,
    resumo: `${order.numero} · ${amostras.length} amostra(s)`,
    uid,
    em: now,
  })

  await batch.commit()
  return { id: inspectionRef.id, resultadoGeral }
}

export async function sendOrderToRework(
  empresaId: string,
  uid: string,
  order: ProductionOrderRecord,
  targetStageId: string | null,
  reason: string,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', order.id)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  const batch = writeBatch(db)
  const now = serverTimestamp()
  const history = [
    ...(order.historico ?? []),
    {
      id: crypto.randomUUID(),
      acao: 'Enviada para retrabalho',
      etapaId: targetStageId,
      uid,
      em: Timestamp.now(),
      observacao: reason.trim(),
    },
  ]

  batch.update(orderRef, {
    status: 'em_fluxo',
    workflowStageId: targetStageId,
    historico: history,
    alteradoEm: now,
    alteradoPor: uid,
  })

  batch.set(auditRef, {
    entidade: 'ordem_producao',
    entidadeId: order.id,
    acao: 'retrabalho',
    resumo: `${order.numero} · ${reason.trim() || 'Sem observação'}`,
    uid,
    em: now,
  })

  await batch.commit()
}

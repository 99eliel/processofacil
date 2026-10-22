import {
  Timestamp,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import type { ProductionOperationTask, ProductionOrderRecord } from '../domain/types'

function sortedTasks(tasks: ProductionOperationTask[]) {
  return [...tasks].sort((a, b) => {
    if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId)
    return a.operacao.ordem - b.operacao.ordem
  })
}

function ensurePreviousCompleted(tasks: ProductionOperationTask[], current: ProductionOperationTask) {
  const previous = tasks
    .filter((task) => task.itemId === current.itemId && task.operacao.ordem < current.operacao.ordem)
    .sort((a, b) => a.operacao.ordem - b.operacao.ordem)

  const pending = previous.find((task) => task.status !== 'concluida')
  if (pending) {
    throw new Error(`Conclua primeiro a operação ${pending.operacao.codigo} · ${pending.operacao.nome}.`)
  }
}

export async function startOperationTask(
  empresaId: string,
  uid: string,
  orderId: string,
  taskId: string,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('OP não encontrada.')

    const order = { id: snap.id, ...snap.data() } as ProductionOrderRecord
    if (!['em_fluxo', 'liberada', 'reprovada'].includes(order.status)) {
      throw new Error('Esta OP não está disponível para execução.')
    }

    const tasks = sortedTasks(order.operacoes ?? [])
    const current = tasks.find((task) => task.id === taskId)
    if (!current) throw new Error('Operação não encontrada.')
    if (current.status === 'concluida') throw new Error('Esta operação já foi concluída.')
    if (current.status === 'bloqueada') throw new Error('Resolva o bloqueio antes de iniciar.')

    ensurePreviousCompleted(tasks, current)

    const updated = (order.operacoes ?? []).map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: 'em_execucao' as const,
            iniciadoEm: task.iniciadoEm ?? Timestamp.now(),
            operadorUid: uid,
          }
        : task,
    )

    transaction.update(orderRef, {
      operacoes: updated,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(auditRef, {
      entidade: 'operacao_producao',
      entidadeId: taskId,
      acao: 'iniciada',
      resumo: `${order.numero} · ${current.operacao.codigo} · ${current.operacao.nome}`,
      uid,
      em: serverTimestamp(),
    })
  })
}

export async function completeOperationTask(
  empresaId: string,
  uid: string,
  orderId: string,
  taskId: string,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('OP não encontrada.')

    const order = { id: snap.id, ...snap.data() } as ProductionOrderRecord
    const tasks = sortedTasks(order.operacoes ?? [])
    const current = tasks.find((task) => task.id === taskId)
    if (!current) throw new Error('Operação não encontrada.')
    if (current.status === 'concluida') throw new Error('Esta operação já foi concluída.')
    if (current.status === 'bloqueada') throw new Error('Resolva o bloqueio antes de concluir.')

    ensurePreviousCompleted(tasks, current)

    const updated = (order.operacoes ?? []).map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: 'concluida' as const,
            iniciadoEm: task.iniciadoEm ?? Timestamp.now(),
            concluidoEm: Timestamp.now(),
            operadorUid: uid,
            observacao: '',
          }
        : task,
    )

    transaction.update(orderRef, {
      operacoes: updated,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(auditRef, {
      entidade: 'operacao_producao',
      entidadeId: taskId,
      acao: 'concluida',
      resumo: `${order.numero} · ${current.operacao.codigo} · ${current.operacao.nome}`,
      uid,
      em: serverTimestamp(),
    })
  })
}

export async function blockOperationTask(
  empresaId: string,
  uid: string,
  orderId: string,
  taskId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error('Informe o problema encontrado.')

  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('OP não encontrada.')

    const order = { id: snap.id, ...snap.data() } as ProductionOrderRecord
    const current = (order.operacoes ?? []).find((task) => task.id === taskId)
    if (!current) throw new Error('Operação não encontrada.')

    const updated = (order.operacoes ?? []).map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: 'bloqueada' as const,
            operadorUid: uid,
            observacao: reason.trim(),
          }
        : task,
    )

    transaction.update(orderRef, {
      operacoes: updated,
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })

    transaction.set(auditRef, {
      entidade: 'operacao_producao',
      entidadeId: taskId,
      acao: 'bloqueada',
      resumo: `${order.numero} · ${current.operacao.codigo} · ${reason.trim()}`,
      uid,
      em: serverTimestamp(),
    })
  })
}

export async function unblockOperationTask(
  empresaId: string,
  uid: string,
  orderId: string,
  taskId: string,
) {
  const orderRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef)
    if (!snap.exists()) throw new Error('OP não encontrada.')
    const order = { id: snap.id, ...snap.data() } as ProductionOrderRecord

    transaction.update(orderRef, {
      operacoes: (order.operacoes ?? []).map((task) =>
        task.id === taskId
          ? { ...task, status: 'pendente' as const, observacao: '' }
          : task,
      ),
      alteradoEm: serverTimestamp(),
      alteradoPor: uid,
    })
  })
}

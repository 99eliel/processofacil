import {
  Timestamp, collection, doc, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import type { ProductionOperationTask, ProductionOrderRecord } from '../domain/types'

export type ProductionEntry = {
  id: string
  opId: string
  opNumero: string
  taskId: string
  itemId: string
  produtoCodigo: string
  operacaoNome: string
  operadorNome: string
  boas: number
  defeituosas: number
  observacao: string
  criadoEm?: unknown
  criadoPor: string
}

export type ProductionBalance = {
  id: string
  opId: string
  taskId: string
  boas: number
  defeituosas: number
  total: number
  alteradoEm?: unknown
}

export type ProductionReversal = {
  id: string
  entryId: string
  opId: string
  taskId: string
  motivo: string
  criadoEm?: unknown
  criadoPor: string
}

function validQuantity(value: number) {
  return Number.isInteger(value) && value >= 0 && Number.isSafeInteger(value)
}

export function orderedItemTasks(order: ProductionOrderRecord, itemId: string) {
  return (order.operacoes ?? [])
    .filter((task) => task.itemId === itemId)
    .sort((a, b) => a.operacao.ordem - b.operacao.ordem)
}

export function precedingTask(order: ProductionOrderRecord, task: ProductionOperationTask) {
  const tasks = orderedItemTasks(order, task.itemId)
  const index = tasks.findIndex((candidate) => candidate.id === task.id)
  return index > 0 ? tasks[index - 1] : null
}

export function followingTask(order: ProductionOrderRecord, task: ProductionOperationTask) {
  const tasks = orderedItemTasks(order, task.itemId)
  const index = tasks.findIndex((candidate) => candidate.id === task.id)
  return index >= 0 && index < tasks.length - 1 ? tasks[index + 1] : null
}

export function plannedQuantity(order: ProductionOrderRecord, task: ProductionOperationTask) {
  return order.itens.find((item) => item.id === task.itemId)?.quantidadeTotal ?? 0
}

export function balanceFor(balances: ProductionBalance[], taskId: string) {
  return balances.find((row) => row.id === taskId) ?? null
}

export async function registerProduction(
  empresaId: string,
  uid: string,
  input: {
    opId: string
    taskId: string
    boas: number
    defeituosas: number
    operadorNome: string
    observacao?: string
  },
) {
  const boas = Number(input.boas)
  const defeituosas = Number(input.defeituosas)
  if (!validQuantity(boas) || !validQuantity(defeituosas) || boas + defeituosas === 0) {
    throw new Error('Informe quantidades inteiras e positivas. Pelo menos uma unidade deve ser apontada.')
  }
  if (!input.operadorNome.trim()) throw new Error('Informe quem realizou o apontamento.')

  const opRef = doc(db, 'empresas', empresaId, 'ordensProducao', input.opId)
  const balanceRef = doc(db, 'empresas', empresaId, 'saldosOperacoes', input.taskId)
  const entryRef = doc(collection(db, 'empresas', empresaId, 'apontamentos'))
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))

  return runTransaction(db, async (tx) => {
    const opSnap = await tx.get(opRef)
    if (!opSnap.exists()) throw new Error('Ordem de produção não encontrada.')
    const op = { id: opSnap.id, ...opSnap.data() } as ProductionOrderRecord
    if (op.excluido || !['liberada', 'em_fluxo', 'reprovada'].includes(op.status)) {
      throw new Error('Esta OP não está liberada para apontamentos.')
    }
    const task = (op.operacoes ?? []).find((row) => row.id === input.taskId)
    if (!task) throw new Error('Operação não encontrada na OP.')
    if (task.status === 'bloqueada') throw new Error('Operação bloqueada. Resolva a ocorrência antes de apontar.')
    if (task.status === 'concluida') throw new Error('Operação já concluída no fluxo antigo. Não é possível misturar apontamentos.')
    const previous = precedingTask(op, task)
    const currentSnap = await tx.get(balanceRef)
    const previousSnap = previous
      ? await tx.get(doc(db, 'empresas', empresaId, 'saldosOperacoes', previous.id))
      : null
    const current = currentSnap.exists() ? currentSnap.data() as ProductionBalance : null
    const upstreamAvailable = previous
      ? Number(previousSnap?.data()?.boas ?? 0)
      : plannedQuantity(op, task)
    const currentTotal = Number(current?.total ?? 0)
    if (currentTotal + boas + defeituosas > upstreamAvailable) {
      throw new Error(
        'Quantidade acima do saldo disponível nesta etapa (' +
        Math.max(0, upstreamAvailable - currentTotal) + ' unidade(s)).',
      )
    }

    tx.set(entryRef, {
      opId: op.id, opNumero: op.numero, taskId: task.id, itemId: task.itemId,
      produtoCodigo: task.produtoCodigo, operacaoNome: task.operacao.nome,
      operadorNome: input.operadorNome.trim(),
      boas, defeituosas, observacao: (input.observacao ?? '').trim(),
      criadoEm: serverTimestamp(), criadoPor: uid,
    })
    tx.set(balanceRef, {
      opId: op.id, taskId: task.id,
      boas: Number(current?.boas ?? 0) + boas,
      defeituosas: Number(current?.defeituosas ?? 0) + defeituosas,
      total: currentTotal + boas + defeituosas,
      alteradoEm: serverTimestamp(),
    })
    if (op.status === 'liberada') {
      tx.update(opRef, { status: 'em_fluxo', alteradoEm: serverTimestamp(), alteradoPor: uid })
    }
    tx.set(auditRef, {
      entidade: 'apontamento_producao', entidadeId: entryRef.id, acao: 'criada',
      resumo: op.numero + ' · ' + task.operacao.nome + ': ' + boas + ' boas / ' + defeituosas + ' defeituosas',
      uid, em: serverTimestamp(),
    })
    return entryRef.id
  })
}

export async function reverseProductionEntry(
  empresaId: string,
  uid: string,
  entry: ProductionEntry,
  motivo: string,
) {
  if (!motivo.trim()) throw new Error('Informe o motivo da correção.')
  const opRef = doc(db, 'empresas', empresaId, 'ordensProducao', entry.opId)
  const entryRef = doc(db, 'empresas', empresaId, 'apontamentos', entry.id)
  const reverseRef = doc(db, 'empresas', empresaId, 'estornosApontamentos', entry.id)
  const balanceRef = doc(db, 'empresas', empresaId, 'saldosOperacoes', entry.taskId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  return runTransaction(db, async (tx) => {
    const [opSnap, entrySnap, reversalSnap, balanceSnap] = await Promise.all([
      tx.get(opRef), tx.get(entryRef), tx.get(reverseRef), tx.get(balanceRef),
    ])
    if (!opSnap.exists() || !entrySnap.exists()) throw new Error('Apontamento ou OP não encontrado.')
    if (reversalSnap.exists()) throw new Error('Este apontamento já foi estornado.')
    if (!balanceSnap.exists()) throw new Error('Saldo da operação não encontrado.')
    const op = { id: opSnap.id, ...opSnap.data() } as ProductionOrderRecord
    if (op.excluido || ['concluida', 'cancelada'].includes(op.status)) throw new Error('Esta OP está encerrada ou excluída.')
    const saved = entrySnap.data() as Omit<ProductionEntry, 'id'>
    if (saved.opId !== entry.opId || saved.taskId !== entry.taskId) {
      throw new Error('Dados do apontamento divergentes.')
    }
    const task = (op.operacoes ?? []).find((row) => row.id === saved.taskId)
    if (!task) throw new Error('Operação original não encontrada.')
    const next = followingTask(op, task)
    const nextSnap = next
      ? await tx.get(doc(db, 'empresas', empresaId, 'saldosOperacoes', next.id))
      : null
    const current = balanceSnap.data() as ProductionBalance
    const newGood = Number(current.boas ?? 0) - Number(saved.boas ?? 0)
    const newBad = Number(current.defeituosas ?? 0) - Number(saved.defeituosas ?? 0)
    const newTotal = Number(current.total ?? 0) - Number(saved.boas ?? 0) - Number(saved.defeituosas ?? 0)
    if (newGood < 0 || newBad < 0 || newTotal < 0) {
      throw new Error('O saldo atual não permite este estorno. Se houve retrabalho, estorne-o primeiro.')
    }
    if (Number(nextSnap?.data()?.total ?? 0) > newGood) {
      throw new Error('Não é possível estornar: a próxima etapa já consumiu parte dessas unidades.')
    }
    tx.set(reverseRef, {
      entryId: entry.id, opId: saved.opId, taskId: saved.taskId,
      motivo: motivo.trim(), criadoEm: serverTimestamp(), criadoPor: uid,
    })
    tx.update(balanceRef, {
      boas: newGood, defeituosas: newBad, total: newTotal,
      alteradoEm: serverTimestamp(),
    })
    tx.set(auditRef, {
      entidade: 'apontamento_producao', entidadeId: entry.id, acao: 'estornado',
      resumo: op.numero + ' · ' + task.operacao.nome + ' · ' + motivo.trim(),
      uid, em: serverTimestamp(),
    })
  })
}


/** Fecha uma OP apenas quando cada item passou integralmente pela sua última operação. */
export async function completeProductionOrder(empresaId: string, uid: string, orderId: string) {
  const opRef = doc(db, 'empresas', empresaId, 'ordensProducao', orderId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(opRef)
    if (!snap.exists()) throw new Error('OP não encontrada.')
    const op = { id: snap.id, ...snap.data() } as ProductionOrderRecord
    if (op.excluido || !['liberada', 'em_fluxo'].includes(op.status)) {
      throw new Error('Esta OP não está disponível para conclusão.')
    }
    if (op.workflowStageId) {
      throw new Error('Finalize antes as aprovações configuradas no Workflow.')
    }
    if (op.itens.length === 0) throw new Error('OP sem itens.')
    for (const item of op.itens) {
      const tasks = orderedItemTasks(op, item.id)
      const finalTask = tasks[tasks.length - 1]
      if (!finalTask) throw new Error('O produto ' + item.produtoCodigo + ' não possui operações.')
      const finalBalance = await tx.get(doc(db, 'empresas', empresaId, 'saldosOperacoes', finalTask.id))
      const good = Number(finalBalance.data()?.boas ?? 0)
      if (good < item.quantidadeTotal) {
        throw new Error('Produção incompleta em ' + item.produtoCodigo + ': ' + good + '/' + item.quantidadeTotal + ' boas.')
      }
    }
    tx.update(opRef, {
      status: 'concluida',
      historico: [...(op.historico ?? []), {
        id: crypto.randomUUID(), acao: 'OP concluída após conferência da produção',
        uid, em: Timestamp.now(),
      }],
      concluidaEm: serverTimestamp(),
      alteradoEm: serverTimestamp(), alteradoPor: uid,
    })
    tx.set(auditRef, {
      entidade: 'ordem_producao', entidadeId: op.id, acao: 'concluida_por_apontamento',
      resumo: op.numero, uid, em: serverTimestamp(),
    })
  })
}


export type ProductionRework = {
  id: string
  opId: string
  opNumero: string
  taskId: string
  operacaoNome: string
  operadorNome: string
  quantidade: number
  observacao: string
  criadoEm?: unknown
  criadoPor: string
}
export type ProductionReworkReversal = {
  id: string
  reworkId: string
  opId: string
  taskId: string
  motivo: string
  criadoEm?: unknown
  criadoPor: string
}

/** Recupera peças apontadas como defeituosas: muda o saldo, sem duplicar unidades físicas. */
export async function registerRework(
  empresaId: string,
  uid: string,
  input: { opId: string; taskId: string; quantidade: number; operadorNome: string; observacao: string },
) {
  const quantity = Number(input.quantidade)
  if (!validQuantity(quantity) || quantity === 0) throw new Error('Informe quantidade inteira e maior que zero.')
  if (!input.operadorNome.trim()) throw new Error('Informe o responsável pelo retrabalho.')
  if (!input.observacao.trim()) throw new Error('Descreva a correção realizada.')
  const opRef = doc(db, 'empresas', empresaId, 'ordensProducao', input.opId)
  const balanceRef = doc(db, 'empresas', empresaId, 'saldosOperacoes', input.taskId)
  const reworkRef = doc(collection(db, 'empresas', empresaId, 'retrabalhosOperacoes'))
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  return runTransaction(db, async (tx) => {
    const [opSnap, balanceSnap] = await Promise.all([tx.get(opRef), tx.get(balanceRef)])
    if (!opSnap.exists()) throw new Error('OP não encontrada.')
    const op = { id: opSnap.id, ...opSnap.data() } as ProductionOrderRecord
    if (op.excluido || !['liberada', 'em_fluxo', 'reprovada'].includes(op.status)) {
      throw new Error('OP indisponível para retrabalho.')
    }
    const task = (op.operacoes ?? []).find((row) => row.id === input.taskId)
    if (!task || task.status === 'bloqueada' || task.status === 'concluida') {
      throw new Error('Operação não está disponível para retrabalho.')
    }
    if (!balanceSnap.exists()) throw new Error('Não existe produção defeituosa registrada nesta operação.')
    const current = balanceSnap.data() as ProductionBalance
    if (quantity > Number(current.defeituosas ?? 0)) {
      throw new Error('O retrabalho não pode ultrapassar as unidades defeituosas disponíveis.')
    }
    tx.set(reworkRef, {
      opId: op.id, opNumero: op.numero, taskId: task.id, operacaoNome: task.operacao.nome,
      quantidade: quantity, operadorNome: input.operadorNome.trim(),
      observacao: input.observacao.trim(), criadoEm: serverTimestamp(), criadoPor: uid,
    })
    tx.update(balanceRef, {
      boas: Number(current.boas ?? 0) + quantity,
      defeituosas: Number(current.defeituosas ?? 0) - quantity,
      alteradoEm: serverTimestamp(),
    })
    tx.set(auditRef, {
      entidade: 'retrabalho_producao', entidadeId: reworkRef.id, acao: 'registrado',
      resumo: op.numero + ' · ' + task.operacao.nome + ' · ' + quantity + ' recuperadas',
      uid, em: serverTimestamp(),
    })
    return reworkRef.id
  })
}

export async function reverseRework(
  empresaId: string,
  uid: string,
  rework: ProductionRework,
  reason: string,
) {
  if (!reason.trim()) throw new Error('Explique o motivo do estorno do retrabalho.')
  const opRef = doc(db, 'empresas', empresaId, 'ordensProducao', rework.opId)
  const reworkRef = doc(db, 'empresas', empresaId, 'retrabalhosOperacoes', rework.id)
  const reverseRef = doc(db, 'empresas', empresaId, 'estornosRetrabalhos', rework.id)
  const balanceRef = doc(db, 'empresas', empresaId, 'saldosOperacoes', rework.taskId)
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  return runTransaction(db, async (tx) => {
    const [opSnap, reworkSnap, reverseSnap, balanceSnap] = await Promise.all([
      tx.get(opRef), tx.get(reworkRef), tx.get(reverseRef), tx.get(balanceRef),
    ])
    if (!opSnap.exists() || !reworkSnap.exists() || !balanceSnap.exists()) throw new Error('Registro não encontrado.')
    if (reverseSnap.exists()) throw new Error('Retrabalho já estornado.')
    const op = { id: opSnap.id, ...opSnap.data() } as ProductionOrderRecord
    if (op.excluido || ['cancelada', 'concluida'].includes(op.status)) throw new Error('OP encerrada ou excluída.')
    const stored = reworkSnap.data() as ProductionRework
    if (stored.opId !== rework.opId || stored.taskId !== rework.taskId) throw new Error('Retrabalho divergente.')
    const task = (op.operacoes ?? []).find((row) => row.id === stored.taskId)
    if (!task) throw new Error('Operação original não encontrada.')
    const next = followingTask(op, task)
    const nextSnap = next
      ? await tx.get(doc(db, 'empresas', empresaId, 'saldosOperacoes', next.id))
      : null
    const balance = balanceSnap.data() as ProductionBalance
    const quantity = Number(stored.quantidade ?? 0)
    const afterGood = Number(balance.boas ?? 0) - quantity
    if (afterGood < 0 || Number(nextSnap?.data()?.total ?? 0) > afterGood) {
      throw new Error('Não é possível desfazer: há peças recuperadas já consumidas ou estornos anteriores.')
    }
    tx.set(reverseRef, {
      reworkId: rework.id, opId: op.id, taskId: task.id,
      motivo: reason.trim(), criadoEm: serverTimestamp(), criadoPor: uid,
    })
    tx.update(balanceRef, {
      boas: afterGood, defeituosas: Number(balance.defeituosas ?? 0) + quantity,
      alteradoEm: serverTimestamp(),
    })
    tx.set(auditRef, {
      entidade: 'retrabalho_producao', entidadeId: rework.id, acao: 'estornado',
      resumo: op.numero + ' · ' + reason.trim(), uid, em: serverTimestamp(),
    })
  })
}

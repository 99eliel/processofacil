import type { ProductionOrderRecord, ProductionOperationTask } from './types'

/** Saldos materializados por etapa. Apenas o identificador e as quantidades são necessários. */
export type OperationBalance = {
  id: string
  taskId: string
  boas: number
  defeituosas: number
  total: number
}

export function tasksForItem(order: ProductionOrderRecord, itemId: string): ProductionOperationTask[] {
  return [...(order.operacoes ?? [])]
    .filter((task) => task.itemId === itemId)
    .sort((a, b) => a.operacao.ordem - b.operacao.ordem)
}

export function findBalance(balances: OperationBalance[], taskId: string): OperationBalance | undefined {
  return balances.find((row) => row.id === taskId || row.taskId === taskId)
}

export function stepProgress(
  order: ProductionOrderRecord,
  task: ProductionOperationTask,
  balances: OperationBalance[],
) {
  const sequence = tasksForItem(order, task.itemId)
  const index = sequence.findIndex((entry) => entry.id === task.id)
  const previous = index > 0 ? sequence[index - 1] : undefined
  const target = Math.max(0, Number(order.itens.find((item) => item.id === task.itemId)?.quantidadeTotal ?? 0))
  const balance = findBalance(balances, task.id)
  const good = Math.max(0, Number(balance?.boas ?? 0))
  const defective = Math.max(0, Number(balance?.defeituosas ?? 0))
  const processed = Math.max(0, Number(balance?.total ?? 0))
  const available = previous
    ? Math.max(0, Number(findBalance(balances, previous.id)?.boas ?? 0))
    : target
  return {
    task, target, previous, good, defective, processed, available,
    toPoint: Math.max(0, available - processed),
    toGoal: Math.max(0, target - good),
    percentage: target ? Math.min(100, Math.round(100 * good / target)) : 0,
    hasEntries: Boolean(balance),
  }
}

export function orderProgress(order: ProductionOrderRecord, balances: OperationBalance[]) {
  let planned = 0
  let finished = 0
  let withOperations = 0
  for (const item of order.itens) {
    const quantity = Math.max(0, Number(item.quantidadeTotal || 0))
    planned += quantity
    const sequence = tasksForItem(order, item.id)
    const last = sequence.at(-1)
    if (!last) continue
    withOperations += 1
    finished += Math.min(quantity, Math.max(0, Number(findBalance(balances, last.id)?.boas ?? 0)))
  }
  return {
    planned, finished, remaining: Math.max(0, planned - finished),
    percentage: planned ? Math.min(100, Math.round(finished / planned * 100)) : 0,
    missingOperations: order.itens.length - withOperations,
    ready: planned > 0 && finished >= planned && withOperations === order.itens.length,
  }
}

export function productionWarnings(order: ProductionOrderRecord, balances: OperationBalance[], today: string) {
  const warnings: string[] = []
  if (order.excluido || ['cancelada', 'concluida'].includes(order.status)) return warnings
  if (order.prazo && /^\d{4}-\d{2}-\d{2}$/.test(order.prazo) && order.prazo < today) {
    warnings.push('Necessidade vencida: ' + order.prazo.split('-').reverse().join('/'))
  }
  if (order.status !== 'rascunho') {
    if (order.itens.some((item) => tasksForItem(order, item.id).length === 0)) {
      warnings.push('Há produtos sem operações na revisão congelada.')
    }
    for (const item of order.itens) {
      for (const task of tasksForItem(order, item.id)) {
        const status = stepProgress(order, task, balances)
        if (status.defective > 0) {
          warnings.push('A operação ' + task.operacao.nome + ' tem ' + status.defective + ' unidade(s) aguardando retrabalho.')
        }
        if (task.operacao.tempoPadraoMin == null || task.operacao.tempoPadraoMin <= 0) {
          warnings.push('Operação sem tempo-padrão: ' + task.operacao.nome)
        }
      }
    }
  }
  return warnings
}

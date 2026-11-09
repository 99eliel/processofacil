import type { ProductionOrderRecord, Product, ProductionOperationTask } from './types'

export type CapacityResource = {
  id: string
  nome: string
  quantidade: number
  horasDia: number
  diasSemana: number
  eficiencia: number
  ativo: boolean
}
export type CapacitySettingsRecord = {
  id: string
  tipo: 'maquinas' | 'maoObra'
  recursos: CapacityResource[]
  alteradoEm?: unknown
}
export type CapacityRow = {
  nome: string
  previstasHoras: number
  concluidasHoras: number
  decorridasHoras: number
  emExecucao: number
  semTempo: number
  capacidadeHoras: number
  configurado: boolean
  quantidade: number
  tarefas: number
}
export type CapacityTotals = {
  planejadas: number
  concluidasPadrao: number
  decorridas: number
  capacidade: number
  operacoes: number
  semTempo: number
  emExecucao: number
}

export function toMilliseconds(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    const n = value.toMillis()
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const n = Number(value.seconds) * 1000
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const n = typeof value === 'string' ? Date.parse(value) : value
    return Number.isFinite(n) ? n : null
  }
  return null
}

export const numberHours = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n)
export function weeklyHours(resource: CapacityResource): number {
  if (!resource.ativo) return 0
  return Math.max(0, resource.quantidade) * Math.max(0, resource.horasDia)
    * Math.max(0, resource.diasSemana) * Math.min(100, Math.max(0, resource.eficiencia)) / 100
}
export function orderTasks(orders: ProductionOrderRecord[], products: Product[]) {
  const visible = new Set(products.filter(p => !p.excluido).map(p => p.codigo))
  return orders
    .filter(o => !o.excluido && !['rascunho', 'cancelada'].includes(o.status))
    .flatMap(order => (order.operacoes ?? [])
      .filter(task => visible.has(task.produtoCodigo))
      .map(task => ({ task, order, quantity: order.itens.find(i => i.id === task.itemId)?.quantidadeTotal ?? 0 })))
}
export function calculateCapacity(
  orders: ProductionOrderRecord[],
  products: Product[],
  resources: CapacityResource[],
  kind: 'maquinas' | 'maoObra',
  now = Date.now(),
): { rows: CapacityRow[]; totals: CapacityTotals } {
  const rows = new Map<string, CapacityRow>()
  const label = (task: ProductionOperationTask) => kind === 'maquinas'
    ? task.operacao.maquina?.trim() || 'Máquina não definida'
    : 'Demanda sem equipe atribuída'
  for (const r of resources) {
    if (!r.nome.trim() || !r.ativo) continue
    rows.set(r.nome.toLocaleLowerCase('pt-BR'), {
      nome: r.nome, previstasHoras: 0, concluidasHoras: 0, decorridasHoras: 0,
      emExecucao: 0, semTempo: 0, capacidadeHoras: weeklyHours(r), configurado: true,
      quantidade: r.quantidade, tarefas: 0,
    })
  }
  for (const { task, quantity } of orderTasks(orders, products)) {
    const name = label(task)
    const key = name.toLocaleLowerCase('pt-BR')
    const row = rows.get(key) ?? {
      nome: name, previstasHoras: 0, concluidasHoras: 0, decorridasHoras: 0,
      emExecucao: 0, semTempo: 0, capacidadeHoras: 0, configurado: false,
      quantidade: 0, tarefas: 0,
    }
    const standard = Number(task.operacao.tempoPadraoMin)
    const validStandard = task.operacao.tempoPadraoMin != null && Number.isFinite(standard) && standard > 0
    const plannedHours = validStandard ? standard * Math.max(0, quantity) / 60 : 0
    // Pendências e tarefas em andamento representam a demanda ainda não concluída.
    if (task.status !== 'concluida') row.previstasHoras += plannedHours
    else row.concluidasHoras += plannedHours
    if (!validStandard) row.semTempo += 1
    row.tarefas += 1
    if (task.status === 'em_execucao') row.emExecucao += 1
    const start = toMilliseconds(task.iniciadoEm)
    const end = toMilliseconds(task.concluidoEm)
    // Tempo decorrido entre eventos. Não confundir com horas-homem apontadas.
    if (start != null && end != null && end >= start && task.status === 'concluida') {
      row.decorridasHoras += (end - start) / 3600000
    } else if (start != null && task.status === 'em_execucao' && now >= start) {
      row.decorridasHoras += (now - start) / 3600000
    }
    rows.set(key, row)
  }
  const result = [...rows.values()].sort((a, b) => b.previstasHoras - a.previstasHoras || a.nome.localeCompare(b.nome))
  const totals = result.reduce<CapacityTotals>((a, row) => ({
    planejadas: a.planejadas + row.previstasHoras,
    concluidasPadrao: a.concluidasPadrao + row.concluidasHoras,
    decorridas: a.decorridas + row.decorridasHoras,
    capacidade: a.capacidade + row.capacidadeHoras,
    operacoes: a.operacoes + row.tarefas,
    semTempo: a.semTempo + row.semTempo,
    emExecucao: a.emExecucao + row.emExecucao,
  }), { planejadas: 0, concluidasPadrao: 0, decorridas: 0, capacidade: 0, operacoes: 0, semTempo: 0, emExecucao: 0 })
  return { rows: result, totals }
}

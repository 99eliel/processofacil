import type { ProductionOrderRecord, ProductionOperationTask } from './types'
import type { CapacityResource } from './capacityEngine'
import type { OperationBalance } from './progressEngine.ts'
import { findBalance } from './progressEngine.ts'

export type Shift = 'integral' | 'manha' | 'tarde' | 'noite'
export const shiftLabels: Record<Shift,string> = { integral: 'Dia inteiro', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
export type OperationSchedule = {
  id: string
  opId: string
  opNumero: string
  taskId: string
  itemId: string
  data: string
  turno: Shift
  equipeId: string
  maquinaId: string
  prioridade: 'normal' | 'alta' | 'urgente'
  observacao: string
  excluido?: boolean
}
export type LegacySchedule = {
  id: string
  opId: string
  data: string
  equipeId: string
  maquinaId: string
  prioridade?: 'normal' | 'alta' | 'urgente'
  excluido?: boolean
}
export type Collaborator = {
  id: string
  nome: string
  matricula?: string
  equipeId: string
  ativo: boolean
}
export type ResourceUnavailability = {
  id: string
  tipo: 'maquinas' | 'maoObra' | 'colaborador'
  recursoId: string
  dataInicio: string
  dataFim: string
  quantidade: number
  motivo: string
  excluido?: boolean
}
export type TimedOperation = {
  id: string
  opId: string
  taskId: string
  maquinaId?: string
  equipeId?: string
  duracaoMs: number
  registradoEm?: unknown
}
export type LoadRecord = {
  opId: string
  opNumero: string
  taskId: string
  operacao: string
  produto: string
  data: string
  turno: Shift
  equipeId: string
  maquinaId: string
  pendente: number
  horas: number
  semTempo: boolean
  prioridade: 'normal' | 'alta' | 'urgente'
  programado: boolean
}

export const normalizeResourceName = (name: string) => name.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
const dateValid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date + 'T12:00:00Z')) && new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date
const dayValue = (date: string) => dateValid(date) ? new Date(date + 'T12:00:00Z').getUTCDay() : -1
export const validDate = dateValid

export function businessDays(weekStart: string, days: number) {
  const begin = new Date(weekStart + 'T12:00:00Z')
  if (Number.isNaN(begin.getTime())) return []
  return Array.from({length:days},(_,i) => {
    const d = new Date(begin.getTime() + i * 86400000)
    return d.toISOString().slice(0,10)
  })
}
export function startOfWeek(date: string) {
  const d = new Date(date + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return date
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+6)%7))
  return d.toISOString().slice(0,10)
}
export function workingWeekdays(resource: CapacityResource) {
  const days = Math.min(7,Math.max(0,Math.floor(resource.diasSemana)))
  // Configuração legada: 5 dias = segunda–sexta, 6 = segunda–sábado.
  return Array.isArray(resource.diasAtivos) ? resource.diasAtivos : Array.from({length:days},(_,i)=>i+1 <= 6?i+1:0)
}
export function resourceDailyHours(resource: CapacityResource,date:string,shift:Shift='integral') {
  if (!resource.ativo || !workingWeekdays(resource).includes(dayValue(date))) return 0
  const hours = Math.max(0,Number(resource.horasDia)||0)
  if (shift === 'integral') return hours
  // Turnos são uma divisão explícita da jornada; não duplicam as horas disponíveis.
  const active = resource.turnos?.length ? resource.turnos : ['integral']
  return active.includes(shift) ? hours/active.length : 0
}
export function unavailableCount(
  kind:'maquinas'|'maoObra',resourceId:string,date:string,unavailable:ResourceUnavailability[],
  collaborators:Collaborator[]=[],
) {
  const ids = new Set(collaborators.filter(w=>w.equipeId===resourceId&&w.ativo).map(w=>w.id))
  const direct = unavailable.filter(r=>!r.excluido && r.tipo===kind && r.recursoId===resourceId && date>=r.dataInicio && date<=r.dataFim)
    .reduce((sum,r)=>sum+Math.max(0,Number(r.quantidade)||0),0)
  const people = kind==='maoObra' ? new Set(unavailable.filter(r=>!r.excluido && r.tipo==='colaborador' &&
    ids.has(r.recursoId) && date>=r.dataInicio && date<=r.dataFim).map(r=>r.recursoId)).size : 0
  return direct+people
}
export function effectiveHeadcount(kind:'maquinas'|'maoObra',resource:CapacityResource,collaborators:Collaborator[]) {
  if(kind==='maquinas') return Math.max(0,resource.quantidade)
  const members = collaborators.filter(c=>c.equipeId===resource.id)
  return members.length ? members.filter(c=>c.ativo).length : Math.max(0,resource.quantidade)
}
export function capacityForDate(
  resource:CapacityResource,kind:'maquinas'|'maoObra',date:string,
  collaborators:Collaborator[],unavailable:ResourceUnavailability[],shift:Shift='integral',
) {
  const count = Math.max(0,effectiveHeadcount(kind,resource,collaborators)-
    unavailableCount(kind,resource.id,date,unavailable,collaborators))
  return resourceDailyHours(resource,date,shift)*count*Math.max(0,Math.min(100,resource.eficiencia))/100
}
export function capacityForWeek(
  resource:CapacityResource,kind:'maquinas'|'maoObra',weekStart:string,
  collaborators:Collaborator[],unavailable:ResourceUnavailability[],
) {
  return businessDays(weekStart,7).reduce((s,date)=>s+capacityForDate(resource,kind,date,collaborators,unavailable),0)
}
export function resourceForTask(
  kind:'maquinas'|'maoObra',task:ProductionOperationTask,resources:CapacityResource[],
  allocation?:OperationSchedule,legacy?:LegacySchedule,
) {
  if (kind==='maoObra') return allocation ? allocation.equipeId : legacy?.equipeId || task.equipeId || task.operacao.equipeId || ''
  const provided = allocation ? allocation.maquinaId : legacy?.maquinaId || task.operacao.maquinaId
  if (provided) return provided
  // Compatibilidade com Fichas Técnicas já publicadas que gravam somente o nome.
  return resources.find(r=>normalizeResourceName(r.nome)===normalizeResourceName(task.operacao.maquina||''))?.id||''
}
export function buildOperationLoads(
  orders:ProductionOrderRecord[],balances:OperationBalance[],
  allocations:OperationSchedule[],machines:CapacityResource[],teams:CapacityResource[],
  legacy:LegacySchedule[]=[],
): LoadRecord[] {
  const plans = new Map(allocations.filter(p=>!p.excluido).map(p=>[p.taskId,p]))
  const old = new Map(legacy.filter(p=>!p.excluido).map(p=>[p.opId,p]))
  return orders.filter(o=>!o.excluido && !['rascunho','cancelada','concluida'].includes(o.status))
    .flatMap(order=>(order.operacoes||[]).map(task=>{
      const quantity=Math.max(0,Number(order.itens.find(i=>i.id===task.itemId)?.quantidadeTotal||0))
      const balance=findBalance(balances,task.id)
      const good=balance?Math.max(0,Number(balance.boas)||0):task.status==='concluida'?quantity:0
      const remaining=Math.max(0,quantity-good)
      const standard=Number(task.operacao.tempoPadraoMin)
      const hasTime=task.operacao.tempoPadraoMin!=null && Number.isFinite(standard) && standard>0
      const plan=plans.get(task.id)
      const fallback=old.get(order.id)
      return {
        opId:order.id,opNumero:order.numero,taskId:task.id,
        operacao:task.operacao.nome,produto:task.produtoDescricao,
        data:plan?.data||fallback?.data||'',
        turno:plan?.turno||'integral' as Shift,
        equipeId:resourceForTask('maoObra',task,teams,plan,fallback),
        maquinaId:resourceForTask('maquinas',task,machines,plan,fallback),
        pendente:remaining,horas:hasTime?remaining*standard/60:0,
        semTempo:!hasTime,prioridade:plan?.prioridade||fallback?.prioridade||'normal' as const,
        programado:Boolean(plan || fallback),
      }
    }))
}
export type DailyLoad = {
  recursoId:string
  recursoNome:string
  data:string
  turno:Shift
  demanda:number
  capacidade:number
  excesso:number
  utilizacao:number
  tasks:number
}
export function dailyLoads(
  kind:'maquinas'|'maoObra',loads:LoadRecord[],resources:CapacityResource[],
  collaborators:Collaborator[],unavailable:ResourceUnavailability[],dateFrom:string,dateTo:string,
):DailyLoad[]{
  const cells=new Map<string,DailyLoad>()
  for(const l of loads.filter(l=>l.data && l.data>=dateFrom && l.data<=dateTo && l.pendente>0)){
    const id=kind==='maquinas'?l.maquinaId:l.equipeId
    const r=resources.find(r=>r.id===id)
    const key=[id||'unassigned',l.data,l.turno].join('|')
    let row=cells.get(key)
    if(!row){
      row={recursoId:id,recursoNome:r?.nome||'Sem recurso cadastrado',data:l.data,turno:l.turno,
        demanda:0,capacidade:r?capacityForDate(r,kind,l.data,collaborators,unavailable,l.turno):0,
        excesso:0,utilizacao:0,tasks:0}
      cells.set(key,row)
    }
    row.demanda+=l.horas;row.tasks++
    row.excesso=Math.max(0,row.demanda-row.capacidade)
    row.utilizacao=row.capacidade>0?Math.round(row.demanda/row.capacidade*100):0
  }
  return [...cells.values()].sort((a,b)=>a.data.localeCompare(b.data)||b.excesso-a.excesso)
}
export function planningAlerts(
  kind:'maquinas'|'maoObra',loads:LoadRecord[],resources:CapacityResource[],
  collaborators:Collaborator[],unavailable:ResourceUnavailability[],from:string,to:string,
){
  const alerts:string[]=[]
  for(const task of loads){
    if(task.pendente===0)continue
    if(task.semTempo) alerts.push(task.opNumero+' · '+task.operacao+': sem tempo-padrão.')
    if(!task.data)alerts.push(task.opNumero+' · '+task.operacao+': ainda sem data de programação.')
    if(!(kind==='maquinas'?task.maquinaId:task.equipeId))alerts.push(task.opNumero+' · '+task.operacao+': recurso não vinculado.')
  }
  for(const d of dailyLoads(kind,loads,resources,collaborators,unavailable,from,to)){
    if(d.demanda>d.capacidade+0.001)alerts.push(d.data+' · '+d.recursoNome+': excesso de '+(d.demanda-d.capacidade).toFixed(1)+' h.')
  }
  return alerts
}

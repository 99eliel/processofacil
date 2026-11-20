import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { CapacityResource } from '../domain/capacityEngine'
import {
  buildOperationLoads,dailyLoads,planningAlerts,forecastOperationLoads,startOfWeek,businessDays,shiftLabels,
  type Collaborator,type ResourceUnavailability,type OperationSchedule,
  type LegacySchedule,
} from '../domain/planningEngine'
import type { OperationBalance } from '../domain/progressEngine'
import type { ProductionOrderRecord } from '../domain/types'
const nh=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1})
type Props={
  kind:'maquinas'|'maoObra'
  orders:ProductionOrderRecord[]
  balances:OperationBalance[]
  allocations:OperationSchedule[]
  legacy:LegacySchedule[]
  machines:CapacityResource[]
  teams:CapacityResource[]
  collaborators:Collaborator[]
  unavailable:ResourceUnavailability[]
  week:string
  setWeek:(value:string)=>void
}
export default function CapacityTimelinePanel({
  kind,orders,balances,allocations,legacy,machines,teams,collaborators,unavailable,week,setWeek,
}:Props){
  const start=startOfWeek(week),end=businessDays(start,7).at(-1)??start
  const resources=kind==='maquinas'?machines:teams
  const loads=useMemo(()=>buildOperationLoads(orders,balances,allocations,machines,teams,legacy),
    [orders,balances,allocations,machines,teams,legacy])
  const rows=useMemo(()=>dailyLoads(kind,loads,resources,collaborators,unavailable,start,end),
    [kind,loads,resources,collaborators,unavailable,start,end])
  const alerts=useMemo(()=>planningAlerts(kind,loads,resources,collaborators,unavailable,start,end),
    [kind,loads,resources,collaborators,unavailable,start,end])
  const today=new Date()
  const localToday=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-')
  const forecast=useMemo(()=>forecastOperationLoads(loads,machines,teams,collaborators,unavailable,localToday),
    [loads,machines,teams,collaborators,unavailable,localToday])
  const deadlines=new Map(orders.map(o=>[o.id,o.prazo??'']))
  const deadlineByTask=new Map(loads.map(l=>[l.taskId,deadlines.get(l.opId)||'']))
  const predictedLate=forecast.filter(f=>f.dataPrevista && deadlineByTask.get(f.taskId) &&
    f.dataPrevista>deadlineByTask.get(f.taskId)!).length
  const notScheduled=loads.filter(l=>l.pendente>0&&!l.data).length
  const over=rows.filter(l=>l.excesso>0.001).length
  return <section className="panel capacity-chart">
    <div className="pf-section-heading"><div><span className="section-kicker">Carga por data e turno</span><h3>Calendário de capacidade</h3></div>
      <label className="pf-field-label">Semana de referência<input type="date" value={week} onChange={e=>setWeek(e.target.value)}/></label>
    </div>
    <p className="helper-text">Semana de {start.split('-').reverse().join('/')} a {end.split('-').reverse().join('/')} · {over} gargalo(s) · {notScheduled} operação(ões) sem data.</p>
    {rows.length===0?<div className="capacity-note"><AlertTriangle size={16}/> Nenhuma operação pendente foi programada nesta semana. Use a aba Programação para agendar as etapas.</div>:
      <div className="table-wrap"><table><thead><tr>
        <th>Data</th><th>Turno</th><th>{kind==='maquinas'?'Máquina':'Equipe'}</th>
        <th>Demanda</th><th>Capacidade disponível</th><th>Ocupação</th><th>Gargalo</th>
      </tr></thead><tbody>{rows.map(row=><tr key={[row.recursoId,row.data,row.turno].join('|')}>
        <td>{row.data.split('-').reverse().join('/')}</td><td>{shiftLabels[row.turno]}</td><td>{row.recursoNome}</td>
        <td>{nh(row.demanda)} h</td><td>{nh(row.capacidade)} h</td>
        <td>{row.capacidade?row.utilizacao+'%':'Sem capacidade'}</td>
        <td>{row.excesso>0.001?'Excesso '+nh(row.excesso)+' h':'—'}</td>
      </tr>)}</tbody></table></div>}
    <details className="pf-capacity-alerts"><summary>Alertas de planejamento ({alerts.length})</summary>
      {alerts.length===0?<p className="helper-text">Nenhuma pendência identificada nos registros avaliados.</p>:
        <ul>{alerts.slice(0,60).map((alert,i)=><li key={i}>{alert}</li>)}</ul>}
    </details>
    <details className="pf-capacity-alerts">
      <summary>Previsão estimada de conclusão · {predictedLate} possível(is) atraso(s)</summary>
      <p className="helper-text">Projeção aproximada da carteira ativa, por prioridade e capacidade disponível para máquina e equipe. Considera horas restantes, férias e manutenção e tenta respeitar a ordem de operações dentro da mesma OP. Não substitui programação detalhada, não garante entrega e não considera todas as dependências entre lotes.</p>
      <div className="table-wrap"><table><thead><tr><th>OP</th><th>Operação</th><th>Horas</th><th>Data estimada</th><th>Situação</th></tr></thead>
        <tbody>{forecast.slice(0,60).map(row=>{
          const deadline=deadlineByTask.get(row.taskId)||''
          const late=Boolean(row.dataPrevista&&deadline&&row.dataPrevista>deadline)
          return <tr key={row.taskId}><td>{row.opNumero}</td><td>{row.operacao}</td><td>{nh(row.horas)} h</td>
            <td>{row.dataPrevista?row.dataPrevista.split('-').reverse().join('/'):'Sem previsão'}</td>
            <td>{late?'Pode atrasar · '+deadline.split('-').reverse().join('/'):(row.dataPrevista?'Estimada':row.motivo)}</td>
          </tr>})}</tbody></table></div>
      {forecast.length>60&&<p className="helper-text">Exibindo as primeiras 60 operações da simulação.</p>}
    </details>
    <p className="helper-text">O calendário considera a data, turno, recursos ativos, colaboradores, ausências e manutenção. Um lançamento de uma operação inteira em um único dia pode gerar sobrecarga; o sistema sinaliza o gargalo, mas não divide automaticamente a operação entre vários dias.</p>
  </section>
}

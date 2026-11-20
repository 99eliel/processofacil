import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { CapacityResource } from '../domain/capacityEngine'
import {
  buildOperationLoads,dailyLoads,planningAlerts,startOfWeek,businessDays,shiftLabels,
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
}
export default function CapacityTimelinePanel({
  kind,orders,balances,allocations,legacy,machines,teams,collaborators,unavailable,
}:Props){
  const [week,setWeek]=useState(()=>new Date().toISOString().slice(0,10))
  const start=startOfWeek(week),end=businessDays(start,7).at(-1)??start
  const resources=kind==='maquinas'?machines:teams
  const loads=useMemo(()=>buildOperationLoads(orders,balances,allocations,machines,teams,legacy),
    [orders,balances,allocations,machines,teams,legacy])
  const rows=useMemo(()=>dailyLoads(kind,loads,resources,collaborators,unavailable,start,end),
    [kind,loads,resources,collaborators,unavailable,start,end])
  const alerts=useMemo(()=>planningAlerts(kind,loads,resources,collaborators,unavailable,start,end),
    [kind,loads,resources,collaborators,unavailable,start,end])
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
    <p className="helper-text">O calendário considera a data, turno, recursos ativos, colaboradores, ausências e manutenção. Um lançamento de uma operação inteira em um único dia pode gerar sobrecarga; o sistema sinaliza o gargalo, mas não divide automaticamente a operação entre vários dias.</p>
  </section>
}

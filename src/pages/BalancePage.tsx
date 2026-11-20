import { useMemo,useState } from 'react'
import { ArrowRightLeft,TriangleAlert,Users } from 'lucide-react'
import {useSystem} from '../system/SystemProvider'
import {useTenantCollection} from '../hooks/useTenantCollection'
import type {ProductionOrderRecord} from '../domain/types'
import {type CapacitySettingsRecord} from '../domain/capacityEngine'
import {type ProductionBalance} from '../firebase/productionLedger'
import {simulateBalance} from '../domain/balanceEngine'
import {
  buildOperationLoads,capacityForWeek,startOfWeek,type Collaborator,type ResourceUnavailability,
  type OperationSchedule,type LegacySchedule,
} from '../domain/planningEngine'
const fmt=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:1})
export default function BalancePage(){
  const {activeCompany}=useSystem(),empresaId=activeCompany?.id
  const orderQuery=useTenantCollection<ProductionOrderRecord>(empresaId,'ordensProducao','numero')
  const balanceQuery=useTenantCollection<ProductionBalance>(empresaId,'saldosOperacoes','taskId')
  const settingsQuery=useTenantCollection<CapacitySettingsRecord>(empresaId,'configuracoesCapacidade','tipo')
  const scheduleQuery=useTenantCollection<OperationSchedule>(empresaId,'programacaoOperacoes','opNumero')
  const olderQuery=useTenantCollection<LegacySchedule>(empresaId,'programacoes','opId')
  const peopleQuery=useTenantCollection<Collaborator>(empresaId,'colaboradores','nome')
  const unavailableQuery=useTenantCollection<ResourceUnavailability>(empresaId,'indisponibilidadesRecursos','dataInicio')
  const [orderId,setOrderId]=useState('todas')
  const [week,setWeek]=useState(()=>new Date().toISOString().slice(0,10))
  const orders=useMemo(()=>orderQuery.items.filter(o=>!o.excluido&&['liberada','em_fluxo','reprovada'].includes(o.status)),[orderQuery.items])
  const teams=settingsQuery.items.find(r=>r.id==='maoObra')?.recursos??[]
  const machines=settingsQuery.items.find(r=>r.id==='maquinas')?.recursos??[]
  const fullLoad=useMemo(()=>buildOperationLoads(orders,balanceQuery.items,scheduleQuery.items,machines,teams,olderQuery.items),
    [orders,balanceQuery.items,scheduleQuery.items,machines,teams,olderQuery.items])
  const loads=fullLoad.filter(l=>l.pendente>0&&(orderId==='todas'||l.opId===orderId))
  const capacityTeams=teams.filter(t=>t.ativo).map(t=>({
    id:t.id,nome:t.nome,capacidadeHoras:capacityForWeek(t,'maoObra',startOfWeek(week),peopleQuery.items,unavailableQuery.items),
  }))
  const tasks=loads.map(l=>({id:l.taskId,nome:l.opNumero+' · '+l.operacao,
    horas:l.horas,equipeId:l.equipeId||undefined}))
  const simulation=simulateBalance(tasks,capacityTeams)
  const totalDemand=loads.reduce((v,l)=>v+l.horas,0)
  const totalCapacity=capacityTeams.reduce((v,t)=>v+t.capacidadeHoras,0)
  const uncalculated=loads.filter(l=>l.semTempo).length
  const pending=simulation.assignments.filter(a=>a.tipo==='pendente').length
  const error=[orderQuery,balanceQuery,settingsQuery,scheduleQuery,olderQuery,peopleQuery,unavailableQuery].map(q=>q.error).find(Boolean)
  if([orderQuery,balanceQuery,settingsQuery,scheduleQuery,olderQuery,peopleQuery,unavailableQuery].some(q=>q.loading))
    return <div className="loading-panel">Calculando distribuição entre equipes...</div>
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Simulação de recursos</span>
      <h2>Balanceamento de equipes</h2><p>Compare várias OPs, respeitando as atribuições atuais e a disponibilidade semanal das equipes.</p>
    </div></section>
    {error&&<div className="form-error page-message">{error}</div>}
    <section className="panel pf-form-card">
      <div className="pf-two-columns">
        <label>Ordens analisadas<select value={orderId} onChange={e=>setOrderId(e.target.value)}>
          <option value="todas">Todas as OPs ativas</option>{orders.map(o=><option key={o.id} value={o.id}>{o.numero}</option>)}</select></label>
        <label>Semana de referência<input type="date" value={week} onChange={e=>setWeek(e.target.value)}/></label>
      </div>
      {teams.length===0&&<div className="capacity-note"><Users size={17}/> Cadastre equipes em Planejamento → Carga Mão de Obra.</div>}
      {uncalculated>0&&<div className="capacity-note"><TriangleAlert size={17}/> {uncalculated} operação(ões) sem tempo-padrão foram ignoradas no cálculo de horas.</div>}
      <div className="pf-op-summary">
        <div><small>Demanda restante</small><strong>{fmt(totalDemand)} h</strong></div>
        <div><small>Capacidade desta semana</small><strong>{fmt(totalCapacity)} h</strong></div>
        <div><small>Equipes cadastradas</small><strong>{capacityTeams.length}</strong></div>
        <div><small>Etapas sem equipe válida</small><strong>{pending}</strong></div>
      </div>
      <p className="helper-text"><ArrowRightLeft size={15}/> As equipes já definidas na programação ou no Passaporte são preservadas. As sugestões são simuladas, não alteram a OP.
        O algoritmo não verifica competências, sequência entre operações nem compatibilidade de máquinas e não distribui carga automaticamente por dia.</p>
    </section>
    <section className="panel pf-form-card"><h3>Distribuição sugerida por equipe</h3>
      <div className="pf-table-scroll"><table className="pf-data-table"><thead>
        <tr><th>Equipe</th><th>Disponibilidade semanal</th><th>Demanda</th><th>Ocupação</th><th>Excesso</th></tr>
      </thead><tbody>{simulation.teams.map(t=><tr key={t.id}><td><strong>{t.nome}</strong></td>
        <td>{fmt(t.capacidadeHoras)} h</td><td>{fmt(t.planejadaHoras)} h</td><td>{t.ocupacao}%</td>
        <td>{t.excedenteHoras>0?fmt(t.excedenteHoras)+' h':'—'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="panel pf-form-card"><h3>Operações e equipes</h3>
      <div className="pf-table-scroll"><table className="pf-data-table"><thead>
        <tr><th>Operação</th><th>Horas restantes</th><th>Equipe</th><th>Origem</th></tr>
      </thead><tbody>{simulation.assignments.map(t=><tr key={t.taskId}>
        <td>{t.tarefa}</td><td>{fmt(t.horas)} h</td><td>{t.equipeNome}</td>
        <td>{t.tipo==='fixo'?'Definida na OP / Passaporte':t.tipo==='sugestao'?'Sugestão':'Pendente'}</td></tr>)}</tbody></table></div>
      {tasks.length===0&&<p className="helper-text">Nenhuma operação pendente nas OPs selecionadas.</p>}
    </section>
  </div>
}

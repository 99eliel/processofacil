import { useState } from 'react'
import CapacityPage from './CapacityPage'
import TimeStudiesPage from './TimeStudiesPage'
import BalancePage from './BalancePage'
import OperationProgrammingPage from './OperationProgrammingPage'
import WorkforcePage from './WorkforcePage'
import AvailabilityPage from './AvailabilityPage'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { LegacySchedule } from '../domain/planningEngine'

type Tab='programacao'|'maquinas'|'equipes'|'colaboradores'|'disponibilidade'|'cronometragem'|'balanceamento'
export default function PlanningPage({notify}:{notify:(msg:string)=>void}){
  const [tab,setTab]=useState<Tab>('programacao')
  const [advanced,setAdvanced]=useState(false)
  const {activeCompany}=useSystem()
  const previous=useTenantCollection<LegacySchedule>(activeCompany?.id,'programacoes','opId')
  const tabs:{id:Tab;label:string}[]=[
    {id:'programacao',label:'Programação'},
    {id:'maquinas',label:'Carga Máquina'},
    {id:'equipes',label:'Carga Mão de Obra'},
    {id:'colaboradores',label:'Colaboradores'},
    {id:'disponibilidade',label:'Disponibilidade'},
  ]
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Planejamento e Controle da Produção</span>
      <h2>Planejamento integrado</h2><p>Programação por operação, recursos e capacidade considerando produção real e ausências.</p>
    </div></section>
    <div className="pf-planning-caption">ROTINA DA PRODUÇÃO</div>
    <div className="pf-tabbar pf-planning-nav">
      {tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      <button className={['cronometragem','balanceamento'].includes(tab)?'active':''} onClick={()=>setAdvanced(v=>!v)}>
        Ferramentas técnicas {advanced?'−':'+'}</button>
    </div>
    {(advanced||['cronometragem','balanceamento'].includes(tab))&&<div className="pf-tools-nav">
      <span>Ferramentas opcionais</span>
      <button className={tab==='cronometragem'?'active':''} onClick={()=>setTab('cronometragem')}>Cronometragem</button>
      <button className={tab==='balanceamento'?'active':''} onClick={()=>setTab('balanceamento')}>Balanceamento</button>
      <small>As simulações não alteram automaticamente a Ficha Técnica nem as OPs.</small>
    </div>}
    {tab==='programacao'&&<OperationProgrammingPage notify={notify}/>}
    {tab==='maquinas'&&<CapacityPage kind="maquinas" notify={notify}/>}
    {tab==='equipes'&&<CapacityPage kind="maoObra" notify={notify}/>}
    {tab==='colaboradores'&&<WorkforcePage notify={notify}/>}
    {tab==='disponibilidade'&&<AvailabilityPage notify={notify}/>}
    {tab==='cronometragem'&&<TimeStudiesPage notify={notify}/>}
    {tab==='balanceamento'&&<BalancePage/>}
    {tab==='programacao'&&previous.items.some(p=>!p.excluido)&&
      <details className="panel pf-form-card">
        <summary>Programações antigas por OP ({previous.items.filter(p=>!p.excluido).length})</summary>
        <p className="helper-text">Os registros antigos continuam válidos como fallback nas operações ainda não reprogramadas. Para maior precisão, programe cada operação acima; novos cadastros não sobrescrevem os registros antigos.</p>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead>
          <tr><th>OP</th><th>Data</th><th>Prioridade</th></tr>
        </thead><tbody>{previous.items.filter(p=>!p.excluido).map(p=><tr key={p.id}>
          <td>{p.opId}</td><td>{p.data.split('-').reverse().join('/')}</td><td>{p.prioridade||'normal'}</td>
        </tr>)}</tbody></table></div>
      </details>}
  </div>
}

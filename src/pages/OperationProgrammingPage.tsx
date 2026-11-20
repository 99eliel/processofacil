import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Pencil, Save, Trash2, AlertTriangle } from 'lucide-react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord, ProductionOperationTask } from '../domain/types'
import { type CapacitySettingsRecord } from '../domain/capacityEngine'
import { type ProductionBalance } from '../firebase/productionLedger'
import {
  buildOperationLoads, type OperationSchedule, type LegacySchedule,
  shiftLabels, type Shift, resourceForTask,
} from '../domain/planningEngine'

type Props={notify:(msg:string)=>void}
const initialDraft={data:'',turno:'integral' as Shift,equipeId:'',maquinaId:'',prioridade:'normal' as const,observacao:''}
type Draft=typeof initialDraft | Omit<OperationSchedule,'id'|'opId'|'opNumero'|'taskId'|'itemId'|'excluido'>
function formatDate(v:string){return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):v}
export default function OperationProgrammingPage({notify}:Props){
  const {activeCompany,user}=useSystem()
  const empresaId=activeCompany?.id
  const orderQuery=useTenantCollection<ProductionOrderRecord>(empresaId,'ordensProducao','numero')
  const allocQuery=useTenantCollection<OperationSchedule>(empresaId,'programacaoOperacoes','opNumero')
  const legacyQuery=useTenantCollection<LegacySchedule>(empresaId,'programacoes','opId')
  const settingsQuery=useTenantCollection<CapacitySettingsRecord>(empresaId,'configuracoesCapacidade','tipo')
  const balanceQuery=useTenantCollection<ProductionBalance>(empresaId,'saldosOperacoes','taskId')
  const [orderId,setOrderId]=useState('')
  const [taskId,setTaskId]=useState('')
  const [draft,setDraft]=useState<Draft>(initialDraft)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [hideComplete,setHideComplete]=useState(true)
  const editorRef=useRef<HTMLElement|null>(null)
  const orders=useMemo(()=>orderQuery.items.filter(o=>!o.excluido&&['liberada','em_fluxo','reprovada'].includes(o.status)),[orderQuery.items])
  const order=orders.find(o=>o.id===orderId)??orders[0]
  const teams=settingsQuery.items.find(c=>c.id==='maoObra')?.recursos??[]
  const machines=settingsQuery.items.find(c=>c.id==='maquinas')?.recursos??[]
  const loads=useMemo(()=>buildOperationLoads(orders,balanceQuery.items,allocQuery.items,machines,teams,legacyQuery.items),
    [orders,balanceQuery.items,allocQuery.items,machines,teams,legacyQuery.items])
  const rows=loads.filter(l=>l.opId===order?.id && (!hideComplete||l.pendente>0))
  const task=order?.operacoes.find(t=>t.id===taskId)
  const allocated=allocQuery.items.find(a=>a.taskId===task?.id&&!a.excluido)
  const legacy=legacyQuery.items.find(a=>a.opId===order?.id&&!a.excluido)
  const prefill=(record:ProductionOperationTask)=>{
    const saved=allocQuery.items.find(p=>p.taskId===record.id&&!p.excluido)
    setTaskId(record.id)
    setDraft({
      data:saved?.data||legacy?.data||'',
      turno:saved?.turno||'integral',
      equipeId:resourceForTask('maoObra',record,teams,saved,legacy),
      maquinaId:resourceForTask('maquinas',record,machines,saved,legacy),
      prioridade:saved?.prioridade||legacy?.prioridade||'normal',
      observacao:saved?.observacao||'',
    })
    setError('')
    requestAnimationFrame(()=>editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))
  }
  const save=async()=>{
    if(!empresaId||!user||!order||!task||busy)return
    if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.data)||Number.isNaN(Date.parse(draft.data+'T12:00:00Z'))){
      setError('Escolha uma data válida para programar a operação.');return
    }
    if(draft.equipeId&&!teams.some(t=>t.id===draft.equipeId&&t.ativo)){
      setError('A equipe selecionada não está ativa ou não existe.');return
    }
    if(draft.maquinaId&&!machines.some(m=>m.id===draft.maquinaId&&m.ativo)){
      setError('A máquina selecionada não está ativa ou não existe.');return
    }
    setBusy(true);setError('')
    try{
      const batch=writeBatch(db)
      batch.set(doc(db,'empresas',empresaId,'programacaoOperacoes',task.id),{
        ...draft,opId:order.id,opNumero:order.numero,taskId:task.id,itemId:task.itemId,
        excluido:false,alteradoEm:serverTimestamp(),alteradoPor:user.uid,
      })
      batch.set(doc(collection(db,'empresas',empresaId,'auditoria')),{
        entidade:'programacao_operacao',entidadeId:task.id,acao:'programada',
        resumo:order.numero+' · '+task.operacao.nome+' · '+draft.data,
        uid:user.uid,em:serverTimestamp(),
      })
      await batch.commit()
      setTaskId('');notify('Operação programada; as cargas foram recalculadas.')
    }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar a programação.')}
    finally{setBusy(false)}
  }
  const cancel=async()=>{
    if(!empresaId||!user||!task||!allocated||busy)return
    if(!window.confirm('Retirar somente esta operação da programação? A OP será preservada.'))return
    setBusy(true);setError('')
    try{
      const batch=writeBatch(db)
      batch.set(doc(db,'empresas',empresaId,'programacaoOperacoes',task.id),{
        excluido:true,alteradoEm:serverTimestamp(),alteradoPor:user.uid,
      },{merge:true})
      batch.set(doc(collection(db,'empresas',empresaId,'auditoria')),{
        entidade:'programacao_operacao',entidadeId:task.id,acao:'removida',
        resumo:order?.numero+' · '+task.operacao.nome,uid:user.uid,em:serverTimestamp(),
      })
      await batch.commit();setTaskId('');notify('Programação da operação removida.')
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível cancelar a programação.')}
    finally{setBusy(false)}
  }
  if(orderQuery.loading||allocQuery.loading||balanceQuery.loading||settingsQuery.loading||legacyQuery.loading)
    return <div className="loading-panel">Carregando programação por operação...</div>
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Programação detalhada</span><h2>Programar operações</h2>
      <p>Uma OP pode utilizar várias máquinas e equipes. Defina a data e o turno de cada etapa sem alterar a Ficha Técnica.</p>
    </div></section>
    {(error||orderQuery.error||allocQuery.error||legacyQuery.error||settingsQuery.error||balanceQuery.error)&&
      <div className="form-error page-message" role="alert">{error||orderQuery.error||allocQuery.error||legacyQuery.error||settingsQuery.error||balanceQuery.error}</div>}
    <section className="panel pf-form-card">
      <label className="pf-field-label">Ordem de produção
        <select value={order?.id||''} onChange={e=>{setOrderId(e.target.value);setTaskId('')}}>
          {orders.map(o=><option key={o.id} value={o.id}>{o.numero} · {o.itens.map(i=>i.produtoDescricao).join(', ')}</option>)}
        </select>
      </label>
      {!order&&<p className="helper-text">Não há OPs liberadas. Crie e libere uma OP na área Ordens de Produção.</p>}
      {legacy&&<div className="capacity-note"><AlertTriangle size={17}/> Esta OP tem uma programação antiga com recursos gerais.
        As novas atribuições por operação têm prioridade. As etapas não configuradas mantêm a atribuição legada até serem reprogramadas.</div>}
      {task&&<section className="pf-inline-editor" ref={editorRef}>
        <div className="pf-section-heading"><h3>Programar: {task.operacao.nome}</h3>
          <button className="secondary-button compact" onClick={()=>setTaskId('')}>Fechar</button></div>
        <p className="helper-text">Produto {task.produtoDescricao}. A máquina e a equipe sugeridas vieram do Passaporte; você pode alterá-las para esta OP.</p>
        <div className="pf-two-columns">
          <label>Data planejada *<input type="date" value={draft.data} onChange={e=>setDraft({...draft,data:e.target.value})}/></label>
          <label>Turno<select value={draft.turno} onChange={e=>setDraft({...draft,turno:e.target.value as Shift})}>
            {Object.entries(shiftLabels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <label>Equipe<select value={draft.equipeId} onChange={e=>setDraft({...draft,equipeId:e.target.value})}>
            <option value="">Sem equipe atribuída</option>{teams.filter(t=>t.ativo||t.id===draft.equipeId).map(t=>
              <option key={t.id} value={t.id}>{t.nome}{t.ativo?'':' (inativa)'}</option>)}</select></label>
          <label>Máquina<select value={draft.maquinaId} onChange={e=>setDraft({...draft,maquinaId:e.target.value})}>
            <option value="">Sem máquina atribuída</option>{machines.filter(t=>t.ativo||t.id===draft.maquinaId).map(t=>
              <option key={t.id} value={t.id}>{t.nome}{t.ativo?'':' (inativa)'}</option>)}</select></label>
          <label>Prioridade<select value={draft.prioridade} onChange={e=>setDraft({...draft,prioridade:e.target.value as OperationSchedule['prioridade']})}>
            <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
          <label>Observações<input value={draft.observacao} onChange={e=>setDraft({...draft,observacao:e.target.value})}/></label>
        </div>
        <div className="pf-actions">
          {allocated&&<button className="secondary-button" disabled={busy} onClick={()=>void cancel()}><Trash2 size={15}/> Remover programação</button>}
          <button className="primary-button" disabled={busy} onClick={()=>void save()}><Save size={15}/> {busy?'Salvando...':'Salvar operação'}</button>
        </div>
      </section>}
    </section>
    <section className="panel pf-form-card">
      <div className="pf-section-heading"><h3>Etapas da OP</h3>
        <label className="pf-inline-checkbox"><input type="checkbox" checked={hideComplete} onChange={e=>setHideComplete(e.target.checked)}/> Mostrar somente pendentes</label></div>
      {rows.length===0&&<p className="helper-text">Não há operações pendentes para esta seleção.</p>}
      <div className="pf-table-scroll"><table className="pf-data-table"><thead>
        <tr><th>Produto / operação</th><th>Quantidade restante</th><th>Demanda</th><th>Data / turno</th><th>Equipe</th><th>Máquina</th><th>Ação</th></tr>
      </thead><tbody>{rows.map(row=><tr key={row.taskId}>
        <td><strong>{row.produto}</strong><div>{row.operacao}</div></td>
        <td>{row.pendente} un.</td><td>{row.semTempo?'Sem tempo':row.horas.toLocaleString('pt-BR',{maximumFractionDigits:1})+' h'}</td>
        <td>{row.data?formatDate(row.data)+' · '+shiftLabels[row.turno]:'Não programada'}</td>
        <td>{teams.find(t=>t.id===row.equipeId)?.nome||'Não atribuída'}</td>
        <td>{machines.find(m=>m.id===row.maquinaId)?.nome||'Não atribuída'}</td>
        <td><button className="secondary-button compact" onClick={()=>{const current=order?.operacoes.find(t=>t.id===row.taskId);if(current)prefill(current)}}><Pencil size={14}/> {row.programado?'Editar':'Programar'}</button></td>
      </tr>)}</tbody></table></div>
    </section>
    <section className="panel pf-form-card"><h3>Como a programação funciona</h3>
      <p className="helper-text">As quantidades restantes e os tempos-padrão vêm da OP e do Passaporte congelado.
        Atribuições por operação alimentam Carga Máquina, Carga Mão de Obra e balanceamento. Configurações de folgas, ausências e manutenção são aplicadas nas visões de capacidade.
        Uma data só representa previsão; sobrecarga e operações anteriores devem ser conferidas.</p></section>
  </div>
}

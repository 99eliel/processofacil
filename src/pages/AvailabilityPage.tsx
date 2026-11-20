import { useState } from 'react'
import { doc,collection,writeBatch,serverTimestamp } from 'firebase/firestore'
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react'
import { db } from '../firebase/config'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { useSystem } from '../system/SystemProvider'
import { type CapacitySettingsRecord } from '../domain/capacityEngine'
import { type Collaborator,type ResourceUnavailability,validDate } from '../domain/planningEngine'
type Draft={tipo:'maquinas'|'maoObra'|'colaborador';recursoId:string;dataInicio:string;dataFim:string;quantidade:number;motivo:string}
const initial:Draft={tipo:'maquinas',recursoId:'',dataInicio:'',dataFim:'',quantidade:1,motivo:''}
export default function AvailabilityPage({notify}:{notify:(v:string)=>void}){
  const {user,activeCompany}=useSystem(),empresaId=activeCompany?.id
  const settings=useTenantCollection<CapacitySettingsRecord>(empresaId,'configuracoesCapacidade','tipo')
  const people=useTenantCollection<Collaborator>(empresaId,'colaboradores','nome')
  const records=useTenantCollection<ResourceUnavailability>(empresaId,'indisponibilidadesRecursos','dataInicio')
  const [draft,setDraft]=useState<Draft>(initial),[editing,setEditing]=useState(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const machines=settings.items.find(x=>x.id==='maquinas')?.recursos??[]
  const teams=settings.items.find(x=>x.id==='maoObra')?.recursos??[]
  const choices=draft.tipo==='maquinas'?machines:draft.tipo==='maoObra'?teams:people.items
  const names=new Map([...machines,...teams,...people.items].map(r=>[r.id,r.nome]))
  const save=async()=>{
    if(!empresaId||!user||busy)return
    if(!draft.recursoId||!draft.motivo.trim()||!validDate(draft.dataInicio)||!validDate(draft.dataFim)||draft.dataFim<draft.dataInicio){
      setError('Informe recurso, período válido e motivo da indisponibilidade.');return
    }
    if(!Number.isSafeInteger(draft.quantidade)||draft.quantidade<1){setError('Quantidade indisponível precisa ser inteira e maior que zero.');return}
    if(!choices.some(r=>r.id===draft.recursoId)){setError('Recurso inválido.');return}
    const selected=choices.find(r=>r.id===draft.recursoId)
    if(draft.tipo!=='colaborador'&&selected&&'quantidade' in selected && draft.quantidade>Number(selected.quantidade)){
      setError('A indisponibilidade não pode superar a quantidade configurada do recurso.');return
    }
    setBusy(true);setError('')
    try{
      const batch=writeBatch(db),ref=doc(collection(db,'empresas',empresaId,'indisponibilidadesRecursos'))
      batch.set(ref,{...draft,quantidade:draft.tipo==='colaborador'?1:draft.quantidade,
        excluido:false,criadoEm:serverTimestamp(),criadoPor:user.uid})
      batch.set(doc(collection(db,'empresas',empresaId,'auditoria')),{
        entidade:'indisponibilidade',entidadeId:ref.id,acao:'criada',
        resumo:draft.motivo+' · '+names.get(draft.recursoId),uid:user.uid,em:serverTimestamp(),
      })
      await batch.commit();setDraft(initial);setEditing(false);notify('Indisponibilidade registrada; capacidade recalculada.')
    }catch(e){setError(e instanceof Error?e.message:'Erro ao registrar indisponibilidade.')}
    finally{setBusy(false)}
  }
  const remove=async(row:ResourceUnavailability)=>{
    if(!empresaId||!user||busy||!window.confirm('Cancelar esta indisponibilidade? O histórico será preservado.'))return
    setBusy(true);setError('')
    try{
      const batch=writeBatch(db)
      batch.set(doc(db,'empresas',empresaId,'indisponibilidadesRecursos',row.id),{excluido:true,
        alteradoEm:serverTimestamp(),alteradoPor:user.uid},{merge:true})
      batch.set(doc(collection(db,'empresas',empresaId,'auditoria')),{entidade:'indisponibilidade',
        entidadeId:row.id,acao:'cancelada',resumo:row.motivo,uid:user.uid,em:serverTimestamp()})
      await batch.commit();notify('Indisponibilidade cancelada.')
    }catch(e){setError(e instanceof Error?e.message:'Erro ao cancelar.')}
    finally{setBusy(false)}
  }
  if(settings.loading||people.loading||records.loading)return <div className="loading-panel">Carregando disponibilidade...</div>
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Calendário de recursos</span>
      <h2>Folgas, férias e manutenção</h2><p>Registre os períodos em que pessoas, equipes ou máquinas estarão indisponíveis.</p></div>
      <button className="primary-button compact" onClick={()=>{setEditing(true);setError('')}}><Plus size={15}/> Registrar ausência</button></section>
    {(error||settings.error||people.error||records.error)&&<div className="form-error page-message" role="alert">{error||settings.error||people.error||records.error}</div>}
    {editing&&<section className="panel pf-form-card pf-schedule-editor">
      <h3>Nova indisponibilidade</h3>
      <div className="pf-two-columns">
        <label>Tipo<select value={draft.tipo} onChange={e=>setDraft({...draft,tipo:e.target.value as Draft['tipo'],recursoId:'',quantidade:1})}>
          <option value="maquinas">Máquina</option><option value="maoObra">Equipe</option>
          <option value="colaborador">Colaborador (férias, falta etc.)</option></select></label>
        <label>Recurso<select value={draft.recursoId} onChange={e=>setDraft({...draft,recursoId:e.target.value})}>
          <option value="">Selecionar...</option>{choices.map(row=><option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
        <label>Início *<input type="date" value={draft.dataInicio} onChange={e=>setDraft({...draft,dataInicio:e.target.value})}/></label>
        <label>Fim *<input type="date" min={draft.dataInicio||undefined} value={draft.dataFim} onChange={e=>setDraft({...draft,dataFim:e.target.value})}/></label>
        {draft.tipo!=='colaborador'&&<label>Quantidade de recursos indisponíveis<input type="number" min="1" step="1"
          value={draft.quantidade} onChange={e=>setDraft({...draft,quantidade:Number(e.target.value)})}/></label>}
        <label>Motivo *<input value={draft.motivo} onChange={e=>setDraft({...draft,motivo:e.target.value})}
          placeholder="Ex.: manutenção, férias, folga, ausência"/></label>
      </div>
      <p className="helper-text">A indisponibilidade reduz a capacidade nos dias informados. A programação das OPs é mantida e ficará sinalizada caso haja sobrecarga.</p>
      <div className="pf-actions"><button className="secondary-button" onClick={()=>setEditing(false)}>Cancelar</button>
        <button className="primary-button" disabled={busy} onClick={()=>void save()}><Save size={15}/> Salvar</button></div>
    </section>}
    <section className="panel pf-form-card"><h3>Períodos registrados</h3>
      {records.items.filter(r=>!r.excluido).length===0&&<div className="empty-state"><CalendarOff size={24}/><strong>Sem indisponibilidades</strong>
        <span>Não há férias, faltas ou manutenções cadastradas.</span></div>}
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr>
        <th>Recurso</th><th>Tipo</th><th>Período</th><th>Quantidade</th><th>Motivo</th><th>Ação</th>
      </tr></thead><tbody>{records.items.filter(r=>!r.excluido).map(r=><tr key={r.id}>
        <td><strong>{names.get(r.recursoId)||r.recursoId}</strong></td><td>{r.tipo==='colaborador'?'Colaborador':r.tipo==='maquinas'?'Máquina':'Equipe'}</td>
        <td>{r.dataInicio.split('-').reverse().join('/')} até {r.dataFim.split('-').reverse().join('/')}</td>
        <td>{r.quantidade}</td><td>{r.motivo}</td>
        <td><button className="secondary-button compact" disabled={busy} onClick={()=>void remove(r)}><Trash2 size={14}/> Cancelar</button></td>
      </tr>)}</tbody></table></div>
    </section>
  </div>
}

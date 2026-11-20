import { useState } from 'react'
import { doc,collection,writeBatch,serverTimestamp } from 'firebase/firestore'
import { Pencil, Plus, Save, Users } from 'lucide-react'
import { db } from '../firebase/config'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { type CapacitySettingsRecord } from '../domain/capacityEngine'
import { type Collaborator, effectiveHeadcount } from '../domain/planningEngine'
const empty={nome:'',matricula:'',equipeId:'',ativo:true}
export default function WorkforcePage({notify}:{notify:(v:string)=>void}){
  const {user,activeCompany}=useSystem()
  const empresaId=activeCompany?.id
  const people=useTenantCollection<Collaborator>(empresaId,'colaboradores','nome')
  const resources=useTenantCollection<CapacitySettingsRecord>(empresaId,'configuracoesCapacidade','tipo')
  const teams=resources.items.find(x=>x.id==='maoObra')?.recursos??[]
  const [selected,setSelected]=useState('')
  const [form,setForm]=useState(empty)
  const [editing,setEditing]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const openNew=()=>{setSelected('');setForm({...empty});setEditing(true);setError('')}
  const open=(p:Collaborator)=>{setSelected(p.id);setForm({nome:p.nome,matricula:p.matricula??'',equipeId:p.equipeId??'',ativo:p.ativo});setEditing(true);setError('')}
  const save=async()=>{
    if(!empresaId||!user||busy)return
    if(!form.nome.trim()){setError('Informe o nome do colaborador.');return}
    if(form.equipeId&&!teams.some(x=>x.id===form.equipeId&&x.ativo)){setError('Selecione uma equipe ativa.');return}
    setBusy(true);setError('')
    try{
      const id=selected||crypto.randomUUID(),batch=writeBatch(db)
      batch.set(doc(db,'empresas',empresaId,'colaboradores',id),{
        ...form,nome:form.nome.trim(),matricula:form.matricula.trim(),
        alteradoEm:serverTimestamp(),alteradoPor:user.uid,
      },{merge:true})
      batch.set(doc(collection(db,'empresas',empresaId,'auditoria')),{
        entidade:'colaborador',entidadeId:id,acao:selected?'alterado':'criado',
        resumo:form.nome.trim(),uid:user.uid,em:serverTimestamp(),
      })
      await batch.commit();setEditing(false);notify('Colaborador atualizado; capacidade da equipe recalculada.')
    }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar colaborador.')}
    finally{setBusy(false)}
  }
  if(people.loading||resources.loading)return <div className="loading-panel">Carregando pessoas e equipes...</div>
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Recursos humanos da produção</span>
      <h2>Colaboradores e equipes</h2><p>Quando houver colaboradores vinculados, a capacidade utiliza a quantidade de pessoas ativas da equipe.</p></div>
      <button className="primary-button compact" onClick={openNew}><Plus size={15}/> Novo colaborador</button>
    </section>
    {(error||people.error||resources.error)&&<div className="form-error page-message" role="alert">{error||people.error||resources.error}</div>}
    <section className="panel pf-form-card"><h3>Equipes e quantidade disponível</h3>
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>Equipe</th><th>Pessoas cadastradas</th><th>Ativas</th><th>Capacidade considerada</th></tr></thead>
        <tbody>{teams.map(t=><tr key={t.id}><td>{t.nome}</td>
          <td>{people.items.filter(p=>p.equipeId===t.id).length}</td>
          <td>{people.items.filter(p=>p.equipeId===t.id&&p.ativo).length}</td>
          <td>{effectiveHeadcount('maoObra',t,people.items)} pessoa(s)
            {people.items.some(p=>p.equipeId===t.id)?' · cadastro nominal':' · quantidade manual'}</td>
        </tr>)}</tbody></table></div>
      {teams.length===0&&<p className="helper-text">Cadastre sua primeira equipe na aba Equipes.</p>}
    </section>
    {editing&&<section className="panel pf-form-card pf-schedule-editor">
      <h3>{selected?'Editar colaborador':'Novo colaborador'}</h3>
      <div className="pf-two-columns">
        <label>Nome *<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
        <label>Matrícula (opcional)<input value={form.matricula} onChange={e=>setForm({...form,matricula:e.target.value})}/></label>
        <label>Equipe<select value={form.equipeId} onChange={e=>setForm({...form,equipeId:e.target.value})}>
          <option value="">Sem equipe</option>{teams.filter(t=>t.ativo||t.id===form.equipeId).map(t=>
            <option value={t.id} key={t.id}>{t.nome}</option>)}</select></label>
        <label>Situação<select value={form.ativo?'ativo':'inativo'} onChange={e=>setForm({...form,ativo:e.target.value==='ativo'})}>
          <option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
      </div>
      <div className="pf-actions"><button className="secondary-button" onClick={()=>setEditing(false)}>Cancelar</button>
        <button className="primary-button" disabled={busy} onClick={()=>void save()}><Save size={15}/> Salvar colaborador</button></div>
    </section>}
    <section className="panel pf-form-card"><h3>Todos os colaboradores</h3>
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>Nome</th><th>Matrícula</th><th>Equipe</th><th>Situação</th><th>Ação</th></tr></thead>
        <tbody>{people.items.map(p=><tr key={p.id}><td><strong>{p.nome}</strong></td><td>{p.matricula||'—'}</td>
          <td>{teams.find(t=>t.id===p.equipeId)?.nome||'Não atribuída'}</td><td>{p.ativo?'Ativo':'Inativo'}</td>
          <td><button className="secondary-button compact" onClick={()=>open(p)}><Pencil size={14}/> Editar</button></td></tr>)}</tbody></table></div>
      {people.items.length===0&&<p className="helper-text">Nenhum colaborador cadastrado.</p>}
    </section>
  </div>
}

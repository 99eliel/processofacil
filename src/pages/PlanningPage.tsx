import { useMemo, useState } from 'react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { CalendarRange, Pencil, Plus, Save, Trash2, Users } from 'lucide-react'
import { db } from '../firebase/config'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { useSystem } from '../system/SystemProvider'
import CapacityPage from './CapacityPage'
import TimeStudiesPage from './TimeStudiesPage'
import type { ProductionOrderRecord } from '../domain/types'
import type { CapacitySettingsRecord } from '../domain/capacityEngine'

type PlanningTab = 'programacao' | 'maquinas' | 'equipes' | 'colaboradores' | 'cronometragem'
type Schedule = {
  id: string
  opId: string
  opNumero: string
  data: string
  prioridade: 'normal' | 'alta' | 'urgente'
  equipeId: string
  maquinaId: string
  observacao: string
  excluido?: boolean
}
type Collaborator = {
  id: string
  nome: string
  matricula: string
  equipeId: string
  ativo: boolean
}
type ScheduleDraft = Pick<Schedule, 'opId' | 'data' | 'prioridade' | 'equipeId' | 'maquinaId' | 'observacao'>
const emptySchedule: ScheduleDraft = { opId: '', data: '', prioridade: 'normal', equipeId: '', maquinaId: '', observacao: '' }
const emptyWorker = { nome: '', matricula: '', equipeId: '', ativo: true }

export default function PlanningPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id
  const [tab, setTab] = useState<PlanningTab>('programacao')
  const orderQuery = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const scheduleQuery = useTenantCollection<Schedule>(empresaId, 'programacoes', 'opNumero')
  const resourcesQuery = useTenantCollection<CapacitySettingsRecord>(empresaId, 'configuracoesCapacidade', 'tipo')
  const peopleQuery = useTenantCollection<Collaborator>(empresaId, 'colaboradores', 'nome')
  const orders = useMemo(
    () => orderQuery.items.filter((o) => !o.excluido && ['liberada', 'em_fluxo', 'reprovada'].includes(o.status)),
    [orderQuery.items],
  )
  const teams = resourcesQuery.items.find((row) => row.id === 'maoObra')?.recursos ?? []
  const machines = resourcesQuery.items.find((row) => row.id === 'maquinas')?.recursos ?? []
  const [draft, setDraft] = useState<ScheduleDraft>(emptySchedule)
  const [workerId, setWorkerId] = useState('')
  const [person, setPerson] = useState(emptyWorker)
  const [editing, setEditing] = useState(false)
  const [editingWorker, setEditingWorker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const schedules = scheduleQuery.items.filter((s) => !s.excluido && orders.some((o) => o.id === s.opId))
    .sort((a, b) => a.data.localeCompare(b.data) || a.opNumero.localeCompare(b.opNumero))
  const unscheduled = orders.filter((o) => !schedules.some((s) => s.opId === o.id))
  const nameFor = (list: typeof teams, id: string) => list.find((item) => item.id === id)?.nome || 'Não atribuída'

  const openNew = () => { setDraft({ ...emptySchedule, opId: unscheduled[0]?.id ?? '' }); setError(''); setEditing(true) }
  const openEdit = (schedule: Schedule) => {
    setDraft({ opId: schedule.opId, data: schedule.data, prioridade: schedule.prioridade, equipeId: schedule.equipeId, maquinaId: schedule.maquinaId, observacao: schedule.observacao })
    setEditing(true); setError('')
  }
  const saveSchedule = async () => {
    if (!empresaId || !user || !draft.opId || !draft.data || busy) {
      setError('Selecione uma OP e a data planejada.')
      return
    }
    const order = orders.find((row) => row.id === draft.opId)
    if (!order) { setError('OP não disponível para programação.'); return }
    setBusy(true); setError('')
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'empresas', empresaId, 'programacoes', order.id), {
        ...draft, opNumero: order.numero, excluido: false,
        alteradoEm: serverTimestamp(), alteradoPor: user.uid,
      }, { merge: true })
      batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
        entidade: 'programacao', entidadeId: order.id, acao: 'salva',
        resumo: order.numero + ' · ' + draft.data, uid: user.uid, em: serverTimestamp(),
      })
      await batch.commit()
      setEditing(false)
      notify('Programação salva.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar programação.')
    } finally { setBusy(false) }
  }
  const removeSchedule = async (schedule: Schedule) => {
    if (!empresaId || !user || busy || !window.confirm('Retirar esta OP da programação? A OP continuará preservada.')) return
    setBusy(true); setError('')
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'empresas', empresaId, 'programacoes', schedule.opId), {
        excluido: true, alteradoEm: serverTimestamp(), alteradoPor: user.uid,
      }, { merge: true })
      batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
        entidade: 'programacao', entidadeId: schedule.opId, acao: 'removida',
        resumo: schedule.opNumero, uid: user.uid, em: serverTimestamp(),
      })
      await batch.commit(); notify('OP retirada da programação.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível retirar a OP.')
    } finally { setBusy(false) }
  }

  const saveWorker = async () => {
    if (!empresaId || !user || busy || !person.nome.trim()) { setError('Informe o nome do colaborador.'); return }
    setBusy(true); setError('')
    try {
      const id = workerId || crypto.randomUUID()
      const batch = writeBatch(db)
      batch.set(doc(db, 'empresas', empresaId, 'colaboradores', id), {
        ...person, nome: person.nome.trim(), matricula: person.matricula.trim(),
        alteradoEm: serverTimestamp(), alteradoPor: user.uid,
      }, { merge: true })
      batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
        entidade: 'colaborador', entidadeId: id, acao: workerId ? 'alterado' : 'criado',
        resumo: person.nome.trim(), uid: user.uid, em: serverTimestamp(),
      })
      await batch.commit()
      setWorkerId(''); setPerson(emptyWorker); setEditingWorker(false)
      notify('Colaborador salvo.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao salvar colaborador.') }
    finally { setBusy(false) }
  }
  return <div className="pf-page">
    <section className="pf-page-heading">
      <div><span className="section-kicker">Planejamento e Controle da Produção</span><h2>Planejamento</h2>
        <p>Uma central para programação, capacidade de máquinas e equipes.</p></div>
    </section>
    <div className="pf-tabbar">
      <button className={tab === 'programacao' ? 'active' : ''} onClick={() => setTab('programacao')}>Programação</button>
      <button className={tab === 'maquinas' ? 'active' : ''} onClick={() => setTab('maquinas')}>Máquinas</button>
      <button className={tab === 'equipes' ? 'active' : ''} onClick={() => setTab('equipes')}>Equipes</button>
      <button className={tab === 'colaboradores' ? 'active' : ''} onClick={() => setTab('colaboradores')}>Colaboradores</button>
      <button className={tab === 'cronometragem' ? 'active' : ''} onClick={() => setTab('cronometragem')}>Cronometragem</button>
    </div>
    {error && <div className="form-error page-message">{error}</div>}
    {tab === 'maquinas' && <CapacityPage kind="maquinas" notify={notify} />}
    {tab === 'equipes' && <CapacityPage kind="maoObra" notify={notify} />}
    {tab === 'cronometragem' && <TimeStudiesPage notify={notify}/>}
    {tab === 'programacao' && <>
      <section className="pf-op-summary">
        <div><small>OPs aguardando programação</small><strong>{unscheduled.length}</strong></div>
        <div><small>OPs programadas</small><strong>{schedules.length}</strong></div>
        <div><small>Máquinas cadastradas</small><strong>{machines.filter((x) => x.ativo).length}</strong></div>
        <div><small>Equipes cadastradas</small><strong>{teams.filter((x) => x.ativo).length}</strong></div>
      </section>
      <section className="panel pf-form-card">
        <div className="pf-section-heading"><h3>Programação das OPs</h3>
          <button className="primary-button compact" onClick={openNew} disabled={orders.length === 0}><Plus size={16}/> Programar OP</button>
        </div>
        {scheduleQuery.error || orderQuery.error || resourcesQuery.error ? <div className="form-error">{scheduleQuery.error || orderQuery.error || resourcesQuery.error}</div> : null}
        <p className="helper-text">A programação é opcional. Defina a data, prioridade e os recursos previstos para cada OP. O lançamento real será feito em Produção.</p>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>OP</th><th>Data</th><th>Prioridade</th><th>Equipe</th><th>Máquina</th><th>Ações</th></tr></thead>
          <tbody>{schedules.map((schedule) => <tr key={schedule.id}>
            <td><strong>{schedule.opNumero}</strong></td><td>{schedule.data.split('-').reverse().join('/')}</td><td>{schedule.prioridade}</td>
            <td>{schedule.equipeId ? nameFor(teams, schedule.equipeId) : '—'}</td>
            <td>{schedule.maquinaId ? nameFor(machines, schedule.maquinaId) : '—'}</td>
            <td><div className="pf-table-actions"><button onClick={() => openEdit(schedule)} aria-label="Editar programação"><Pencil size={15}/></button>
              <button onClick={() => void removeSchedule(schedule)} aria-label="Retirar da programação"><Trash2 size={15}/></button></div></td>
          </tr>)}</tbody></table></div>
        {schedules.length === 0 && <p className="helper-text">Nenhuma OP programada ainda.</p>}
      </section>
      {editing && <section className="panel pf-form-card">
        <h3>Programar ordem</h3>
        <div className="pf-two-columns">
          <label>Ordem de produção *
            <select value={draft.opId} onChange={(e) => setDraft({ ...draft, opId: e.target.value })}>
              <option value="">Selecione...</option>
              {orders.map((order) => <option key={order.id} value={order.id}>{order.numero} · {order.itens.map((i) => i.produtoDescricao).join(', ')}</option>)}
            </select>
          </label>
          <label>Data planejada *<input type="date" value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })}/></label>
          <label>Prioridade<select value={draft.prioridade} onChange={(e) => setDraft({ ...draft, prioridade: e.target.value as Schedule['prioridade'] })}>
            <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
          </select></label>
          <label>Equipe<select value={draft.equipeId} onChange={(e) => setDraft({ ...draft, equipeId: e.target.value })}>
            <option value="">Não atribuída</option>{teams.filter((team) => team.ativo).map((team) => <option key={team.id} value={team.id}>{team.nome}</option>)}
          </select></label>
          <label>Máquina<select value={draft.maquinaId} onChange={(e) => setDraft({ ...draft, maquinaId: e.target.value })}>
            <option value="">Não atribuída</option>{machines.filter((machine) => machine.ativo).map((machine) => <option key={machine.id} value={machine.id}>{machine.nome}</option>)}
          </select></label>
          <label>Observações<input value={draft.observacao} onChange={(e) => setDraft({ ...draft, observacao: e.target.value })}/></label>
        </div>
        <div className="pf-actions"><button className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-button" disabled={busy} onClick={() => void saveSchedule()}><Save size={16}/> Salvar programação</button></div>
      </section>}
    </>}
    {tab === 'colaboradores' && <section className="panel pf-form-card">
      <div className="pf-section-heading"><h3>Colaboradores</h3>
        <button className="primary-button compact" onClick={() => { setWorkerId(''); setPerson({ ...emptyWorker }); setEditingWorker(true) }}><Plus size={16}/> Adicionar</button></div>
      <p className="helper-text">Cadastre os colaboradores e vincule-os às equipes de planejamento. Esse cadastro é independente da autenticação de usuários.</p>
      {peopleQuery.error && <div className="form-error">{peopleQuery.error}</div>}
      {peopleQuery.items.length === 0 && <div className="empty-state"><Users size={26}/><strong>Nenhum colaborador cadastrado</strong></div>}
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>Nome</th><th>Matrícula</th><th>Equipe</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
        {peopleQuery.items.map((worker) => <tr key={worker.id}><td><strong>{worker.nome}</strong></td><td>{worker.matricula || '—'}</td><td>{worker.equipeId ? nameFor(teams, worker.equipeId) : '—'}</td><td>{worker.ativo ? 'Ativo' : 'Inativo'}</td>
          <td><button className="secondary-button compact" onClick={() => { setWorkerId(worker.id); setPerson({ nome: worker.nome, matricula: worker.matricula ?? '', equipeId: worker.equipeId ?? '', ativo: worker.ativo }); setEditingWorker(true) }}><Pencil size={14}/> Editar</button></td></tr>)}
      </tbody></table></div>
      {editingWorker && <div className="pf-inline-editor"><h3>{workerId ? 'Editar colaborador' : 'Novo colaborador'}</h3>
        <div className="pf-two-columns">
          <label>Nome *<input value={person.nome} onChange={(e) => setPerson({ ...person, nome: e.target.value })}/></label>
          <label>Matrícula<input value={person.matricula} onChange={(e) => setPerson({ ...person, matricula: e.target.value })}/></label>
          <label>Equipe<select value={person.equipeId} onChange={(e) => setPerson({ ...person, equipeId: e.target.value })}>
            <option value="">Sem equipe</option>{teams.filter((t) => t.ativo || t.id === person.equipeId).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select></label>
          <label>Situação<select value={person.ativo ? 'ativo' : 'inativo'} onChange={(e) => setPerson({ ...person, ativo: e.target.value === 'ativo' })}>
            <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
          </select></label>
        </div>
        <div className="pf-actions"><button className="secondary-button" onClick={() => setEditingWorker(false)}>Cancelar</button>
          <button className="primary-button" disabled={busy} onClick={() => void saveWorker()}><Save size={16}/> Salvar</button></div>
      </div>}
    </section>}
  </div>
}

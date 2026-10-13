import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  GitBranch,
  Loader2,
  Plus,
  Save,
  Trash2,
  Workflow as WorkflowIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { emptyWorkflow, saveWorkflow, subscribeWorkflow } from '../firebase/workflowRepository'
import type { WorkflowDefinition, WorkflowStageDefinition } from '../domain/workflowEngine'

export default function WorkflowPage({ notify }: { notify: (message: string) => void }) {
  const auth = useAuth()
  const empresaId = auth.activeCompany?.id
  const user = auth.user
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(emptyWorkflow)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState({ nome: '', perfis: '', obrigatoria: true })
  const canAdmin = (auth.activeMembership?.perfis ?? []).includes('admin') || auth.activeCompany?.ownerUid === user?.uid

  useEffect(() => {
    if (!empresaId) return
    setLoading(true)
    return subscribeWorkflow(
      empresaId,
      (next) => { setWorkflow(next); setLoading(false) },
      (reason) => { console.error(reason); setError('Não foi possível carregar o workflow.'); setLoading(false) },
    )
  }, [empresaId])

  const addStage = () => {
    if (!stage.nome.trim()) return
    const item: WorkflowStageDefinition = {
      id: crypto.randomUUID(),
      nome: stage.nome.trim(),
      ordem: workflow.etapas.length + 1,
      perfis: stage.perfis.split(',').map((item) => item.trim()).filter(Boolean),
      obrigatoria: stage.obrigatoria,
    }
    setWorkflow({ ...workflow, etapas: [...workflow.etapas, item] })
    setStage({ nome: '', perfis: '', obrigatoria: true })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= workflow.etapas.length) return
    const next = [...workflow.etapas]
    ;[next[index], next[target]] = [next[target], next[index]]
    setWorkflow({ ...workflow, etapas: next.map((item, i) => ({ ...item, ordem: i + 1 })) })
  }

  const remove = (id: string) => {
    setWorkflow({ ...workflow, etapas: workflow.etapas.filter((item) => item.id !== id).map((item, i) => ({ ...item, ordem: i + 1 })) })
  }

  const save = async () => {
    if (!empresaId || !user) return
    if (workflow.etapas.some((item) => item.perfis.length === 0)) {
      setError('Toda etapa deve ter pelo menos um perfil responsável.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveWorkflow(empresaId, user.uid, workflow)
      notify('Workflow salvo para esta empresa.')
    } catch (reason) {
      console.error(reason)
      setError('Não foi possível salvar o workflow.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="page-intro">
      <div><span className="section-kicker">Automação configurável</span><h2>Workflow</h2><p>Monte o fluxo da empresa sem alterar código: etapas, ordem, perfis responsáveis e regras de aprovação ficam no Firestore.</p></div>
      <button className="primary-button" onClick={save} disabled={!canAdmin || busy}>{busy ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Salvar fluxo</button>
    </section>

    {error && <div className="form-error page-message">{error}</div>}
    {loading ? <div className="loading-panel"><Loader2 className="spin" size={24} /> Carregando workflow...</div> : <>
      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Regras gerais</span><h3>Comportamento do fluxo</h3></div><GitBranch size={20} /></div>
        <div className="workflow-rule-grid">
          <button className={workflow.permiteAprovacaoParalela ? 'rule-toggle active' : 'rule-toggle'} onClick={() => canAdmin && setWorkflow({ ...workflow, permiteAprovacaoParalela: !workflow.permiteAprovacaoParalela })}><span className="switch"><i /></span><div><strong>Aprovação paralela</strong><small>Permite mais de uma aprovação ocorrer sem ordem rígida.</small></div></button>
          <button className={workflow.permitePularComJustificativa ? 'rule-toggle active' : 'rule-toggle'} onClick={() => canAdmin && setWorkflow({ ...workflow, permitePularComJustificativa: !workflow.permitePularComJustificativa })}><span className="switch"><i /></span><div><strong>Pular com justificativa</strong><small>Administrador pode avançar uma etapa registrando o motivo.</small></div></button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Fluxo principal</span><h3>{workflow.etapas.length} etapa(s)</h3></div><WorkflowIcon size={20} /></div>
        {workflow.etapas.length === 0 ? <div className="empty-state small-empty"><WorkflowIcon size={28} /><strong>Nenhuma etapa configurada</strong><span>Adicione as etapas na ordem em que o processo deve acontecer.</span></div> :
          <div className="workflow-editor-list">{workflow.etapas.map((item, index) => <div className="workflow-editor-stage" key={item.id}>
            <span className="stage-number">{index + 1}</span>
            <div><strong>{item.nome}</strong><small>{item.perfis.join(' · ')} · {item.obrigatoria ? 'obrigatória' : 'opcional'}</small></div>
            <div className="stage-actions"><button onClick={() => move(index, -1)} disabled={!canAdmin || index === 0}><ArrowUp size={14} /></button><button onClick={() => move(index, 1)} disabled={!canAdmin || index === workflow.etapas.length - 1}><ArrowDown size={14} /></button><button onClick={() => remove(item.id)} disabled={!canAdmin}><Trash2 size={14} /></button></div>
            {index < workflow.etapas.length - 1 && <ArrowRight className="stage-arrow" size={16} />}
          </div>)}</div>}

        <div className="workflow-new-stage">
          <input value={stage.nome} onChange={(e) => setStage({ ...stage, nome: e.target.value })} placeholder="Nome da etapa" disabled={!canAdmin} />
          <input value={stage.perfis} onChange={(e) => setStage({ ...stage, perfis: e.target.value })} placeholder="Perfis responsáveis, separados por vírgula" disabled={!canAdmin} />
          <label><input type="checkbox" checked={stage.obrigatoria} onChange={(e) => setStage({ ...stage, obrigatoria: e.target.checked })} disabled={!canAdmin} /><span>Obrigatória</span></label>
          <button className="secondary-button compact" type="button" onClick={addStage} disabled={!canAdmin}><Plus size={15} /> Adicionar etapa</button>
        </div>
      </section>

      <section className="info-banner"><Check size={19} /><div><strong>Fluxo universal</strong><span>Nomes como Desenvolvimento, PPCP, Qualidade ou Expedição não são obrigatórios. A empresa define o vocabulário e os responsáveis do próprio processo.</span></div></section>
    </>}
  </>
}

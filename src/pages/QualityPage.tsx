import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { emptyWorkflow, subscribeWorkflow } from '../firebase/workflowRepository'
import { createQualityInspection, sendOrderToRework } from '../firebase/qualityRepository'
import type {
  ProductionOrderRecord,
  QualityCriterion,
  QualityInspection,
  QualityResult,
  QualitySample,
} from '../domain/types'
import type { WorkflowDefinition } from '../domain/workflowEngine'

type CriterionDraft = QualityCriterion

export default function QualityPage({ notify }: { notify: (message: string) => void }) {
  const auth = useSystem()
  const empresaId = auth.activeCompany?.id
  const user = auth.user
  const { items: orders } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const { items: inspections, loading, error } = useTenantCollection<QualityInspection>(empresaId, 'inspecoes', 'criadoEm')
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(emptyWorkflow)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [criteria, setCriteria] = useState<CriterionDraft[]>([])
  const [criterionForm, setCriterionForm] = useState({ nome: '', tipo: 'checklist' as 'checklist' | 'numerico', nominal: 0, tolerancia: 0, severidade: 'critico' as QualityCriterion['severidade'] })
  const [sampleCount, setSampleCount] = useState(1)
  const [values, setValues] = useState<Record<string, Array<number | boolean | null>>>({})
  const [observation, setObservation] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [reworkOrder, setReworkOrder] = useState<ProductionOrderRecord | null>(null)
  const [reworkStage, setReworkStage] = useState('')
  const [reworkReason, setReworkReason] = useState('')

  useEffect(() => {
    if (!empresaId) return
    return subscribeWorkflow(empresaId, setWorkflow, console.error)
  }, [empresaId])

  const inspectableOrders = useMemo(
    () => orders.filter((order) => !['rascunho', 'cancelada', 'concluida'].includes(order.status)),
    [orders],
  )
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)

  const addCriterion = () => {
    if (!criterionForm.nome.trim()) return
    const item: CriterionDraft = {
      id: crypto.randomUUID(),
      nome: criterionForm.nome.trim(),
      tipo: criterionForm.tipo,
      nominal: criterionForm.tipo === 'numerico' ? Number(criterionForm.nominal) : undefined,
      tolerancia: criterionForm.tipo === 'numerico' ? Number(criterionForm.tolerancia) : undefined,
      severidade: criterionForm.severidade,
    }
    setCriteria([...criteria, item])
    setValues({ ...values, [item.id]: Array.from({ length: sampleCount }, () => item.tipo === 'checklist' ? true : null) })
    setCriterionForm({ nome: '', tipo: 'checklist', nominal: 0, tolerancia: 0, severidade: 'critico' })
  }

  const removeCriterion = (id: string) => {
    setCriteria(criteria.filter((item) => item.id !== id))
    const next = { ...values }
    delete next[id]
    setValues(next)
  }

  const changeSampleCount = (count: number) => {
    const safe = Math.max(1, Math.min(20, count || 1))
    setSampleCount(safe)
    const next = { ...values }
    for (const criterion of criteria) {
      const current = next[criterion.id] ?? []
      next[criterion.id] = Array.from({ length: safe }, (_, index) =>
        current[index] ?? (criterion.tipo === 'checklist' ? true : null),
      )
    }
    setValues(next)
  }

  const setValue = (criterionId: string, index: number, value: number | boolean | null) => {
    const current = [...(values[criterionId] ?? Array.from({ length: sampleCount }, () => null))]
    current[index] = value
    setValues({ ...values, [criterionId]: current })
  }

  const buildSamples = (): QualitySample[] => {
    return Array.from({ length: sampleCount }, (_, sampleIndex) => {
      const resultados: QualityResult[] = criteria.map((criterion) => {
        const raw = values[criterion.id]?.[sampleIndex]
        if (criterion.tipo === 'checklist') {
          return {
            criterioId: criterion.id,
            criterioNome: criterion.nome,
            tipo: 'checklist',
            conforme: raw === true,
            severidade: criterion.severidade,
          }
        }

        const value = raw === null || raw === undefined || raw === '' ? NaN : typeof raw === 'number' ? raw : Number(raw)
        const nominal = Number(criterion.nominal ?? 0)
        const tolerance = Number(criterion.tolerancia ?? 0)
        const valid = Number.isFinite(value) && Math.abs(value - nominal) <= tolerance
        return {
          criterioId: criterion.id,
          criterioNome: criterion.nome,
          tipo: 'numerico',
          valor: value,
          conforme: valid,
          nominal,
          tolerancia: tolerance,
          severidade: criterion.severidade,
        }
      })
      return {
        numero: sampleIndex + 1,
        resultados,
        aprovada: resultados.every((result) => result.conforme),
      }
    })
  }

  const submitInspection = async () => {
    if (!empresaId || !user || !selectedOrder) {
      setLocalError('Selecione uma Ordem de Produção.')
      return
    }
    if (criteria.length === 0) {
      setLocalError('Adicione pelo menos um critério.')
      return
    }

    if (criteria.some((criterion) => criterion.tipo === 'numerico' && Array.from({ length: sampleCount }, (_, index) => values[criterion.id]?.[index]).some((value) => typeof value !== 'number' || !Number.isFinite(value)))) {
      setLocalError('Preencha todas as medições numéricas antes de registrar a inspeção.')
      return
    }
    setBusy(true)
    setLocalError('')
    try {
      const result = await createQualityInspection(
        empresaId,
        user.uid,
        selectedOrder,
        criteria,
        buildSamples(),
        observation,
      )
      notify(result.resultadoGeral === 'aprovada' ? 'Inspeção aprovada.' : 'Inspeção reprovada e OP sinalizada.')
      setSelectedOrderId('')
      setCriteria([])
      setValues({})
      setObservation('')
      setSampleCount(1)
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível registrar a inspeção.')
    } finally {
      setBusy(false)
    }
  }

  const submitRework = async () => {
    if (!empresaId || !user || !reworkOrder) return
    setBusy(true)
    try {
      await sendOrderToRework(empresaId, user.uid, reworkOrder, reworkStage || null, reworkReason)
      notify('OP enviada para retrabalho.')
      setReworkOrder(null)
      setReworkStage('')
      setReworkReason('')
    } catch (reason) {
      console.error(reason)
      setLocalError('Não foi possível enviar a OP para retrabalho.')
    } finally {
      setBusy(false)
    }
  }

  const approvalRate = inspections.length
    ? Math.round(inspections.filter((item) => item.resultadoGeral === 'aprovada').length / inspections.length * 100)
    : 0

  return <>
    <section className="page-intro">
      <div><span className="section-kicker">Controle e rastreabilidade</span><h2>Qualidade</h2><p>Inspeções imutáveis com várias amostras, critérios numéricos e checklist. Uma nova verificação gera um novo registro.</p></div>
    </section>

    <section className="stats-grid compact">
      <Stat label="Inspeções" value={String(inspections.length)} />
      <Stat label="Aprovação" value={`${approvalRate}%`} />
      <Stat label="Reprovadas" value={String(inspections.filter((item) => item.resultadoGeral === 'reprovada').length)} />
      <Stat label="OPs em retrabalho" value={String(orders.filter((item) => item.status === 'reprovada').length)} />
    </section>

    <section className="panel quality-builder">
      <div className="panel-head"><div><span className="section-kicker">Nova inspeção</span><h3>Critérios e amostras</h3></div><ShieldCheck size={20} /></div>
      <div className="form-grid config-form">
        <label className="span-2"><span>Ordem de Produção *</span><select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}><option value="">Selecione...</option>{inspectableOrders.map((order) => <option key={order.id} value={order.id}>{order.numero} · {order.itens.length} produto(s)</option>)}</select></label>
        <label><span>Quantidade de amostras</span><input type="number" min={1} max={20} value={sampleCount} onChange={(e) => changeSampleCount(Number(e.target.value))} /></label>
        <label><span>Observação geral</span><input value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Opcional" /></label>
      </div>

      <div className="quality-criterion-form">
        <input value={criterionForm.nome} onChange={(e) => setCriterionForm({ ...criterionForm, nome: e.target.value })} placeholder="Nome do critério" />
        <select value={criterionForm.tipo} onChange={(e) => setCriterionForm({ ...criterionForm, tipo: e.target.value as 'checklist' | 'numerico' })}><option value="checklist">Checklist</option><option value="numerico">Numérico</option></select>
        {criterionForm.tipo === 'numerico' && <><input type="number" step="0.001" value={criterionForm.nominal} onChange={(e) => setCriterionForm({ ...criterionForm, nominal: Number(e.target.value) })} placeholder="Nominal" /><input type="number" min="0" step="0.001" value={criterionForm.tolerancia} onChange={(e) => setCriterionForm({ ...criterionForm, tolerancia: Number(e.target.value) })} placeholder="Tolerância" /></>}
        <select value={criterionForm.severidade} onChange={(e) => setCriterionForm({ ...criterionForm, severidade: e.target.value as QualityCriterion['severidade'] })}><option value="critico">Crítico</option><option value="maior">Maior</option><option value="menor">Menor</option></select>
        <button className="secondary-button compact" onClick={addCriterion}><Plus size={15} /> Critério</button>
      </div>

      {criteria.length > 0 && <div className="table-wrap quality-matrix"><table><thead><tr><th>Critério</th>{Array.from({ length: sampleCount }, (_, i) => <th key={i}>Amostra {i + 1}</th>)}<th></th></tr></thead><tbody>{criteria.map((criterion) => <tr key={criterion.id}><td><strong>{criterion.nome}</strong><small className="table-sub">{criterion.tipo === 'numerico' ? `${criterion.nominal} ± ${criterion.tolerancia}` : criterion.severidade}</small></td>{Array.from({ length: sampleCount }, (_, index) => <td key={index}>{criterion.tipo === 'numerico' ? <input type="number" step="0.001" value={values[criterion.id]?.[index] as number ?? ''} onChange={(e) => setValue(criterion.id, index, e.target.value === '' ? null : Number(e.target.value))} /> : <select value={values[criterion.id]?.[index] === false ? 'nao' : 'sim'} onChange={(e) => setValue(criterion.id, index, e.target.value === 'sim')}><option value="sim">Conforme</option><option value="nao">Não conforme</option></select>}</td>)}<td><button className="icon-button danger-icon" onClick={() => removeCriterion(criterion.id)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>}

      {localError && <div className="form-error page-message">{localError}</div>}
      <div className="config-save-row"><button className="primary-button" disabled={busy || !selectedOrderId || criteria.length === 0} onClick={submitInspection}>{busy ? <Loader2 className="spin" size={16} /> : <ClipboardCheck size={16} />} Registrar inspeção</button></div>
    </section>

    {error && <div className="form-error page-message">{error}</div>}
    {loading ? <div className="loading-panel"><Loader2 className="spin" size={24} /> Carregando inspeções...</div> :
      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Histórico</span><h3>Inspeções registradas</h3></div><span className="count-badge">{inspections.length}</span></div>
        {inspections.length === 0 ? <div className="empty-state small-empty"><ShieldCheck size={28} /><strong>Nenhuma inspeção registrada</strong><span>Os registros aparecerão aqui e não poderão ser editados.</span></div> :
          <div className="inspection-list">{[...inspections].reverse().map((inspection) => {
            const failed = inspection.resultadoGeral === 'reprovada'
            const order = orders.find((item) => item.id === inspection.opId)
            return <article key={inspection.id} className={failed ? 'inspection-card failed' : 'inspection-card approved'}><span className="inspection-result-icon">{failed ? <XCircle size={21} /> : <CheckCircle2 size={21} />}</span><div><strong>{inspection.opNumero}</strong><small>{inspection.amostras.length} amostra(s) · {inspection.criterios.length} critério(s)</small><span>{failed ? 'REPROVADA' : 'APROVADA'}</span></div>{failed && order?.status === 'reprovada' && <button className="secondary-button compact" onClick={() => { setReworkOrder(order); setReworkStage(order.reprovadaNaEtapaId ?? order.workflowStageId ?? ''); setReworkReason('Correção após inspeção reprovada') }}><RotateCcw size={14} /> Retrabalho</button>}</article>
          })}</div>}
      </section>}

    {reworkOrder && <div className="modal-backdrop"><section className="form-modal">
      <div className="modal-head"><div><span className="section-kicker">Retrabalho</span><h2>{reworkOrder.numero}</h2></div><button className="icon-button" onClick={() => setReworkOrder(null)}><XCircle size={17} /></button></div>
      <div className="form-grid">
        <label className="span-2"><span>Etapa de retorno</span><select value={reworkStage} onChange={(e) => setReworkStage(e.target.value)}><option value="">Sem etapa definida</option>{[...workflow.etapas].sort((a,b) => a.ordem-b.ordem).map((stage) => <option key={stage.id} value={stage.id}>{stage.ordem}. {stage.nome}</option>)}</select></label>
        <label className="span-2"><span>Motivo / ação de retrabalho</span><textarea rows={4} value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} /></label>
      </div>
      <div className="modal-actions"><button className="secondary-button" onClick={() => setReworkOrder(null)}>Cancelar</button><button className="primary-button" onClick={submitRework} disabled={busy}><RotateCcw size={15} /> Enviar para retrabalho</button></div>
    </section></div>}
  </>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article className="stat-card"><span className="stat-icon"><ShieldCheck size={19} /></span><div><span>{label}</span><strong>{value}</strong><small>dados reais</small></div></article>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, Play, Save, Square, RotateCcw, TriangleAlert } from 'lucide-react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord, ProductionOperationTask } from '../domain/types'

type Study = {
  id: string
  opId: string
  opNumero: string
  taskId: string
  produtoCodigo: string
  operacaoNome: string
  amostrasSeg: number[]
  ritmo: number
  tolerancia: number
  tempoSugeridoMin: number
  nomeResponsavel: string
  observacao: string
  criadoEm?: unknown
}
function numberLabel(value: number, digits = 2) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}
function stats(samples: number[], rhythm: number, allowance: number) {
  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0
  const variance = samples.length
    ? samples.reduce((a, b) => a + (b - avg) ** 2, 0) / samples.length : 0
  return {
    avg, deviation: Math.sqrt(variance),
    standardMin: avg * rhythm / 100 * (1 + allowance / 100) / 60,
    cv: avg ? Math.sqrt(variance) / avg * 100 : 0,
  }
}
const empty = { rhythm: 100, allowance: 15, notes: '', responsible: '' }

export default function TimeStudiesPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, user } = useSystem()
  const companyId = activeCompany?.id
  const ordersQuery = useTenantCollection<ProductionOrderRecord>(companyId, 'ordensProducao', 'numero')
  const studyQuery = useTenantCollection<Study>(companyId, 'estudosTempos', 'criadoEm')
  const orders = useMemo(() => ordersQuery.items.filter((o) => !o.excluido && o.operacoes?.length > 0)
    .sort((a, b) => b.numero.localeCompare(a.numero)), [ordersQuery.items])
  const [orderId, setOrderId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [samples, setSamples] = useState<number[]>([])
  const [manual, setManual] = useState('')
  const [started, setStarted] = useState(false)
  const startRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [rhythm, setRhythm] = useState(empty.rhythm)
  const [allowance, setAllowance] = useState(empty.allowance)
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const order = orders.find((o) => o.id === orderId) ?? orders[0]
  const operations = useMemo<ProductionOperationTask[]>(() => [...(order?.operacoes ?? [])]
    .sort((a, b) => a.operacao.ordem - b.operacao.ordem), [order])
  const task = operations.find((t) => t.id === taskId) ?? operations[0]
  const result = stats(samples, rhythm, allowance)
  const history = studyQuery.items.filter((item) => item.opId === order?.id && item.taskId === task?.id)

  useEffect(() => {
    if (!started) return
    const interval = window.setInterval(() => {
      if (startRef.current != null) setElapsed(Math.max(0, (performance.now() - startRef.current) / 1000))
    }, 100)
    return () => window.clearInterval(interval)
  }, [started])
  const resetDraft = () => {
    setSamples([]); setManual(''); setStarted(false); startRef.current = null
    setElapsed(0); setError('')
  }
  const addSample = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0.1 || seconds > 7200) {
      setError('Informe um tempo entre 0,1 e 7.200 segundos.')
      return
    }
    if (samples.length >= 30) { setError('Limite de 30 amostras por estudo.'); return }
    setSamples((old) => [...old, Math.round(seconds * 100) / 100])
    setManual(''); setError('')
  }
  const stop = () => {
    if (startRef.current != null) {
      const value = Math.max(0, (performance.now() - startRef.current) / 1000)
      startRef.current = null; setStarted(false); setElapsed(value)
      addSample(value)
    }
  }
  const save = async () => {
    if (!companyId || !user || !order || !task || busy) return
    if (samples.length < 2) { setError('Registre ao menos duas medições para salvar o estudo.'); return }
    if (!responsible.trim()) { setError('Informe o responsável pelo estudo.'); return }
    if (!Number.isFinite(rhythm) || rhythm < 50 || rhythm > 150 || !Number.isFinite(allowance) || allowance < 0 || allowance > 50) {
      setError('Ritmo permitido: 50–150%; tolerância: 0–50%.'); return
    }
    setBusy(true); setError('')
    try {
      const ref = doc(collection(db, 'empresas', companyId, 'estudosTempos'))
      const auditRef = doc(collection(db, 'empresas', companyId, 'auditoria'))
      const batch = writeBatch(db)
      batch.set(ref, {
        opId: order.id, opNumero: order.numero, taskId: task.id,
        produtoCodigo: task.produtoCodigo, operacaoNome: task.operacao.nome,
        amostrasSeg: samples, ritmo: rhythm, tolerancia: allowance,
        tempoSugeridoMin: result.standardMin, nomeResponsavel: responsible.trim(),
        observacao: notes.trim(), criadoEm: serverTimestamp(), criadoPor: user.uid,
      })
      batch.set(auditRef, {
        entidade: 'cronometragem', entidadeId: ref.id, acao: 'estudo_criado',
        resumo: order.numero + ' · ' + task.operacao.nome,
        uid: user.uid, em: serverTimestamp(),
      })
      await batch.commit()
      notify('Estudo salvo. A Ficha Técnica publicada permanece intacta.')
      resetDraft()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o estudo.')
    } finally { setBusy(false) }
  }

  return <div className="pf-page">
    <section className="pf-page-heading"><div>
      <span className="section-kicker">Engenharia de tempos</span><h2>Cronometragem</h2>
      <p>Meça ciclos reais e estime novos tempos-padrão sem alterar a Ficha Técnica publicada.</p>
    </div></section>
    {(error || studyQuery.error || ordersQuery.error) && <div className="form-error page-message" role="alert">{error || studyQuery.error || ordersQuery.error}</div>}
    <section className="panel pf-form-card">
      <div className="pf-two-columns">
        <label>OP de referência<select value={order?.id || ''} onChange={(e) => { setOrderId(e.target.value); setTaskId(''); resetDraft() }}>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.numero}</option>)}
        </select></label>
        <label>Operação<select value={task?.id || ''} onChange={(e) => { setTaskId(e.target.value); resetDraft() }}>
          {operations.map((op) => <option key={op.id} value={op.id}>{op.produtoDescricao} · {op.operacao.nome}</option>)}
        </select></label>
      </div>
      {!task ? <p className="helper-text">Libere uma OP com operações para começar a cronometrar.</p> : <>
        <div className="pf-timer-face">
          <small>{task.operacao.nome} · padrão atual: {task.operacao.tempoPadraoMin ?? '—'} min/un.</small>
          <strong>{numberLabel(elapsed)} <span>s</span></strong>
          <div className="pf-actions">
            {!started ? <button className="primary-button" onClick={() => { setElapsed(0); startRef.current = performance.now(); setStarted(true) }}><Play size={15}/> Iniciar medição</button>
              : <button className="primary-button" onClick={stop}><Square size={15}/> Parar e adicionar</button>}
            <button className="secondary-button" disabled={started} onClick={resetDraft}><RotateCcw size={15}/> Limpar medições</button>
          </div>
        </div>
        <div className="pf-two-columns">
          <label>Adicionar tempo manual (segundos)<input type="number" min="0.1" max="7200" step="0.01" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ex.: 43.5"/></label>
          <div className="pf-manual-action"><button className="secondary-button" disabled={!manual || started} onClick={() => addSample(Number(manual))}>Adicionar tempo</button></div>
        </div>
        <div className="pf-timer-samples">
          {samples.map((value, index) => <div key={index}><small>Medida {index + 1}</small><strong>{numberLabel(value)} s</strong>
            <button aria-label={'Remover medição ' + (index + 1)} disabled={started} onClick={() => setSamples((old) => old.filter((_, i) => i !== index))}>×</button>
          </div>)}
          {samples.length === 0 && <span className="pf-muted">Nenhuma medição. Inicie o cronômetro ou informe tempos manualmente.</span>}
        </div>
        <div className="pf-two-columns">
          <label>Ritmo observado (%)<input type="number" min="50" max="150" step="1" value={rhythm} onChange={(e) => setRhythm(Number(e.target.value))}/></label>
          <label>Tolerância (%)<input type="number" min="0" max="50" step="1" value={allowance} onChange={(e) => setAllowance(Number(e.target.value))}/></label>
        </div>
        <section className="pf-op-summary">
          <div><small>Medições</small><strong>{samples.length}</strong></div>
          <div><small>Média observada</small><strong>{numberLabel(result.avg)} s</strong></div>
          <div><small>Variação (CV)</small><strong>{numberLabel(result.cv, 1)}%</strong></div>
          <div><small>Tempo sugerido</small><strong>{numberLabel(result.standardMin, 3)} min</strong></div>
        </section>
        {samples.length > 1 && result.cv > 20 && <div className="capacity-note"><TriangleAlert size={15}/> Medições muito diferentes entre si. Avalie novas amostras antes de usar o tempo sugerido.</div>}
        <div className="pf-two-columns">
          <label>Responsável pelo estudo *<input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome de quem realizou"/></label>
          <label>Observações<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: nova máquina ou ferramenta"/></label>
        </div>
        <button className="primary-button" disabled={busy || started || samples.length < 2} onClick={() => void save()}><Save size={15}/> {busy ? 'Salvando...' : 'Salvar estudo'}</button>
        <p className="helper-text">Cálculo: média dos ciclos × ritmo / 100 × (1 + tolerância / 100). O resultado é sugestão para uma futura revisão técnica, nunca altera uma revisão publicada automaticamente.</p>
      </>}
    </section>
    {task && <section className="panel pf-form-card">
      <h3>Estudos anteriores desta operação</h3>
      {studyQuery.loading && <p className="helper-text">Carregando histórico...</p>}
      {history.length === 0 && <p className="helper-text">Nenhum estudo salvo para esta operação nesta OP.</p>}
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>Responsável</th><th>Medições</th><th>Ritmo</th><th>Tolerância</th><th>Tempo sugerido</th></tr></thead>
        <tbody>{history.map((s) => <tr key={s.id}><td>{s.nomeResponsavel}</td><td>{s.amostrasSeg.length}</td>
          <td>{s.ritmo}%</td><td>{s.tolerancia}%</td><td>{numberLabel(s.tempoSugeridoMin,3)} min</td></tr>)}</tbody></table></div>
    </section>}
  </div>
}

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, RotateCcw, Save, ShieldAlert, Wrench } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord } from '../domain/types'
import { stepProgress, orderProgress } from '../domain/progressEngine'
import {
  registerProduction, reverseProductionEntry, registerRework, reverseRework,
  type ProductionBalance, type ProductionEntry, type ProductionReversal,
  type ProductionRework, type ProductionReworkReversal,
} from '../firebase/productionLedger'

type Worker = { id: string; nome: string; ativo: boolean }
const numberFormat = new Intl.NumberFormat('pt-BR')
function dateOf(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate() as Date
  }
  return null
}
const formatTime = (value: unknown) => dateOf(value)?.toLocaleString('pt-BR') ?? 'Aguardando sincronização'

export default function ProductionPage({ notify, initialOrderId }: {
  notify: (message: string) => void
  initialOrderId?: string
}) {
  const { activeCompany, user } = useSystem()
  const companyId = activeCompany?.id
  const ordersQuery = useTenantCollection<ProductionOrderRecord>(companyId, 'ordensProducao', 'numero')
  const balancesQuery = useTenantCollection<ProductionBalance>(companyId, 'saldosOperacoes', 'taskId')
  const entriesQuery = useTenantCollection<ProductionEntry>(companyId, 'apontamentos', 'criadoEm')
  const reversalsQuery = useTenantCollection<ProductionReversal>(companyId, 'estornosApontamentos', 'entryId')
  const reworksQuery = useTenantCollection<ProductionRework>(companyId, 'retrabalhosOperacoes', 'criadoEm')
  const reworkReversalsQuery = useTenantCollection<ProductionReworkReversal>(companyId, 'estornosRetrabalhos', 'reworkId')
  const workersQuery = useTenantCollection<Worker>(companyId, 'colaboradores', 'nome')

  const orders = useMemo(
    () => ordersQuery.items.filter((o) => !o.excluido && ['liberada', 'em_fluxo', 'reprovada'].includes(o.status))
      .sort((a, b) => b.numero.localeCompare(a.numero)),
    [ordersQuery.items],
  )
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [good, setGood] = useState('')
  const [bad, setBad] = useState('0')
  const [reworkQuantity, setReworkQuantity] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [notes, setNotes] = useState('')
  const [reworkNotes, setReworkNotes] = useState('')
  const [tab, setTab] = useState<'produzir' | 'retrabalho'>('produzir')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reverseId, setReverseId] = useState('')
  const [reverseReason, setReverseReason] = useState('')
  const order = orders.find((o) => o.id === selectedOrderId) ??
    orders.find((o) => o.id === initialOrderId) ?? orders[0]
  const tasks = useMemo(
    () => [...(order?.operacoes ?? [])].sort((a, b) =>
      (order?.itens.findIndex((item) => item.id === a.itemId) ?? 0)
       - (order?.itens.findIndex((item) => item.id === b.itemId) ?? 0)
      || a.operacao.ordem - b.operacao.ordem),
    [order],
  )
  const current = tasks.find((t) => t.id === selectedTaskId) ??
    tasks.find((t) => {
      const step = stepProgress(order, t, balancesQuery.items)
      return step.toPoint > 0 || step.defective > 0
    }) ?? tasks[0]
  const balance = current ? stepProgress(order, current, balancesQuery.items) : null
  const progress = order ? orderProgress(order, balancesQuery.items) : null
  const nextAvailable = current ? tasks.find((task) => {
    if (task.id === current.id) return false
    const step = stepProgress(order, task, balancesQuery.items)
    return step.toPoint > 0 || step.defective > 0
  }) : null
  const validEntries = entriesQuery.items
    .filter((entry) => entry.opId === order?.id && entry.taskId === current?.id)
    .sort((a, b) => (dateOf(b.criadoEm)?.getTime() ?? 0) - (dateOf(a.criadoEm)?.getTime() ?? 0))
  const validReworks = reworksQuery.items
    .filter((entry) => entry.opId === order?.id && entry.taskId === current?.id)
    .sort((a, b) => (dateOf(b.criadoEm)?.getTime() ?? 0) - (dateOf(a.criadoEm)?.getTime() ?? 0))
  const reversedEntries = useMemo(
    () => new Set(reversalsQuery.items.map((entry) => entry.entryId)), [reversalsQuery.items],
  )
  const reversedReworks = useMemo(
    () => new Set(reworkReversalsQuery.items.map((entry) => entry.reworkId)), [reworkReversalsQuery.items],
  )

  const setOrder = (id: string) => {
    setSelectedOrderId(id); setSelectedTaskId(''); setGood(''); setBad('0')
    setReworkQuantity(''); setTab('produzir'); setReverseId(''); setError('')
  }
  const setTask = (id: string) => {
    setSelectedTaskId(id); setGood(''); setBad('0'); setReworkQuantity(''); setTab('produzir')
    setReverseId(''); setError('')
  }

  const register = async () => {
    if (!companyId || !user || !order || !current || busy) return
    setBusy(true); setError('')
    try {
      await registerProduction(companyId, user.uid, {
        opId: order.id, taskId: current.id,
        boas: good.trim() === '' ? 0 : Number(good),
        defeituosas: bad.trim() === '' ? 0 : Number(bad),
        operadorNome: operatorName, observacao: notes,
      })
      setGood(''); setBad('0'); setNotes('')
      notify('Apontamento registrado com saldo atualizado.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao registrar produção.')
    } finally { setBusy(false) }
  }

  const rework = async () => {
    if (!companyId || !user || !order || !current || busy) return
    setBusy(true); setError('')
    try {
      await registerRework(companyId, user.uid, {
        opId: order.id, taskId: current.id, quantidade: Number(reworkQuantity),
        operadorNome: operatorName, observacao: reworkNotes,
      })
      setReworkQuantity(''); setReworkNotes('')
      notify('Retrabalho registrado. Unidades recuperadas e disponibilizadas para a etapa seguinte.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao registrar retrabalho.')
    } finally { setBusy(false) }
  }

  const reverse = async (entry: ProductionEntry | ProductionRework, kind: 'entry' | 'rework') => {
    if (!companyId || !user || busy) return
    setBusy(true); setError('')
    try {
      if (kind === 'entry') await reverseProductionEntry(companyId, user.uid, entry as ProductionEntry, reverseReason)
      else await reverseRework(companyId, user.uid, entry as ProductionRework, reverseReason)
      setReverseId(''); setReverseReason('')
      notify('Estorno registrado. Histórico preservado.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível estornar.')
    } finally { setBusy(false) }
  }

  const busyLoading = ordersQuery.loading || balancesQuery.loading || entriesQuery.loading ||
    reversalsQuery.loading || reworksQuery.loading || reworkReversalsQuery.loading || workersQuery.loading
  const firstError = ordersQuery.error || balancesQuery.error || entriesQuery.error || reversalsQuery.error ||
    reworksQuery.error || reworkReversalsQuery.error || workersQuery.error || error

  if (busyLoading) return <div className="loading-panel">Carregando acompanhamento de produção...</div>

  return <div className="pf-page">
    <section className="pf-page-heading"><div>
      <span className="section-kicker">Chão de fábrica</span><h2>Produção real</h2>
      <p>Acompanhe a passagem das unidades por operação, sem perder histórico de perdas e recuperações.</p>
    </div></section>
    {firstError && <div className="form-error page-message" role="alert">{firstError}</div>}
    {!order ? <section className="panel empty-state"><ClipboardList size={28}/>
      <strong>Nenhuma OP disponível</strong><span>Crie e libere uma OP para começar os apontamentos.</span>
    </section> : <>
      <section className="panel pf-form-card">
        <label className="pf-field-label">Ordem de Produção
          <select value={order.id} onChange={(e) => setOrder(e.target.value)}>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.numero} · {o.itens.map((item) => item.produtoDescricao).join(', ')}</option>)}
          </select>
        </label>
        {progress && <div className="pf-op-summary">
          <div><small>Meta de produtos acabados</small><strong>{numberFormat.format(progress.planned)}</strong></div>
          <div><small>Acabados aprovados</small><strong>{numberFormat.format(progress.finished)}</strong></div>
          <div><small>Faltam finalizar</small><strong>{numberFormat.format(progress.remaining)}</strong></div>
          <div><small>Progresso final</small><strong>{progress.percentage}%</strong></div>
        </div>}
        {order.status === 'reprovada' && <div className="capacity-note"><ShieldAlert size={16}/> OP reprovada na Qualidade. Verifique inspeção e retrabalho.</div>}
      </section>
      <section className="panel pf-form-card">
        <div className="pf-section-heading"><h3>Etapas da produção</h3><span className="pf-muted">Selecione uma operação para apontar</span></div>
        <div className="pf-operation-grid">{tasks.map((task) => {
          const p = stepProgress(order, task, balancesQuery.items)
          return <button key={task.id} className={'pf-operation-card' + (current?.id === task.id ? ' selected' : '')}
            onClick={() => setTask(task.id)}>
            <small>{task.produtoDescricao} · Etapa {task.operacao.ordem}</small>
            <strong>{task.operacao.nome}</strong>
            <span>{p.good}/{p.target} boas · {p.defective} defeituosas</span>
            <em className="pf-operation-hint">{p.toPoint > 0 ? 'Pode apontar ' + p.toPoint : p.defective > 0 ? 'Retrabalho pendente' : 'Sem saldo pendente'}</em>
            <div className="pf-progress"><span style={{ width: p.percentage + '%' }}/></div>
          </button>
        })}</div>
        {tasks.length === 0 && <div className="capacity-note"><AlertTriangle size={16}/> OP sem operações congeladas; confira a Ficha Técnica e crie uma nova OP.</div>}
      </section>
      {current && balance && <>
        <section className="panel pf-form-card">
          <div className="pf-section-heading"><h3>{current.operacao.codigo} · {current.operacao.nome}</h3><span className="pf-muted">Tempo-padrão: {current.operacao.tempoPadraoMin ?? '—'} min/un.</span></div>
          <div className="pf-op-summary">
            <div><small>Recebidas para esta etapa</small><strong>{balance.available}</strong></div>
            <div><small>Boas disponíveis para a próxima</small><strong>{balance.good}</strong></div>
            <div><small>Pendentes de processar</small><strong>{balance.toPoint}</strong></div>
            <div><small>Aguardando retrabalho</small><strong>{balance.defective}</strong></div>
          </div>
          {balance.previous && balance.available === 0 && <div className="capacity-note"><AlertTriangle size={16}/> Aguardando liberação de peças boas da etapa anterior: {balance.previous.operacao.nome}.</div>}
          {current.status === 'bloqueada' && <div className="capacity-note"><ShieldAlert size={16}/> Operação bloqueada no fluxo anterior. Desbloqueie antes de apontar.</div>}
          {current.status === 'concluida' && <div className="capacity-note">Esta operação foi concluída pelo fluxo antigo. Os apontamentos por quantidade não podem ser misturados a ela.</div>}
          {balance.toPoint === 0 && balance.defective === 0 && nextAvailable && <div className="pf-next-operation">
            <span><CheckCircle2 size={18}/> Esta etapa não tem peças pendentes. Continue em outra operação.</span>
            <button className="secondary-button compact" onClick={() => setTask(nextAvailable.id)}>Ir para {nextAvailable.operacao.nome} →</button>
          </div>}
          {balance.toPoint === 0 && balance.defective > 0 && <div className="pf-next-operation">
            <span><Wrench size={18}/> Há {balance.defective} peça(s) com defeito nesta operação.</span>
            <button className="secondary-button compact" onClick={() => setTab('retrabalho')}>Abrir retrabalho →</button>
          </div>}}
          <div className="pf-tabbar">
            <button className={tab === 'produzir' ? 'active' : ''} onClick={() => setTab('produzir')}><Save size={15}/> Apontar produção</button>
            <button className={tab === 'retrabalho' ? 'active' : ''} onClick={() => setTab('retrabalho')}><Wrench size={15}/> Recuperar peças ({balance.defective})</button>
          </div>
          <div className="pf-two-columns">
            <label>Operador / responsável *
              <input list="pf-colaboradores" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Digite ou selecione quem executou" autoComplete="off"/>
              <datalist id="pf-colaboradores">{workersQuery.items.filter((worker) => worker.ativo).map((worker) => <option key={worker.id} value={worker.nome}/>)}</datalist>
            </label>
            {tab === 'produzir' ? <>
              <label>Unidades boas<input type="number" min="0" max={balance.toPoint} step="1" inputMode="numeric" value={good} onChange={(e) => setGood(e.target.value)} placeholder="Ex.: 100"/></label>
              <label>Unidades defeituosas<input type="number" min="0" max={balance.toPoint} step="1" inputMode="numeric" value={bad} onChange={(e) => setBad(e.target.value)}/></label>
              <label>Observações<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional"/></label>
            </> : <>
              <label>Quantidade recuperada<input type="number" min="1" max={balance.defective} step="1" value={reworkQuantity} onChange={(e) => setReworkQuantity(e.target.value)}/></label>
              <label>Correção realizada *<input value={reworkNotes} onChange={(e) => setReworkNotes(e.target.value)} placeholder="Ex.: costura refeita e inspecionada"/></label>
            </>}
          </div>
          {tab === 'produzir' && balance.toPoint > 0 && <div className="pf-fast-quantities">
            <span>Preencher quantidade boa:</span>
            {[1, 5, 10].filter((value) => value <= balance.toPoint).map((value) =>
              <button type="button" key={value} onClick={() => { setGood(String(value)); setBad('0') }}>{value} un.</button>)}
            <button type="button" onClick={() => { setGood(String(balance.toPoint)); setBad('0') }}>Todas disponíveis ({balance.toPoint})</button>
          </div>}
          {tab === 'produzir' ? <button className="primary-button" disabled={busy || balance.toPoint <= 0 || current.status === 'bloqueada' || current.status === 'concluida'}
            onClick={() => void register()}><Save size={16}/> {busy ? 'Salvando...' : 'Registrar apontamento'}</button>
            : <button className="primary-button" disabled={busy || balance.defective <= 0 || current.status === 'bloqueada' || current.status === 'concluida'}
              onClick={() => void rework()}><Wrench size={16}/> {busy ? 'Salvando...' : 'Confirmar peças recuperadas'}</button>}
          <p className="helper-text">Unidades com defeito não avançam para a etapa seguinte. Após corrigir, use “Recuperar peças” para transformar o saldo defeituoso em saldo bom, sem duplicar unidades.</p>
          {current.operacao.instrucoes?.filter(Boolean).length > 0 && <section className="pf-instructions">
            <strong>Instruções do Passaporte</strong>
            {current.operacao.instrucoes.filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
          </section>}
          {current.operacao.midias?.some((media) => media.url) && <div className="pf-image-grid">
            {current.operacao.midias.filter((media) => Boolean(media.url)).map((media) =>
              media.tipo === 'imagem' ? <img key={media.id} src={media.url} alt={media.legenda || current.operacao.nome}/>
                : <video key={media.id} src={media.url} controls preload="metadata" aria-label={media.legenda || current.operacao.nome}/>)}
          </div>}
        </section>
        <section className="panel pf-form-card">
          <h3>Histórico da operação</h3>
          <p className="helper-text">As correções não apagam lançamentos originais. Um estorno pode ser recusado se a etapa seguinte já consumiu essas unidades.</p>
          {validEntries.length === 0 && validReworks.length === 0 && <p className="helper-text">Nenhum registro nesta operação.</p>}
          <div className="pf-entry-list">
            {validEntries.map((entry) => {
              const isReversed = reversedEntries.has(entry.id)
              return <div className="pf-entry" key={entry.id}>
                <div><strong>{entry.operadorNome}</strong><small>{formatTime(entry.criadoEm)} · Produção</small>
                  <span><CheckCircle2 size={13}/> {entry.boas} boas · {entry.defeituosas} defeituosas</span>
                  {entry.observacao && <small>{entry.observacao}</small>}
                </div>
                {isReversed ? <span className="pf-muted">Estornado</span> :
                  <button className="secondary-button compact" onClick={() => { setReverseId('entry:' + entry.id); setReverseReason('') }}><RotateCcw size={13}/> Corrigir</button>}
                {reverseId === 'entry:' + entry.id && !isReversed && <div className="pf-reversal">
                  <label>Motivo do estorno<input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)}/></label>
                  <div><button className="secondary-button compact" onClick={() => setReverseId('')}>Cancelar</button>
                    <button className="primary-button compact" disabled={busy || !reverseReason.trim()} onClick={() => void reverse(entry, 'entry')}>Confirmar estorno</button></div>
                </div>}
              </div>
            })}
            {validReworks.map((entry) => {
              const isReversed = reversedReworks.has(entry.id)
              return <div className="pf-entry" key={'rw:' + entry.id}>
                <div><strong>{entry.operadorNome}</strong><small>{formatTime(entry.criadoEm)} · Retrabalho</small>
                  <span><Wrench size={13}/> {entry.quantidade} recuperada(s)</span><small>{entry.observacao}</small>
                </div>
                {isReversed ? <span className="pf-muted">Estornado</span> :
                  <button className="secondary-button compact" onClick={() => { setReverseId('rework:' + entry.id); setReverseReason('') }}><RotateCcw size={13}/> Corrigir</button>}
                {reverseId === 'rework:' + entry.id && !isReversed && <div className="pf-reversal">
                  <label>Motivo do estorno<input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)}/></label>
                  <div><button className="secondary-button compact" onClick={() => setReverseId('')}>Cancelar</button>
                    <button className="primary-button compact" disabled={busy || !reverseReason.trim()} onClick={() => void reverse(entry, 'rework')}>Confirmar estorno</button></div>
                </div>}
              </div>
            })}
          </div>
        </section>
      </>}
    </>}
  </div>
}

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord, ProductionOperationTask } from '../domain/types'
import {
  balanceFor, orderedItemTasks, precedingTask, plannedQuantity,
  registerProduction, reverseProductionEntry,
  type ProductionBalance, type ProductionEntry, type ProductionReversal,
} from '../firebase/productionLedger'

function dateLabel(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('pt-BR')
  }
  return 'Registro recente'
}
const pct = (value: number, max: number) => max > 0 ? Math.min(100, Math.round(value * 100 / max)) : 0

export default function ProductionPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id
  const ordersQuery = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const balanceQuery = useTenantCollection<ProductionBalance>(empresaId, 'saldosOperacoes', 'taskId')
  const entriesQuery = useTenantCollection<ProductionEntry>(empresaId, 'apontamentos', 'criadoEm')
  const reversalsQuery = useTenantCollection<ProductionReversal>(empresaId, 'estornosApontamentos', 'entryId')
  const orders = useMemo(
    () => ordersQuery.items.filter((o) => !o.excluido && ['liberada', 'em_fluxo', 'reprovada'].includes(o.status)).sort((a, b) => b.numero.localeCompare(a.numero)),
    [ordersQuery.items],
  )
  const [opId, setOpId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [good, setGood] = useState('')
  const [bad, setBad] = useState('0')
  const [operatorName, setOperatorName] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reverseId, setReverseId] = useState('')
  const [reverseReason, setReverseReason] = useState('')
  const selected = orders.find((o) => o.id === opId) ?? orders[0]
  const tasks = selected?.operacoes ?? []
  const current = tasks.find((t) => t.id === taskId) ?? tasks[0]
  const balance = current ? balanceFor(balanceQuery.items, current.id) : null
  const previous = selected && current ? precedingTask(selected, current) : null
  const available = selected && current
    ? previous ? Number(balanceFor(balanceQuery.items, previous.id)?.boas ?? 0) : plannedQuantity(selected, current)
    : 0
  const consumed = Number(balance?.total ?? 0)
  const remaining = Math.max(0, available - consumed)
  const goal = selected && current ? plannedQuantity(selected, current) : 0

  useEffect(() => { setTaskId(''); setGood(''); setBad('0') }, [selected?.id])
  useEffect(() => { setGood(''); setBad('0') }, [current?.id])
  const existingEntries = entriesQuery.items.filter((entry) => entry.opId === selected?.id && entry.taskId === current?.id)
    .sort((a, b) => dateLabel(b.criadoEm).localeCompare(dateLabel(a.criadoEm)))
  const reversed = new Set(reversalsQuery.items.map((item) => item.entryId))
  const loading = ordersQuery.loading || balanceQuery.loading || entriesQuery.loading || reversalsQuery.loading

  const register = async () => {
    if (!empresaId || !user || !selected || !current || busy) return
    const goodNumber = Number(good)
    const badNumber = Number(bad)
    setBusy(true); setError('')
    try {
      await registerProduction(empresaId, user.uid, {
        opId: selected.id, taskId: current.id, boas: goodNumber,
        defeituosas: badNumber, operadorNome: operatorName,
        observacao: notes,
      })
      setGood(''); setBad('0'); setNotes('')
      notify('Produção apontada com sucesso.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registrar a produção.')
    } finally {
      setBusy(false)
    }
  }

  const reverse = async (entry: ProductionEntry) => {
    if (!empresaId || !user || busy) return
    setBusy(true); setError('')
    try {
      await reverseProductionEntry(empresaId, user.uid, entry, reverseReason)
      setReverseId(''); setReverseReason('')
      notify('Apontamento estornado. O histórico foi preservado.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível estornar.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="loading-panel">Carregando produção...</div>
  return <div className="pf-page">
    <section className="pf-page-heading">
      <div><span className="section-kicker">Chão de fábrica</span><h2>Apontamento da Produção</h2>
        <p>Registre quantidades parciais por operação. Cada lançamento permanece no histórico.</p></div>
    </section>
    {(ordersQuery.error || balanceQuery.error || entriesQuery.error || reversalsQuery.error || error) &&
      <div className="form-error page-message">{error || ordersQuery.error || balanceQuery.error || entriesQuery.error || reversalsQuery.error}</div>}
    {!selected ? <div className="panel empty-state"><ClipboardList size={28} /><strong>Nenhuma OP liberada</strong><span>Libere uma OP com Ficha Técnica publicada para iniciar a produção.</span></div> : <>
      <section className="panel pf-form-card">
        <div className="pf-two-columns">
          <label>Ordem de Produção
            <select value={selected.id} onChange={(e) => { setOpId(e.target.value); setTaskId('') }}>
              {orders.map((o) => <option value={o.id} key={o.id}>{o.numero} · {o.itens.map((i) => i.produtoDescricao).join(', ')}</option>)}
            </select>
          </label>
          <label>Operação
            <select value={current?.id ?? ''} onChange={(e) => setTaskId(e.target.value)}>
              {tasks.map((t) => <option value={t.id} key={t.id}>{t.produtoDescricao} · {t.operacao.codigo} · {t.operacao.nome}</option>)}
            </select>
          </label>
        </div>
        {current ? <>
          <div className="pf-op-summary">
            <div><small>Quantidade da OP</small><strong>{goal}</strong></div>
            <div><small>Disponível nesta etapa</small><strong>{available}</strong></div>
            <div><small>Produção boa acumulada</small><strong>{balance?.boas ?? 0}</strong></div>
            <div><small>Saldo para apontar</small><strong>{remaining}</strong></div>
          </div>
          <div className="pf-progress"><span style={{ width: String(pct(consumed, goal)) + '%' }} /></div>
          <p className="helper-text">Etapa {current.operacao.ordem} · {current.operacao.maquina || 'Sem máquina informada'} · Tempo padrão: {current.operacao.tempoPadraoMin ?? '—'} min/unidade.</p>
          {previous && available === 0 && <div className="capacity-note"><AlertTriangle size={16} /> Aguardando peças boas da operação anterior: {previous.operacao.nome}.</div>}
          {current.status === 'bloqueada' && <div className="capacity-note"><ShieldAlert size={16} /> Operação bloqueada. Resolva o problema na gestão da OP.</div>}
          <div className="pf-two-columns">
            <label>Operador / responsável *
              <input placeholder="Nome do responsável pelo lançamento" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} />
            </label>
            <label>Unidades boas *
              <input type="number" min="0" step="1" value={good} onChange={(e) => setGood(e.target.value)} placeholder="Ex.: 100" />
            </label>
            <label>Unidades com defeito
              <input type="number" min="0" step="1" value={bad} onChange={(e) => setBad(e.target.value)} />
            </label>
            <label>Observações
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </label>
          </div>
          <button className="primary-button" disabled={busy || remaining <= 0 || current.status === 'bloqueada'}
            onClick={() => void register()}><Save size={16}/> {busy ? 'Salvando...' : 'Registrar produção'}</button>
          {current.operacao.instrucoes?.filter(Boolean).length > 0 && <section className="pf-instructions">
            <strong>Instruções do Passaporte</strong>
            {current.operacao.instrucoes.filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
          </section>}
          {current.operacao.midias?.filter((media) => Boolean(media.url)).length > 0 &&
            <div className="pf-image-grid">{current.operacao.midias.filter((media) => Boolean(media.url))
              .map((media) => media.tipo === 'imagem'
                ? <img key={media.id} src={media.url} alt={media.legenda || current.operacao.nome}/>
                : <video key={media.id} controls preload="metadata" src={media.url} aria-label={media.legenda || current.operacao.nome}/>)}</div>}
        </> : <div className="capacity-note">A OP não contém operações. Publique a Ficha Técnica com operações e libere uma nova OP.</div>}
      </section>
      {current && <section className="panel pf-form-card">
        <h3>Histórico da operação</h3>
        {existingEntries.length === 0 ? <p className="helper-text">Nenhum apontamento registrado para esta operação.</p> :
          <div className="pf-entry-list">{existingEntries.map((entry) => <div key={entry.id} className="pf-entry">
            <div><strong>{entry.operadorNome}</strong><small>{dateLabel(entry.criadoEm)}</small>
              <span><CheckCircle2 size={13}/> {entry.boas} boas · {entry.defeituosas} com defeito</span>
              {entry.observacao && <small>{entry.observacao}</small>}
            </div>
            {reversed.has(entry.id) ? <span className="pf-muted">Estornado</span> :
              <button className="secondary-button compact" onClick={() => { setReverseId(entry.id); setReverseReason('') }}><RotateCcw size={13}/> Corrigir</button>}
            {reverseId === entry.id && !reversed.has(entry.id) && <div className="pf-reversal">
              <label>Motivo do estorno<input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="Por que corrigir este apontamento?" /></label>
              <div><button className="secondary-button compact" onClick={() => setReverseId('')}>Cancelar</button>
                <button className="primary-button compact" disabled={busy || !reverseReason.trim()} onClick={() => void reverse(entry)}>Confirmar estorno</button></div>
              <small>Para corrigir uma quantidade, estorne o registro e lance o valor correto. O estorno pode ser bloqueado se a próxima etapa já consumiu essas peças.</small>
            </div>}
          </div>)}</div>}
      </section>}
    </>}
  </div>
}

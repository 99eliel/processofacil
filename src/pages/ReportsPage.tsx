import { useMemo, useState } from 'react'
import { ChartColumnIncreasing, Download, Printer } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord, QualityInspection } from '../domain/types'
import {
  type ProductionBalance, type ProductionEntry, type ProductionReversal,
  type ProductionRework, type ProductionReworkReversal,
} from '../firebase/productionLedger'
import { orderProgress, productionWarnings } from '../domain/progressEngine'

function dateOf(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate()
  return null
}
function isoDate(value: unknown) {
  const date = dateOf(value)
  return date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : ''
}
const fmt = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const percent = (a: number, b: number) => b ? Math.round(a / b * 1000) / 10 : 0
function csvCell(input: string) {
  // Neutraliza fórmulas em Excel/Sheets ao abrir CSV com dados digitados por usuários.
  const sanitized = /^[\s]*[=+\-@]/.test(input) ? "'" + input : input
  return '"' + sanitized.replace(/"/g, '""') + '"'
}
function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.appendChild(link); link.click(); link.remove()
  URL.revokeObjectURL(url)
}
type OperatorRow = { name: string; entries: number; good: number; bad: number; reworked: number }
export default function ReportsPage() {
  const { activeCompany } = useSystem()
  const companyId = activeCompany?.id
  const ordersQuery = useTenantCollection<ProductionOrderRecord>(companyId, 'ordensProducao', 'numero')
  const entriesQuery = useTenantCollection<ProductionEntry>(companyId, 'apontamentos', 'criadoEm')
  const balancesQuery = useTenantCollection<ProductionBalance>(companyId, 'saldosOperacoes', 'taskId')
  const reversalsQuery = useTenantCollection<ProductionReversal>(companyId, 'estornosApontamentos', 'entryId')
  const reworksQuery = useTenantCollection<ProductionRework>(companyId, 'retrabalhosOperacoes', 'criadoEm')
  const reworkReversalsQuery = useTenantCollection<ProductionReworkReversal>(companyId, 'estornosRetrabalhos', 'reworkId')
  const inspectionsQuery = useTenantCollection<QualityInspection>(companyId, 'inspecoes', 'criadoEm')
  const [orderFilter, setOrderFilter] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const orders = useMemo(() => ordersQuery.items.filter((o) => !o.excluido), [ordersQuery.items])
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])
  const entryReversed = useMemo(() => new Set(reversalsQuery.items.map((r) => r.entryId)), [reversalsQuery.items])
  const reworkReversed = useMemo(() => new Set(reworkReversalsQuery.items.map((r) => r.reworkId)), [reworkReversalsQuery.items])
  const matchesPeriod = (date: unknown) => (!from || isoDate(date) >= from) && (!to || isoDate(date) <= to)
  const availableOrders = orders.filter((o) => statusFilter === 'todos' || o.status === statusFilter)
  const allowedOrderIds = new Set(availableOrders.map((o) => o.id))
  const entries = entriesQuery.items.filter((e) =>
    !entryReversed.has(e.id) && allowedOrderIds.has(e.opId) &&
    (!orderFilter || e.opId === orderFilter) &&
    (!personFilter || e.operadorNome === personFilter) && matchesPeriod(e.criadoEm))
  const reworks = reworksQuery.items.filter((e) =>
    !reworkReversed.has(e.id) && allowedOrderIds.has(e.opId) &&
    (!orderFilter || e.opId === orderFilter) &&
    (!personFilter || e.operadorNome === personFilter) && matchesPeriod(e.criadoEm))
  const inspected = inspectionsQuery.items.filter((i) =>
    allowedOrderIds.has(i.opId) && (!orderFilter || i.opId === orderFilter) && matchesPeriod(i.criadoEm))
  const allPeople = [...new Set([...entriesQuery.items.map((e) => e.operadorNome), ...reworksQuery.items.map((e) => e.operadorNome)])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const plannedGood = entries.reduce((total, entry) => total + Number(entry.boas ?? 0), 0)
  const detectedBad = entries.reduce((total, entry) => total + Number(entry.defeituosas ?? 0), 0)
  const recovered = reworks.reduce((total, entry) => total + Number(entry.quantidade ?? 0), 0)
  const calculatedOrders = availableOrders
    .filter((order) => !orderFilter || order.id === orderFilter)
    .map((order) => ({ order, progress: orderProgress(order, balancesQuery.items) }))
  const finalGood = calculatedOrders.reduce((total, row) => total + row.progress.finished, 0)
  const totalPlanned = calculatedOrders.reduce((total, row) => total + row.progress.planned, 0)
  const operators = useMemo<OperatorRow[]>(() => {
    const map = new Map<string, OperatorRow>()
    for (const entry of entries) {
      const name = entry.operadorNome || 'Não informado'
      const row = map.get(name) ?? { name, entries: 0, good: 0, bad: 0, reworked: 0 }
      row.entries += 1; row.good += Number(entry.boas || 0); row.bad += Number(entry.defeituosas || 0)
      map.set(name, row)
    }
    for (const entry of reworks) {
      const name = entry.operadorNome || 'Não informado'
      const row = map.get(name) ?? { name, entries: 0, good: 0, bad: 0, reworked: 0 }
      row.reworked += Number(entry.quantidade || 0)
      map.set(name, row)
    }
    return [...map.values()].sort((a, b) => b.good - a.good || a.name.localeCompare(b.name))
  }, [entries, reworks])
  const operationRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; boas: number; defeitos: number; qtd: number }>()
    for (const entry of entries) {
      const id = entry.produtoCodigo + '|' + entry.operacaoNome
      const row = map.get(id) ?? { id, name: entry.produtoCodigo + ' · ' + entry.operacaoNome, boas: 0, defeitos: 0, qtd: 0 }
      row.boas += Number(entry.boas || 0); row.defeitos += Number(entry.defeituosas || 0); row.qtd++
      map.set(id, row)
    }
    return [...map.values()].sort((a, b) => b.boas - a.boas)
  }, [entries])
  const plannedTime = entries.reduce((sum, entry) => {
    const order = orderById.get(entry.opId)
    const task = order?.operacoes.find((t) => t.id === entry.taskId)
    const minutes = Number(task?.operacao.tempoPadraoMin ?? 0)
    return sum + (minutes > 0 ? Number(entry.boas || 0) * minutes / 60 : 0)
  }, 0)
  const loading = [ordersQuery, entriesQuery, balancesQuery, reversalsQuery, reworksQuery, reworkReversalsQuery, inspectionsQuery]
    .some((q) => q.loading)
  const error = [ordersQuery, entriesQuery, balancesQuery, reversalsQuery, reworksQuery, reworkReversalsQuery, inspectionsQuery]
    .map((q) => q.error).find(Boolean)
  const reset = () => { setOrderFilter(''); setPersonFilter(''); setStatusFilter('todos'); setFrom(''); setTo('') }
  const exportEntries = () => downloadCsv([
    ['OP', 'Produto', 'Operação', 'Responsável', 'Boas', 'Defeitos detectados', 'Observação', 'Data'],
    ...entries.map((e) => [
      e.opNumero, e.produtoCodigo, e.operacaoNome, e.operadorNome,
      String(e.boas), String(e.defeituosas), e.observacao,
      dateOf(e.criadoEm)?.toLocaleString('pt-BR') ?? '',
    ]),
  ], 'processo-facil-apontamentos.csv')
  const exportOperators = () => downloadCsv([
    ['Responsável', 'Apontamentos', 'Boas processadas', 'Defeitos detectados', 'Recuperadas'],
    ...operators.map((r) => [r.name, String(r.entries), String(r.good), String(r.bad), String(r.reworked)]),
  ], 'processo-facil-operadores.csv')
  const countWarnings = calculatedOrders.reduce((sum, { order }) =>
    sum + productionWarnings(order, balancesQuery.items,
      [new Date().getFullYear(), String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-')).length, 0)

  if (loading) return <div className="loading-panel">Carregando indicadores e relatórios...</div>
  return <div className="pf-page pf-reports">
    <section className="pf-page-heading pf-no-print"><div>
      <span className="section-kicker">Visão gerencial</span><h2>Gestão e Relatórios</h2>
      <p>Produção por operação, produto acabado, retrabalho e qualidade. Tudo com filtros.</p>
    </div></section>
    {error && <div className="form-error page-message pf-no-print">{error}</div>}
    <section className="panel pf-form-card pf-no-print">
      <div className="pf-report-filters">
        <label>Ordem de Produção<select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
          <option value="">Todas</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.numero}</option>)}
        </select></label>
        <label>Situação da OP<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="todos">Todas</option>
          <option value="rascunho">Rascunho</option><option value="liberada">Liberada</option>
          <option value="em_fluxo">Em fluxo</option><option value="reprovada">Reprovada</option>
          <option value="concluida">Concluída</option>
        </select></label>
        <label>Responsável<select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
          <option value="">Todos</option>{allPeople.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <label>Data inicial<input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label>
        <label>Data final<input type="date" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)}/></label>
      </div>
      <div className="pf-actions">
        <button className="secondary-button" onClick={reset}>Limpar filtros</button>
        <button className="secondary-button" onClick={exportEntries}><Download size={15}/> CSV apontamentos</button>
        <button className="secondary-button" onClick={exportOperators}><Download size={15}/> CSV responsáveis</button>
        <button className="primary-button" onClick={() => window.print()}><Printer size={15}/> Imprimir / PDF</button>
      </div>
    </section>
    <section className="pf-report-document">
      <div className="pf-print-title"><ChartColumnIncreasing size={22}/><div>
        <h2>Relatório de Produção</h2>
        <small>{activeCompany?.nomeFantasia || 'Processo Fácil'} · {orderFilter ? orders.find((o) => o.id === orderFilter)?.numero : 'Todas as OPs'} · {from || 'Início'} a {to || 'Hoje'}</small>
      </div></div>
      <div className="pf-op-summary">
        <div><small>Boas processadas nas etapas*</small><strong>{fmt(plannedGood)}</strong></div>
        <div><small>Defeitos detectados*</small><strong>{fmt(detectedBad)}</strong></div>
        <div><small>Unidades recuperadas*</small><strong>{fmt(recovered)}</strong></div>
        <div><small>Taxa de defeitos detectados*</small><strong>{percent(detectedBad, plannedGood + detectedBad)}%</strong></div>
      </div>
      <div className="pf-op-summary">
        <div><small>Acabadas (acumulado)**</small><strong>{fmt(finalGood)}</strong></div>
        <div><small>Meta das OPs filtradas**</small><strong>{fmt(totalPlanned)}</strong></div>
        <div><small>Inspeções no período</small><strong>{fmt(inspected.length)}</strong></div>
        <div><small>Horas-padrão boas*</small><strong>{plannedTime.toLocaleString('pt-BR',{maximumFractionDigits:1})} h</strong></div>
      </div>
      {countWarnings > 0 && <div className="capacity-note pf-no-print">{countWarnings} alerta(s) operacionais identificados. Consulte Configurações → Diagnóstico.</div>}
      <p className="helper-text">* Valores de apontamentos nas operações do período: uma peça pode aparecer em várias etapas. Recuperações não são peças novas e não entram novamente em “boas processadas”. ** Valores cumulativos da última etapa de cada produto; filtros de data e responsável não se aplicam a essas duas métricas.</p>
      <section className="panel pf-form-card">
        <h3>Situação das ordens</h3>
        <div className="pf-table-scroll"><table className="pf-data-table">
          <thead><tr><th>OP</th><th>Situação</th><th>Meta</th><th>Acabadas</th><th>Restantes</th><th>Progresso</th></tr></thead>
          <tbody>{calculatedOrders.map(({order, progress}) =>
            <tr key={order.id}><td><strong>{order.numero}</strong></td><td>{order.status}</td>
              <td>{fmt(progress.planned)}</td><td>{fmt(progress.finished)}</td>
              <td>{fmt(progress.remaining)}</td><td>{progress.percentage}%</td></tr>)}
          </tbody>
        </table></div>
        {calculatedOrders.length === 0 && <p className="helper-text">Nenhuma OP encontrada.</p>}
      </section>
      <section className="panel pf-form-card">
        <h3>Produção por responsável</h3>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr>
          <th>Responsável</th><th>Lançamentos</th><th>Boas processadas</th><th>Defeitos</th><th>Recuperadas</th>
        </tr></thead><tbody>{operators.map((row) => <tr key={row.name}>
          <td><strong>{row.name}</strong></td><td>{fmt(row.entries)}</td><td>{fmt(row.good)}</td>
          <td>{fmt(row.bad)}</td><td>{fmt(row.reworked)}</td></tr>)}</tbody></table></div>
        {operators.length === 0 && <p className="helper-text">Nenhum registro no período.</p>}
      </section>
      <section className="panel pf-form-card">
        <h3>Produção por operação</h3>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead>
          <tr><th>Produto e operação</th><th>Apontamentos</th><th>Boas</th><th>Defeituosas</th></tr>
        </thead><tbody>{operationRows.map((row) => <tr key={row.id}>
          <td><strong>{row.name}</strong></td><td>{fmt(row.qtd)}</td>
          <td>{fmt(row.boas)}</td><td>{fmt(row.defeitos)}</td></tr>)}</tbody></table></div>
        {operationRows.length === 0 && <p className="helper-text">Nenhuma operação apontada no período.</p>}
      </section>
      <section className="panel pf-form-card">
        <h3>Apontamentos detalhados</h3>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead>
          <tr><th>OP</th><th>Operação</th><th>Responsável</th><th>Boas</th><th>Defeitos</th><th>Data</th></tr>
        </thead><tbody>{entries.map((entry) => <tr key={entry.id}>
          <td>{entry.opNumero}</td><td>{entry.operacaoNome}</td><td>{entry.operadorNome}</td>
          <td>{fmt(entry.boas)}</td><td>{fmt(entry.defeituosas)}</td>
          <td>{dateOf(entry.criadoEm)?.toLocaleString('pt-BR') ?? '—'}</td></tr>)}</tbody></table></div>
        {entries.length === 0 && <p className="helper-text">Nenhum apontamento encontrado para estes filtros.</p>}
      </section>
    </section>
  </div>
}

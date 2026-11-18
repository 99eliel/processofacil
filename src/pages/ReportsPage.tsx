import { useMemo, useState } from 'react'
import { Download, Printer, ChartColumnIncreasing } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord } from '../domain/types'
import { balanceFor, orderedItemTasks, type ProductionBalance, type ProductionEntry, type ProductionReversal } from '../firebase/productionLedger'

function dateOf(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate()
  return null
}
const numberLabel = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const percentage = (a: number, b: number) => b ? Math.round(a / b * 100) : 0
function downloadCsv(rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => '"' + value.replace(/"/g, '""') + '"').join(';')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = 'processo-facil-relatorio-producao.csv'
  document.body.appendChild(link); link.click(); link.remove()
  URL.revokeObjectURL(url)
}
export default function ReportsPage() {
  const { activeCompany } = useSystem()
  const empresaId = activeCompany?.id
  const ordersQuery = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const entriesQuery = useTenantCollection<ProductionEntry>(empresaId, 'apontamentos', 'criadoEm')
  const balancesQuery = useTenantCollection<ProductionBalance>(empresaId, 'saldosOperacoes', 'taskId')
  const reversalsQuery = useTenantCollection<ProductionReversal>(empresaId, 'estornosApontamentos', 'entryId')
  const [opFilter, setOpFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const orders = ordersQuery.items.filter((order) => !order.excluido)
  const reversed = useMemo(() => new Set(reversalsQuery.items.map((entry) => entry.entryId)), [reversalsQuery.items])
  const entries = entriesQuery.items.filter((entry) => {
    if (reversed.has(entry.id) || (opFilter && entry.opId !== opFilter)) return false
    const date = dateOf(entry.criadoEm)
    if ((from || to) && !date) return false
    const iso = date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : ''
    return (!from || iso >= from) && (!to || iso <= to)
  })
  const totalGood = entries.reduce((sum, entry) => sum + Number(entry.boas ?? 0), 0)
  const totalBad = entries.reduce((sum, entry) => sum + Number(entry.defeituosas ?? 0), 0)
  const orderRows = orders.filter((order) => !opFilter || order.id === opFilter).map((order) => {
    const planned = order.itens.reduce((sum, item) => sum + item.quantidadeTotal, 0)
    const complete = order.itens.reduce((sum, item) => {
      const sequence = orderedItemTasks(order, item.id)
      const last = sequence[sequence.length - 1]
      return sum + (last ? Number(balanceFor(balancesQuery.items, last.id)?.boas ?? 0) : 0)
    }, 0)
    return { order, planned, complete, percentage: percentage(complete, planned) }
  })
  const loading = ordersQuery.loading || entriesQuery.loading || balancesQuery.loading || reversalsQuery.loading
  const error = ordersQuery.error || entriesQuery.error || balancesQuery.error || reversalsQuery.error
  const exportData = () => downloadCsv([
    ['OP', 'Produto', 'Operação', 'Responsável', 'Boas', 'Defeituosas', 'Observação', 'Data'],
    ...entries.map((entry) => [
      entry.opNumero, entry.produtoCodigo, entry.operacaoNome, entry.operadorNome,
      String(entry.boas), String(entry.defeituosas), entry.observacao,
      dateOf(entry.criadoEm)?.toLocaleString('pt-BR') ?? '',
    ]),
  ])

  if (loading) return <div className="loading-panel">Carregando relatórios...</div>
  return <div className="pf-page pf-reports">
    <section className="pf-page-heading pf-no-print"><div><span className="section-kicker">Visão gerencial</span><h2>Gestão e Relatórios</h2>
      <p>Indicadores extraídos dos apontamentos. As quantidades acumuladas somam registros de todas as operações, não peças acabadas.</p></div></section>
    {error && <div className="form-error page-message pf-no-print">{error}</div>}
    <section className="panel pf-form-card pf-no-print">
      <div className="pf-two-columns pf-filter-grid">
        <label>Ordem de Produção<select value={opFilter} onChange={(e) => setOpFilter(e.target.value)}>
          <option value="">Todas</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.numero}</option>)}
        </select></label>
        <label>Data inicial<input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label>
        <label>Data final<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}/></label>
      </div>
      <div className="pf-actions">
        <button className="secondary-button" onClick={() => { setOpFilter(''); setFrom(''); setTo('') }}>Limpar filtros</button>
        <button className="secondary-button" onClick={exportData}><Download size={15}/> Exportar CSV</button>
        <button className="primary-button" onClick={() => window.print()}><Printer size={15}/> Imprimir / PDF</button>
      </div>
    </section>
    <section className="pf-report-document">
      <div className="pf-print-title"><ChartColumnIncreasing size={22}/><div><h2>Relatório de Produção</h2><small>{activeCompany?.nomeFantasia || 'Processo Fácil'} · {opFilter ? orders.find((o) => o.id === opFilter)?.numero : 'Todas as OPs'} · {from || 'Início'} a {to || 'Hoje'}</small></div></div>
      <div className="pf-op-summary">
        <div><small>Apontamentos válidos</small><strong>{numberLabel(entries.length)}</strong></div>
        <div><small>Unidades boas apontadas</small><strong>{numberLabel(totalGood)}</strong></div>
        <div><small>Unidades defeituosas</small><strong>{numberLabel(totalBad)}</strong></div>
        <div><small>Taxa de defeitos nos apontamentos</small><strong>{percentage(totalBad, totalGood + totalBad)}%</strong></div>
      </div>
      <section className="panel pf-form-card">
        <h3>Situação das ordens</h3>
        <p className="helper-text">Os saldos abaixo são acumulados até agora e não seguem o filtro de datas. O progresso é baseado na última operação de cada item; registros anteriores ao novo módulo não integram esse cálculo.</p>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>OP</th><th>Situação</th><th>Previstas</th><th>Acabadas registradas</th><th>Progresso</th></tr></thead><tbody>
          {orderRows.map((row) => <tr key={row.order.id}><td>{row.order.numero}</td><td>{row.order.status}</td><td>{numberLabel(row.planned)}</td>
            <td>{numberLabel(row.complete)}</td><td>{row.percentage}%</td></tr>)}
        </tbody></table></div>
        {orderRows.length === 0 && <p className="helper-text">Nenhuma OP encontrada.</p>}
      </section>
      <section className="panel pf-form-card">
        <h3>Apontamentos no período</h3>
        <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr><th>OP</th><th>Operação</th><th>Responsável</th><th>Boas</th><th>Defeitos</th><th>Data</th></tr></thead><tbody>
          {entries.map((entry) => <tr key={entry.id}><td>{entry.opNumero}</td><td>{entry.operacaoNome}</td><td>{entry.operadorNome}</td><td>{numberLabel(entry.boas)}</td>
            <td>{numberLabel(entry.defeituosas)}</td><td>{dateOf(entry.criadoEm)?.toLocaleString('pt-BR') ?? '—'}</td></tr>)}
        </tbody></table></div>
        {entries.length === 0 && <p className="helper-text">Nenhum apontamento encontrado para estes filtros.</p>}
      </section>
    </section>
  </div>
}

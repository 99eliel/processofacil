import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, ShieldAlert } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { Material, Product, ProductionOrderRecord, TechnicalSheetSummary } from '../domain/types'
import type { ProductionBalance, ProductionEntry, ProductionReversal } from '../firebase/productionLedger'
import { orderProgress, productionWarnings, stepProgress, tasksForItem } from '../domain/progressEngine'

type Severity = 'critico' | 'atencao' | 'informativo'
type Finding = { id: string; severity: Severity; area: string; title: string; detail: string }
type Program = { id: string; opId: string; data: string; excluido?: boolean }

const badge = (severity: Severity) => ({
  critico: 'Crítico', atencao: 'Atenção', informativo: 'Informação',
}[severity])
const toDate = () => {
  const today = new Date()
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
}

export default function DiagnosticsPage() {
  const { activeCompany } = useSystem()
  const companyId = activeCompany?.id
  const products = useTenantCollection<Product>(companyId, 'produtos', 'descricao')
  const sheets = useTenantCollection<TechnicalSheetSummary>(companyId, 'fichas', 'produtoDescricao')
  const materials = useTenantCollection<Material>(companyId, 'materiais', 'descricao')
  const orders = useTenantCollection<ProductionOrderRecord>(companyId, 'ordensProducao', 'numero')
  const balances = useTenantCollection<ProductionBalance>(companyId, 'saldosOperacoes', 'taskId')
  const entries = useTenantCollection<ProductionEntry>(companyId, 'apontamentos', 'criadoEm')
  const reversals = useTenantCollection<ProductionReversal>(companyId, 'estornosApontamentos', 'entryId')
  const schedules = useTenantCollection<Program>(companyId, 'programacoes', 'opId')
  const [filter, setFilter] = useState<'todos' | Severity>('todos')
  const loading = products.loading || sheets.loading || materials.loading || orders.loading ||
    balances.loading || entries.loading || reversals.loading || schedules.loading
  const error = products.error || sheets.error || materials.error || orders.error || balances.error ||
    entries.error || reversals.error || schedules.error

  const findings = useMemo<Finding[]>(() => {
    const result: Finding[] = []
    const add = (severity: Severity, area: string, id: string, title: string, detail: string) =>
      result.push({ id: area + ':' + id, severity, area, title, detail })
    const productCodes = new Set(products.items.filter((p) => !p.excluido).map((p) => p.codigo))
    const publishedCodes = new Set(sheets.items.filter((f) => f.status === 'padrao').map((f) => f.produtoCodigo))
    const knownOrders = new Map(orders.items.map((o) => [o.id, o]))
    const today = toDate()
    for (const product of products.items) {
      if (!product.excluido && !publishedCodes.has(product.codigo)) {
        add('informativo', 'Engenharia', product.codigo, 'Produto sem Ficha Técnica publicada',
          product.codigo + ' · ' + product.descricao + '. Publique uma revisão antes de liberar novas OPs.')
      }
    }
    for (const order of orders.items) {
      if (order.excluido || order.status === 'cancelada') continue
      const active = !['concluida', 'rascunho'].includes(order.status)
      if (active) {
        const current = orderProgress(order, balances.items)
        if (current.missingOperations > 0) {
          add('critico', 'OP', order.id + ':noOps', order.numero + ' sem operações',
            current.missingOperations + ' item(ns) não possuem operações congeladas na liberação.')
        }
        if (current.ready && order.status !== 'concluida') {
          add('informativo', 'Produção', order.id + ':ready', order.numero + ' com produção finalizada',
            'Todas as unidades boas passaram pela última etapa. Confira as aprovações e conclua a OP.')
        }
      }
      for (const item of order.itens) {
        if (!productCodes.has(item.produtoCodigo)) {
          add('informativo', 'Rastreabilidade', order.id + ':' + item.id,
            'Produto arquivado aparece em ' + order.numero,
            'A OP preserva o snapshot de ' + item.produtoCodigo + '. Isso é esperado; não exclua o histórico.')
        }
        if (!active) continue
        for (const task of tasksForItem(order, item.id)) {
          const progress = stepProgress(order, task, balances.items)
          const row = balances.items.find((b) => b.id === task.id)
          if (row && (row.boas < 0 || row.defeituosas < 0 || row.total < 0 || row.boas + row.defeituosas !== row.total)) {
            add('critico', 'Saldos', task.id, 'Saldo inconsistente em ' + order.numero,
              'Operação ' + task.operacao.nome + ' possui boas + defeituosas diferentes do total.')
          }
          if (progress.processed > progress.available) {
            add('critico', 'Saldos', task.id + ':upstream', 'Fluxo acima da quantidade disponível',
              order.numero + ' · ' + task.operacao.nome + ': ' + progress.processed + '/' + progress.available + '.')
          }
          if (progress.defective > 0) {
            add('atencao', 'Qualidade', task.id + ':defeitos',
              'Retrabalho pendente em ' + order.numero,
              task.operacao.nome + ': ' + progress.defective + ' unidade(s) com defeito aguardando correção.')
          }
          if (!task.operacao.tempoPadraoMin || task.operacao.tempoPadraoMin <= 0) {
            add('atencao', 'Planejamento', task.id + ':tempo', 'Operação sem tempo-padrão',
              order.numero + ' · ' + task.operacao.nome + '. A carga não poderá ser calculada com precisão.')
          }
        }
      }
      if (active && order.prazo && order.prazo < today) {
        add('atencao', 'Prazo', order.id + ':atraso', order.numero + ' com necessidade vencida',
          'Data informada: ' + order.prazo.split('-').reverse().join('/') + '.')
      }
    }
    const taskIds = new Set(orders.items.flatMap((o) => (o.operacoes ?? []).map((t) => t.id)))
    for (const balance of balances.items) {
      if (!taskIds.has(balance.taskId)) {
        add('atencao', 'Saldos', balance.id + ':orphan', 'Saldo sem operação localizada',
          'Registro ' + balance.id + ' não corresponde a uma operação de OP carregada.')
      }
    }
    const reversalIds = new Set(reversals.items.map((row) => row.entryId))
    for (const entry of entries.items) {
      if (!knownOrders.has(entry.opId) && !reversalIds.has(entry.id)) {
        add('atencao', 'Apontamentos', entry.id, 'Apontamento sem OP encontrada',
          'Registro ' + entry.id + ' associado a ' + entry.opNumero + '.')
      }
    }
    for (const schedule of schedules.items) {
      if (schedule.excluido) continue
      const order = knownOrders.get(schedule.opId)
      if (!order || order.excluido || ['concluida', 'cancelada'].includes(order.status)) {
        add('informativo', 'Planejamento', schedule.id + ':stale', 'Programação fora das OPs ativas',
          'A programação ' + schedule.id + ' aponta para uma OP já encerrada ou não localizada.')
      }
    }
    if (companyId === 'principal') {
      add('critico', 'Segurança', 'principal', 'Workspace de teste sem autenticação individual',
        'As regras atuais do Firestore não verificam identidade no ambiente principal. Não utilize dados confidenciais nem abra o sistema para clientes.')
    }
    return result.sort((a, b) =>
      ['critico', 'atencao', 'informativo'].indexOf(a.severity) -
      ['critico', 'atencao', 'informativo'].indexOf(b.severity) ||
      a.area.localeCompare(b.area))
  }, [products.items, sheets.items, orders.items, balances.items, entries.items, reversals.items, schedules.items, companyId])
  const visible = findings.filter((issue) => filter === 'todos' || issue.severity === filter)
  const critical = findings.filter((issue) => issue.severity === 'critico').length
  const warnings = findings.filter((issue) => issue.severity === 'atencao').length

  if (loading) return <div className="loading-panel">Verificando consistência dos cadastros e das OPs...</div>
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Verificação automática</span>
      <h2>Diagnóstico do sistema</h2>
      <p>Inspeção somente leitura dos dados e vínculos, sem criar ou alterar nenhum registro.</p>
    </div></section>
    {error && <div className="form-error page-message">{error}</div>}
    <section className="pf-op-summary">
      <div><small>Críticos</small><strong>{critical}</strong></div>
      <div><small>Atenção</small><strong>{warnings}</strong></div>
      <div><small>OPs cadastradas</small><strong>{orders.items.filter((o) => !o.excluido).length}</strong></div>
      <div><small>Apontamentos</small><strong>{entries.items.length}</strong></div>
    </section>
    <section className="panel pf-form-card">
      <div className="pf-section-heading"><h3>Resultados da verificação</h3>
        <label className="pf-diagnostics-filter">Mostrar
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="todos">Todos</option><option value="critico">Críticos</option>
            <option value="atencao">Atenção</option><option value="informativo">Informações</option>
          </select>
        </label>
      </div>
      {visible.length === 0 && <div className="pf-diagnostic-empty"><CheckCircle2 size={24}/>
        <strong>Nenhum alerta encontrado nesse filtro.</strong>
        <small>Esta verificação não substitui testes de todas as ações nem uma auditoria de segurança.</small>
      </div>}
      <div className="pf-diagnostics-list">
        {visible.map((item) => <article className={'pf-finding pf-finding-' + item.severity} key={item.id}>
          <span className="pf-finding-icon">{item.severity === 'critico' ? <ShieldAlert size={19}/> :
            item.severity === 'atencao' ? <AlertTriangle size={19}/> : <Info size={19}/>}</span>
          <div><small>{badge(item.severity)} · {item.area}</small><strong>{item.title}</strong><p>{item.detail}</p></div>
        </article>)}
      </div>
    </section>
    <section className="panel pf-form-card">
      <div className="pf-section-heading"><h3><ClipboardCheck size={17}/> O que este diagnóstico cobre</h3></div>
      <p className="helper-text">Fichas publicadas, ordens sem operações, produção finalizada, saldos divergentes, peças com defeitos, tempos-padrão ausentes, vencimentos, referências arquivadas e programações antigas.</p>
      <p className="helper-text">O diagnóstico não acessa configurações de segurança implantadas no Firebase Console, nem simula todas as transações. Seu objetivo é antecipar problemas comuns antes dos testes manuais.</p>
    </section>
  </div>
}

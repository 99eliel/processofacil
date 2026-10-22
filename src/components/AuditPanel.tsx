import { History, Loader2 } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'

type AuditEntry = {
  id: string
  entidade: string
  entidadeId: string
  acao: string
  resumo?: string
  uid: string
  em?: unknown
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString('pt-BR')
  }
  return 'Agora'
}

export default function AuditPanel() {
  const { activeCompany } = useSystem()
  const { items, loading, error } = useTenantCollection<AuditEntry>(activeCompany?.id, 'auditoria', 'em')
  const ordered = [...items].reverse().slice(0, 100)

  return <section className="panel">
    <div className="panel-head"><div><span className="section-kicker">Rastreabilidade</span><h3>Auditoria da empresa</h3></div><History size={20} /></div>
    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="loading-panel compact-loading"><Loader2 className="spin" size={20} /> Carregando auditoria...</div> :
      ordered.length === 0 ? <div className="empty-state small-empty"><History size={28} /><strong>Sem eventos ainda</strong><span>Criações, alterações, publicações e liberações aparecerão aqui.</span></div> :
        <div className="audit-list">{ordered.map((entry) => <div className="audit-row" key={entry.id}><span className="audit-dot" /><div><strong>{entry.acao.replaceAll('_', ' ')}</strong><small>{entry.entidade} · {entry.resumo || entry.entidadeId}</small></div><div className="audit-meta"><span>{formatDate(entry.em)}</span><small>{entry.uid}</small></div></div>)}</div>}
  </section>
}

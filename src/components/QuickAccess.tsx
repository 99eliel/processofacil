import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Search, X } from 'lucide-react'
import type { ProductionOrderRecord } from '../domain/types'

type Area = 'inicio' | 'catalogo' | 'ordens' | 'planejamento' | 'producao' | 'gestao' | 'configuracoes'
type Props = {
  open: boolean
  onClose: () => void
  onNavigate: (area: Area, opId?: string) => void
  orders: ProductionOrderRecord[]
}
const modules: { key: Area; label: string; details: string; keywords: string }[] = [
  { key: 'inicio', label: 'Início', details: 'Visão geral e próximos passos', keywords: 'home dashboard' },
  { key: 'catalogo', label: 'Produtos e Fichas Técnicas', details: 'Cadastro, passaporte e materiais', keywords: 'produto ficha técnica material revisão' },
  { key: 'ordens', label: 'Ordens de Produção', details: 'Criar, liberar e consultar OPs', keywords: 'op pedido ordem necessidade' },
  { key: 'planejamento', label: 'Planejamento', details: 'Equipes, máquinas, cronometragem e balanceamento', keywords: 'pcp carga maquina tempo equipe' },
  { key: 'producao', label: 'Produção', details: 'Apontamentos, operações e retrabalho', keywords: 'executar produzir costureira quantidade defeito' },
  { key: 'gestao', label: 'Gestão e Relatórios', details: 'Resultados, filtros e exportação', keywords: 'relatorio produtividade indicadores pdf' },
  { key: 'configuracoes', label: 'Configurações', details: 'Empresa, aprovações e diagnóstico', keywords: 'admin seguranca usuarios' },
]
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
export default function QuickAccess({ open, onClose, onNavigate, orders }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!open) { setQuery(''); return }
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  const matches = useMemo(() => {
    const q = normalize(query)
    if (!q) return {
      navigation: modules.filter((entry) => entry.key !== 'inicio').slice(0, 5),
      orders: [...orders].filter((order) => !order.excluido).reverse().slice(0, 4),
    }
    return {
      navigation: modules.filter((entry) => normalize([entry.label, entry.details, entry.keywords].join(' ')).includes(q)),
      orders: orders.filter((order) => !order.excluido &&
        normalize([order.numero, order.status, order.observacao || '', ...(order.itens ?? []).flatMap((item) => [item.produtoCodigo, item.produtoDescricao])].join(' ')).includes(q)).slice(0, 8),
    }
  }, [orders, query])
  const go = (area: Area, opId?: string) => { onNavigate(area, opId); onClose() }
  if (!open) return null
  return <div className="pf-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="pf-search-dialog" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <div className="pf-search-input-row"><Search size={21}/><input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar uma tela, função, produto ou OP..." aria-label="Pesquisar no sistema"/>
        <button onClick={onClose} aria-label="Fechar busca"><X size={19}/></button></div>
      <div className="pf-search-results">
        {matches.navigation.length > 0 && <section><h3>Telas e funções</h3>{matches.navigation.map((item) =>
          <button key={item.key} onClick={() => go(item.key)}><span><strong>{item.label}</strong><small>{item.details}</small></span><ArrowRight size={17}/></button>)}</section>}
        {matches.orders.length > 0 && <section><h3>Ordens de Produção</h3>{matches.orders.map((item) =>
          <button key={item.id} onClick={() => go('ordens', item.id)}><span><strong>{item.numero}</strong>
            <small>{item.itens.map((p) => p.produtoDescricao).join(' · ')} · {item.status}</small></span><ArrowRight size={17}/></button>)}</section>}
        {matches.navigation.length === 0 && matches.orders.length === 0 && <div className="pf-search-empty">Nenhum resultado encontrado. Experimente pesquisar pelo número da OP ou por uma função.</div>}
      </div>
      <div className="pf-search-footer"><span>Digite para filtrar · Clique para abrir</span><span>ESC para fechar</span></div>
    </section>
  </div>
}

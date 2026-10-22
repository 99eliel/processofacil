import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Edit3,
  Factory,
  Loader2,
  PackageCheck,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { canActOnStage, nextStage, type WorkflowDefinition } from '../domain/workflowEngine'
import { emptyWorkflow, subscribeWorkflow } from '../firebase/workflowRepository'
import {
  advanceProductionOrder,
  cancelProductionOrderDraft,
  createProductionOrder,
  releaseProductionOrder,
  updateProductionOrderDraft,
  type NewOrderItem,
} from '../firebase/productionOrderRepository'
import type { ProductionOrderRecord, ProductionVariant, Product } from '../domain/types'

type DraftItem = {
  id: string
  produtoCodigo: string
  cor: string
  variantes: ProductionVariant[]
}

export default function ProductionOrdersPage({ notify }: { notify: (message: string) => void }) {
  const auth = useSystem()
  const empresaId = auth.activeCompany?.id
  const user = auth.user
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: orders, loading, error } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(emptyWorkflow)
  const [modal, setModal] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState('')
  const [selected, setSelected] = useState<ProductionOrderRecord | null>(null)
  const [prazo, setPrazo] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!empresaId) return
    return subscribeWorkflow(empresaId, setWorkflow, console.error)
  }, [empresaId])

  useEffect(() => {
    if (!selected) return
    const latest = orders.find((item) => item.id === selected.id)
    if (latest) setSelected(latest)
  }, [orders])

  const firstStage = [...workflow.etapas].sort((a, b) => a.ordem - b.ordem)[0] ?? null
  const profiles = auth.activeMembership?.perfis ?? []
  const canRelease = profiles.some((role) => ['admin', 'ppcp', 'planejamento'].includes(role)) || auth.activeCompany?.ownerUid === user?.uid

  const newDraftItem = (): DraftItem => ({
    id: crypto.randomUUID(),
    produtoCodigo: '',
    cor: '',
    variantes: [{ id: crypto.randomUUID(), nome: 'Padrão', quantidade: 1 }],
  })

  const addItem = () => {
    setDraftItems((current) => [...current, newDraftItem()])
  }

  const openNewOrder = () => {
    setEditingOrderId('')
    setPrazo('')
    setDraftItems([newDraftItem()])
    setLocalError('')
    setModal(true)
  }

  const openEditOrder = (order: ProductionOrderRecord) => {
    setEditingOrderId(order.id)
    setPrazo(order.prazo ?? '')
    setDraftItems(order.itens.map((item) => ({
      id: item.id || crypto.randomUUID(),
      produtoCodigo: item.produtoCodigo,
      cor: item.cor ?? '',
      variantes: item.variantes.map((variant) => ({
        ...variant,
        id: variant.id || crypto.randomUUID(),
      })),
    })))
    setLocalError('')
    setModal(true)
  }

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setDraftItems(draftItems.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const addVariant = (itemId: string) => {
    setDraftItems(draftItems.map((item) => item.id === itemId
      ? { ...item, variantes: [...item.variantes, { id: crypto.randomUUID(), nome: '', quantidade: 1 }] }
      : item))
  }

  const updateVariant = (itemId: string, variantId: string, patch: Partial<ProductionVariant>) => {
    setDraftItems(draftItems.map((item) => item.id === itemId ? {
      ...item,
      variantes: item.variantes.map((variant) => variant.id === variantId ? { ...variant, ...patch } : variant),
    } : item))
  }

  const saveOrder = async () => {
    if (!empresaId || !user) return
    const items: NewOrderItem[] = draftItems.map((item) => {
      const product = products.find((product) => product.codigo === item.produtoCodigo)
      return {
        produtoCodigo: item.produtoCodigo,
        produtoDescricao: product?.descricao ?? '',
        cor: item.cor.trim(),
        variantes: item.variantes.filter((variant) => variant.quantidade > 0),
      }
    })

    if (items.some((item) => !item.produtoCodigo)) {
      setLocalError('Selecione o produto de todos os itens.')
      return
    }

    setBusy(true)
    setLocalError('')
    try {
      if (editingOrderId) {
        await updateProductionOrderDraft(
          empresaId,
          user.uid,
          editingOrderId,
          { prazo, itens: items },
        )
        notify('Rascunho da OP atualizado.')
      } else {
        const result = await createProductionOrder(
          empresaId,
          user.uid,
          { prazo, itens: items },
        )
        notify(`${result.numero} criada.`)
      }

      setModal(false)
      setEditingOrderId('')
      setDraftItems([])
      setPrazo('')
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível salvar a OP.')
    } finally {
      setBusy(false)
    }
  }

  const cancelDraft = async (order: ProductionOrderRecord) => {
    if (!empresaId || !user) return

    const confirmed = window.confirm(
      `Cancelar ${order.numero}? O registro será preservado no histórico, mas não poderá ser liberado.`,
    )
    if (!confirmed) return

    setBusy(true)
    setLocalError('')
    try {
      await cancelProductionOrderDraft(empresaId, user.uid, order.id)
      notify('OP cancelada.')
      setSelected(null)
    } catch (reason) {
      console.error(reason)
      setLocalError(
        reason instanceof Error ? reason.message : 'Não foi possível cancelar a OP.',
      )
    } finally {
      setBusy(false)
    }
  }

  const release = async (order: ProductionOrderRecord) => {
    if (!empresaId || !user) return
    setBusy(true)
    setLocalError('')
    try {
      await releaseProductionOrder(empresaId, user.uid, order.id, firstStage?.id ?? null)
      notify('OP liberada com revisões e kit congelados.')
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível liberar a OP.')
    } finally {
      setBusy(false)
    }
  }

  const advance = async (order: ProductionOrderRecord) => {
    if (!empresaId || !user || !order.workflowStageId) return
    const stage = workflow.etapas.find((item) => item.id === order.workflowStageId)
    if (!stage) {
      setLocalError('A etapa atual não existe mais no workflow configurado.')
      return
    }
    const allowed = canActOnStage(stage, profiles) || profiles.includes('admin') || auth.activeCompany?.ownerUid === user.uid
    if (!allowed) {
      setLocalError(`Seu perfil não pode concluir a etapa “${stage.nome}”.`)
      return
    }
    const next = nextStage(workflow, stage.id)
    setBusy(true)
    try {
      await advanceProductionOrder(empresaId, user.uid, order.id, stage.id, next?.id ?? null, stage.nome)
      notify(next ? `OP avançou para ${next.nome}.` : 'Fluxo da OP concluído.')
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível avançar a OP.')
    } finally {
      setBusy(false)
    }
  }

  if (selected) {
    const stage = workflow.etapas.find((item) => item.id === selected.workflowStageId)
    return <>
      <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Voltar para OPs</button>
      <section className="detail-hero">
        <div><span className="op-number">{selected.numero}</span><h2>{selected.itens.length} produto(s)</h2><p>{selected.prazo ? `Prazo: ${selected.prazo}` : 'Sem prazo informado'} · {selected.kit.length} linha(s) de kit</p></div>
        <OrderStatus status={selected.status} />
      </section>
      {localError && <div className="form-error page-message">{localError}</div>}

      <div className="two-columns">
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Produtos congelados</span><h3>Itens da OP</h3></div><PackageCheck size={20} /></div>
          <div className="mini-list">{selected.itens.map((item) => <div key={item.id}><strong>{item.produtoCodigo} · {item.produtoDescricao}</strong><span>REV {item.revisao ? String(item.revisao).padStart(2, '0') : '—'}{item.cor ? ` · Cor/acabamento: ${item.cor}` : ''} · {item.quantidadeTotal} unidade(s) · {item.variantes.map((v) => `${v.nome}: ${v.quantidade}`).join(' · ')}</span></div>)}</div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Fluxo</span><h3>{stage?.nome ?? statusLabel(selected.status)}</h3></div><Factory size={20} /></div>
          {selected.status === 'rascunho' && <><p className="helper-text">Ao liberar, o sistema exige FT padrão de todos os produtos e congela revisão e kit.</p><button className="primary-button" disabled={!canRelease || busy} onClick={() => release(selected)}><Send size={16} /> Liberar OP</button></>}
          {selected.status === 'em_fluxo' && stage && <><p className="helper-text">Responsáveis: {stage.perfis.join(', ')}.</p><button className="primary-button" disabled={busy} onClick={() => advance(selected)}>Concluir etapa <ArrowRight size={16} /></button></>}
          {selected.status === 'concluida' && <div className="form-success">Fluxo concluído. O histórico da OP permanece preservado.</div>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Necessidade bruta</span><h3>Kit congelado</h3></div><span className="count-badge">{selected.kit.length}</span></div>
        {selected.kit.length === 0 ? <div className="empty-state small-empty"><Factory size={28} /><strong>Kit ainda não gerado</strong><span>Ele será calculado quando a OP for liberada.</span></div> :
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Material</th><th>Fornecedor</th><th>Quantidade</th><th>Unidade</th><th>Cor</th></tr></thead><tbody>{selected.kit.map((line) => <tr key={line.id}><td><strong>{line.codigoSnapshot}</strong></td><td>{line.descricaoSnapshot}</td><td>{line.fornecedorSnapshot || '—'}</td><td>{line.quantidadeNecessaria.toFixed(4)}</td><td>{line.unidade}</td><td>{line.corFixa || line.corRegra}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Rastreabilidade</span><h3>Histórico</h3></div></div>
        <div className="timeline">{[...(selected.historico ?? [])].reverse().map((entry) => <div key={entry.id}><i /><strong>{entry.acao}</strong><small>Usuário: {entry.uid}</small></div>)}</div>
      </section>
    </>
  }

  const ordered = useMemo(() => [...orders].reverse(), [orders])

  return <>
    <section className="page-intro">
      <div><span className="section-kicker">Planejamento</span><h2>Ordens de Produção</h2><p>OPs reais com vários produtos, variantes e kit congelado a partir das revisões padrão.</p></div>
      <button className="primary-button" onClick={() => { setDraftItems([]); addItem(); setModal(true); setLocalError('') }}><Plus size={18} /> Nova OP</button>
    </section>
    {localError && <div className="form-error page-message">{localError}</div>}
    {error && <div className="form-error page-message">{error}</div>}
    {loading ? <div className="loading-panel"><Loader2 className="spin" size={24} /> Carregando OPs...</div> :
      <div className="op-list">{ordered.length === 0 ? <section className="panel"><div className="empty-state"><Factory size={30} /><strong>Nenhuma OP criada</strong><span>Crie uma ordem para iniciar o planejamento.</span></div></section> : ordered.map((order) => {
        const stage = workflow.etapas.find((item) => item.id === order.workflowStageId)
        return <button className="op-card" key={order.id} onClick={() => setSelected(order)}><div className="op-top"><div><span className="op-number">{order.numero}</span><h3>{order.itens.length} produto(s) · {order.itens.reduce((sum, item) => sum + item.quantidadeTotal, 0)} unidade(s)</h3><small>{stage ? `Etapa: ${stage.nome}` : statusLabel(order.status)}{order.prazo ? ` · Prazo ${order.prazo}` : ''}</small></div><OrderStatus status={order.status} /></div></button>
      })}</div>}

    {modal && <div className="modal-backdrop"><section className="form-modal op-modal">
      <div className="modal-head"><div><span className="section-kicker">Planejamento</span><h2>Nova Ordem de Produção</h2></div><button className="icon-button" onClick={() => setModal(false)}><X size={18} /></button></div>
      <div className="op-form-body">
        <label className="editor-label"><span>Prazo (opcional)</span><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
        {draftItems.map((item, index) => <div className="op-item-editor" key={item.id}>
          <div className="op-item-head"><strong>Item {index + 1}</strong><button className="icon-button danger-icon" onClick={() => setDraftItems(draftItems.filter((entry) => entry.id !== item.id))}><Trash2 size={14} /></button></div>
          <label className="editor-label"><span>Produto *</span><select value={item.produtoCodigo} onChange={(e) => updateItem(item.id, { produtoCodigo: e.target.value })}><option value="">Selecione...</option>{products.filter((product) => product.status === 'ativo').map((product) => <option key={product.id} value={product.codigo}>{product.codigo} — {product.descricao}</option>)}</select></label>
          <label className="editor-label"><span>Cor / acabamento do produto</span><input value={item.cor} onChange={(e) => updateItem(item.id, { cor: e.target.value })} placeholder="Ex.: Azul marinho, natural, galvanizado..." /></label>
          <div className="variant-list">{item.variantes.map((variant) => <div className="variant-row" key={variant.id}><input value={variant.nome} onChange={(e) => updateVariant(item.id, variant.id, { nome: e.target.value })} placeholder="Variante / tamanho / versão" /><input type="number" min={1} value={variant.quantidade} onChange={(e) => updateVariant(item.id, variant.id, { quantidade: Number(e.target.value) })} /><button className="icon-button" onClick={() => updateItem(item.id, { variantes: item.variantes.filter((entry) => entry.id !== variant.id) })}><Trash2 size={14} /></button></div>)}</div>
          <button className="text-button" onClick={() => addVariant(item.id)}><Plus size={14} /> Adicionar variante</button>
        </div>)}
        <button className="secondary-button compact" onClick={addItem}><Plus size={15} /> Adicionar produto</button>
        {localError && <div className="form-error">{localError}</div>}
      </div>
      <div className="modal-actions"><button className="secondary-button" onClick={() => setModal(false)}>Cancelar</button><button className="primary-button" onClick={create} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} Criar OP</button></div>
    </section></div>}
  </>
}

function OrderStatus({ status }: { status: ProductionOrderRecord['status'] }) {
  const tone = status === 'concluida' ? 'green' : status === 'rascunho' ? 'slate' : status === 'reprovada' ? 'red' : 'blue'
  return <span className={`status status-${tone}`}>{statusLabel(status)}</span>
}

function statusLabel(status: string) {
  if (status === 'rascunho') return 'Rascunho'
  if (status === 'liberada') return 'Liberada'
  if (status === 'em_fluxo') return 'Em fluxo'
  if (status === 'concluida') return 'Concluída'
  if (status === 'cancelada') return 'Cancelada'
  if (status === 'reprovada') return 'Reprovada'
  return status
}

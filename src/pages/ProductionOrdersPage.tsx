import { completeProductionOrder, type ProductionBalance } from '../firebase/productionLedger'
import { useEffect, useState } from 'react'
import { orderProgress, stepProgress } from '../domain/progressEngine'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Edit3,
  Factory,
  Loader2,
  PackageCheck,
  Search,
  Filter,
  Plus,
  RotateCcw,
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
  setProductionOrderDeleted,
  updateProductionOrderDraft,
  updateProductionOrderMetadata,
  type NewOrderItem,
} from '../firebase/productionOrderRepository'
import type { ProductionOrderRecord, ProductionVariant, Product } from '../domain/types'

type DraftItem = {
  id: string
  produtoCodigo: string
  cor: string
  variantes: ProductionVariant[]
}

export default function ProductionOrdersPage({ notify, openProduction, initialOrderId }: {
  notify: (message: string) => void
  openProduction?: (opId?: string) => void
  initialOrderId?: string
}) {
  const auth = useSystem()
  const empresaId = auth.activeCompany?.id
  const user = auth.user
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: orders, loading, error } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const { items: operationBalances } = useTenantCollection<ProductionBalance>(empresaId, 'saldosOperacoes', 'taskId')
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(emptyWorkflow)
  const [modal, setModal] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState('')
  const [metadataOnly, setMetadataOnly] = useState(false)
  const [selected, setSelected] = useState<ProductionOrderRecord | null>(null)
  const [prazo, setPrazo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [advancedIds, setAdvancedIds] = useState<string[]>([])
  const [focusedOrderId, setFocusedOrderId] = useState('')
  const [pendingNewId, setPendingNewId] = useState('')
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

  useEffect(() => {
    if (!initialOrderId || focusedOrderId === initialOrderId) return
    const found = orders.find((order) => order.id === initialOrderId)
    if (found) { setSelected(found); setFocusedOrderId(initialOrderId) }
  }, [initialOrderId, focusedOrderId, orders])

  useEffect(() => {
    if (!pendingNewId) return
    const found = orders.find((order) => order.id === pendingNewId)
    if (found) { setSelected(found); setPendingNewId('') }
  }, [orders, pendingNewId])

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
    setMetadataOnly(false)
    setPrazo('')
    setObservacao('')
    setDraftItems([newDraftItem()])
    setAdvancedIds([])
    setLocalError('')
    setModal(true)
  }

  const openEditOrder = (order: ProductionOrderRecord) => {
    setEditingOrderId(order.id)
    setMetadataOnly(order.status !== 'rascunho')
    setPrazo(order.prazo ?? '')
    setObservacao(order.observacao ?? '')
    setDraftItems(order.itens.map((item) => ({
      id: item.id || crypto.randomUUID(),
      produtoCodigo: item.produtoCodigo,
      cor: item.cor ?? '',
      variantes: item.variantes.map((variant) => ({
        ...variant,
        id: variant.id || crypto.randomUUID(),
      })),
    })))
    setAdvancedIds(order.itens.filter((item) => item.variantes.length !== 1
      || item.variantes[0]?.nome !== 'Padrão').map((item) => item.id))
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

    if (items.length === 0 || items.some((item) => !item.produtoCodigo)) {
      setLocalError('Adicione pelo menos um produto e selecione todos os itens.')
      return
    }
    if (items.some((item) => item.variantes.length === 0 || item.variantes.some((variant) =>
      !Number.isSafeInteger(variant.quantidade) || variant.quantidade <= 0))) {
      setLocalError('Cada produto precisa ter quantidades inteiras e maiores que zero.')
      return
    }

    setBusy(true)
    setLocalError('')
    try {
      if (editingOrderId) {
        if (metadataOnly) {
          await updateProductionOrderMetadata(
            empresaId,
            user.uid,
            editingOrderId,
            { prazo, observacao },
          )
          notify('Dados gerais da OP atualizados.')
        } else {
          await updateProductionOrderDraft(
            empresaId,
            user.uid,
            editingOrderId,
            { prazo, observacao, itens: items },
          )
          notify('Rascunho da OP atualizado.')
        }
      } else {
        const result = await createProductionOrder(
          empresaId,
          user.uid,
          { prazo, observacao, itens: items },
        )
        notify(`${result.numero} criada. Confira e clique em Liberar OP quando estiver pronta.`)
        setPendingNewId(result.id)
      }

      setModal(false)
      setEditingOrderId('')
      setMetadataOnly(false)
      setDraftItems([])
      setPrazo('')
      setObservacao('')
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

  const toggleDeleted = async (order: ProductionOrderRecord) => {
    if (!empresaId || !user) return
    const restoring = Boolean(order.excluido)

    if (!restoring) {
      const confirmed = window.confirm(
        `Excluir ${order.numero}?\n\nA OP sairá das telas normais, mas seu histórico, itens, kit e rastreabilidade serão preservados e ela poderá ser restaurada.`,
      )
      if (!confirmed) return
    }

    setBusy(true)
    setLocalError('')
    try {
      await setProductionOrderDeleted(empresaId, user.uid, order.id, !restoring)
      notify(restoring ? 'OP restaurada.' : 'OP excluída da visualização.')
      if (selected?.id === order.id) setSelected(null)
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível alterar a OP.')
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


  const finishProduction = async (order: ProductionOrderRecord) => {
    if (!empresaId || !user) return
    setBusy(true); setLocalError('')
    try {
      await completeProductionOrder(empresaId, user.uid, order.id)
      notify('OP concluída e registrada no histórico.')
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível concluir a OP.')
    } finally {
      setBusy(false)
    }
  }

  if (selected) {
    const stage = workflow.etapas.find((item) => item.id === selected.workflowStageId)
    return <>
      <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Voltar para OPs</button>
      <section className="detail-hero">
        <div><span className="op-number">{selected.numero}</span><h2>{selected.itens.length} produto(s)</h2><p>{selected.prazo ? `Necessidade: ${selected.prazo}` : 'Necessidade não informada'} · {selected.kit.length} linha(s) de kit</p>{selected.observacao && <small className="op-observation">{selected.observacao}</small>}</div>
        <div className="detail-hero-actions">
          <OrderStatus status={selected.status} />
          {openProduction && !selected.excluido && ['liberada', 'em_fluxo', 'reprovada'].includes(selected.status) &&
            <button className="secondary-button compact" onClick={() => openProduction(selected.id)}><Factory size={15}/> Abrir produção</button>}
          {!selected.excluido && <button className="secondary-button compact" disabled={busy} onClick={() => openEditOrder(selected)}><Edit3 size={15} /> Editar</button>}
          <button className={selected.excluido ? 'secondary-button compact' : 'danger-button compact'} disabled={busy} onClick={() => void toggleDeleted(selected)}>
            {selected.excluido ? <RotateCcw size={15} /> : <Trash2 size={15} />} {selected.excluido ? 'Restaurar' : 'Excluir'}
          </button>
        </div>
      </section>
      {localError && <div className="form-error page-message" role="alert">{localError}</div>}
      {selected.status !== 'rascunho' && selected.status !== 'cancelada' && !selected.excluido && (() => {
        const progress = orderProgress(selected, operationBalances)
        return <section className="panel pf-order-summary">
          <div className="pf-order-summary-top">
            <div><span className="section-kicker">AVANÇO DA PRODUÇÃO</span><h3>{progress.percentage}% concluído</h3></div>
            <strong>{progress.finished} de {progress.planned} peças boas acabadas</strong>
          </div>
          <div className="pf-progress"><span style={{ width: progress.percentage + '%' }}/></div>
          {progress.remaining > 0 && <p className="helper-text">Faltam {progress.remaining} unidades boas para concluir a produção.</p>}
          {progress.ready && <p className="form-success">Todas as quantidades finais foram apontadas. Confira as aprovações e conclua a OP.</p>}
          {progress.missingOperations > 0 && <p className="form-error">{progress.missingOperations} item(ns) sem operações congeladas.</p>}
          <div className="pf-order-task-preview">
            {(selected.operacoes ?? []).slice(0, 8).map((task) => {
              const step = stepProgress(selected, task, operationBalances)
              return <div key={task.id}><span>{task.operacao.nome}</span><strong>{step.good}/{step.target} boas</strong></div>
            })}
          </div>
        </section>
      })()}

      <div className="two-columns">
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Produtos congelados</span><h3>Itens da OP</h3></div><PackageCheck size={20} /></div>
          <div className="mini-list">{selected.itens.map((item) => <div key={item.id}><strong>{item.produtoCodigo} · {item.produtoDescricao}</strong><span>REV {item.revisao ? String(item.revisao).padStart(2, '0') : '—'}{item.cor ? ` · Cor/acabamento: ${item.cor}` : ''} · {item.quantidadeTotal} unidade(s) · {item.variantes.map((v) => `${v.nome}: ${v.quantidade}`).join(' · ')}</span></div>)}</div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Fluxo</span><h3>{stage?.nome ?? statusLabel(selected.status)}</h3></div><Factory size={20} /></div>
          {selected.excluido && <div className="info-banner"><Trash2 size={18} /><div><strong>OP excluída</strong><span>Restaure esta ordem para voltar a operá-la.</span></div></div>}
          {selected.status === 'rascunho' && !selected.excluido && <>
            <p className="helper-text">Ao liberar, o sistema exige FT padrão de todos os produtos e congela revisão e kit. Antes disso, o rascunho pode ser alterado ou cancelado.</p>
            <div className="draft-order-actions">
              <button className="secondary-button" disabled={busy} onClick={() => openEditOrder(selected)}><Edit3 size={16} /> Editar itens</button>
              <button className="primary-button" disabled={!canRelease || busy} onClick={() => release(selected)}><Send size={16} /> Liberar OP</button>
              <button className="danger-button" disabled={busy} onClick={() => cancelDraft(selected)}><Ban size={16} /> Cancelar OP</button>
            </div>
          </>}
          {['liberada', 'em_fluxo'].includes(selected.status) && !selected.excluido && !stage && <button className="primary-button" disabled={busy} onClick={() => void finishProduction(selected)}>Concluir OP (conferir quantidades)</button>}
          {selected.status === 'em_fluxo' && !selected.excluido && stage && <><p className="helper-text">Responsáveis: {stage.perfis.join(', ')}.</p><button className="primary-button" disabled={busy} onClick={() => advance(selected)}>Concluir etapa <ArrowRight size={16} /></button></>}
          {selected.status === 'concluida' && !selected.excluido && <div className="form-success">Fluxo concluído. O histórico da OP permanece preservado.</div>}
        </section>
      </div>

      <details className="panel pf-order-expand">
        <summary><strong>Materiais necessários (kit congelado)</strong><span>{selected.kit.length} linhas · Ver detalhes</span></summary>
        {selected.kit.length === 0 ? <div className="empty-state small-empty"><Factory size={28} /><strong>Kit ainda não gerado</strong><span>Ele será calculado quando a OP for liberada.</span></div> :
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Material</th><th>Fornecedor</th><th>Quantidade</th><th>Unidade</th><th>Cor</th></tr></thead><tbody>{selected.kit.map((line) => <tr key={line.id}><td><strong>{line.codigoSnapshot}</strong></td><td>{line.descricaoSnapshot}</td><td>{line.fornecedorSnapshot || '—'}</td><td>{line.quantidadeNecessaria.toFixed(4)}</td><td>{line.unidade}</td><td>{line.corFixa || line.corRegra}</td></tr>)}</tbody></table></div>}
      </details>

      <details className="panel pf-order-expand">
        <summary><strong>Histórico e rastreabilidade</strong><span>Ver registros</span></summary>
        <p className="helper-text">A conclusão por produção exige que a última operação de cada produto tenha todas as unidades boas apontadas. Uma OP com aprovações em andamento deve finalizar seu Workflow antes.</p>
        <div className="timeline">{[...(selected.historico ?? [])].reverse().map((entry) => <div key={entry.id}><i /><strong>{entry.acao}</strong><small>Usuário: {entry.uid}</small></div>)}</div>
      </details>
    </>
  }

  const now = new Date()
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
  const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const query = norm(search.trim())
  const ordered = [...orders]
    .filter((order) => showDeleted ? Boolean(order.excluido) : !order.excluido)
    .filter((order) => statusFilter === 'todos' || order.status === statusFilter)
    .filter((order) => !query || norm([order.numero, order.status, order.observacao ?? '',
      ...order.itens.flatMap((item) => [item.produtoCodigo, item.produtoDescricao])].join(' ')).includes(query))
    .reverse()

  return <>
    <section className="page-intro">
      <div><span className="section-kicker">Planejamento</span><h2>Ordens de Produção</h2><p>OPs reais com vários produtos, variantes e kit congelado a partir das revisões padrão.</p></div>
      <div className="page-intro-actions">
        <button className={`filter-button ${showDeleted ? 'filter-active danger-filter' : ''}`} onClick={() => setShowDeleted((value) => !value)}>
          {showDeleted ? <RotateCcw size={17} /> : <Trash2 size={17} />} {showDeleted ? 'Voltar às OPs' : 'Excluídas'}
        </button>
        <button className="primary-button" onClick={openNewOrder}><Plus size={18} /> Nova OP</button>
      </div>
    </section>
    <section className="pf-orders-filters" aria-label="Encontrar ordens de produção">
      <label><Search size={18}/><input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por número, produto ou observação..." aria-label="Buscar ordens"/></label>
      <label className="pf-order-status-filter"><Filter size={15}/>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar situação da OP">
          <option value="todos">Todas as situações</option>
          <option value="rascunho">Aguardando liberação</option>
          <option value="liberada">Liberadas</option>
          <option value="em_fluxo">Em produção</option>
          <option value="reprovada">Reprovadas</option>
          <option value="concluida">Concluídas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </label>
    </section>
    {localError && <div className="form-error page-message" role="alert">{localError}</div>}
    {error && <div className="form-error page-message" role="alert">{error}</div>}
    {loading ? <div className="loading-panel"><Loader2 className="spin" size={24} /> Carregando OPs...</div> :
      <div className="op-list">{ordered.length === 0 ? <section className="panel"><div className="empty-state"><Factory size={30} /><strong>Nenhuma OP encontrada</strong>
        <span>{search || statusFilter !== 'todos' ? 'Tente outros filtros ou limpe a pesquisa.' : 'Crie uma ordem para iniciar o planejamento.'}</span>
        {(search || statusFilter !== 'todos') && <button className="secondary-button compact" onClick={() => { setSearch(''); setStatusFilter('todos') }}>Limpar filtros</button>}
      </div></section> : ordered.map((order) => {
        const stage = workflow.etapas.find((item) => item.id === order.workflowStageId)
        const progress = orderProgress(order, operationBalances)
        const late = !['rascunho','concluida','cancelada'].includes(order.status) && order.prazo && order.prazo < today
        return <article className={`op-card manageable-op-card ${order.excluido ? 'deleted-record' : ''}`} key={order.id}>
          <button className="op-card-main" onClick={() => setSelected(order)}>
            <div className="op-top"><div><span className="op-number">{order.numero}</span><h3>{order.itens.map((item) => item.produtoDescricao).join(' · ')}</h3>
              <small>{order.itens.length} produto(s) · {progress.planned} unidade(s) · {stage ? `Etapa: ${stage.nome}` : statusLabel(order.status)}</small>
              {late && <small className="pf-order-overdue">Necessidade vencida: {order.prazo}</small>}
              {order.observacao && <small>{order.observacao}</small>}
            </div><OrderStatus status={order.status}/></div>
            {order.status !== 'rascunho' && <div className="pf-order-progress-line">
              <span className="pf-progress"><span style={{ width: progress.percentage + '%' }}/></span>
              <strong>{progress.percentage}%</strong>
            </div>}
          </button>
          <div className="op-card-actions">
            {!order.excluido && <button title="Editar" onClick={() => openEditOrder(order)}><Edit3 size={15} /> Editar</button>}
            <button className={order.excluido ? 'restore-action' : 'danger-action'} onClick={() => void toggleDeleted(order)}>
              {order.excluido ? <RotateCcw size={15} /> : <Trash2 size={15} />} {order.excluido ? 'Restaurar' : 'Excluir'}
            </button>
          </div>
        </article>
      })}</div>}

    {modal && <div className="modal-backdrop"><section className="form-modal op-modal">
      <div className="modal-head"><div><span className="section-kicker">CADASTRO SIMPLIFICADO</span><h2>{editingOrderId ? 'Editar Ordem de Produção' : 'Nova Ordem de Produção'}</h2>
        {!editingOrderId && <p className="helper-text">Selecione o produto e informe a quantidade. Os demais detalhes são opcionais.</p>}</div><button className="icon-button" onClick={() => setModal(false)}><X size={18} /></button></div>
      <div className="op-form-body">
        <label className="editor-label"><span>Necessidade (data desejada)</span><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
        {metadataOnly && <div className="info-banner"><Factory size={18} /><div><strong>OP já liberada</strong><span>Para preservar rastreabilidade, produtos, quantidades, revisão, kit e operações congeladas não são alterados. Você ainda pode editar necessidade e observação.</span></div></div>}
        {!metadataOnly && draftItems.map((item, index) => <div className="op-item-editor" key={item.id}>
          <div className="op-item-head"><strong>Produto {index + 1}</strong><button className="icon-button danger-icon" title="Remover este produto" disabled={draftItems.length <= 1} onClick={() => setDraftItems(draftItems.filter((entry) => entry.id !== item.id))}><Trash2 size={14}/></button></div>
          <label className="editor-label"><span>Produto *</span><select value={item.produtoCodigo} onChange={(e) => updateItem(item.id, { produtoCodigo: e.target.value })}><option value="">Selecione...</option>{products.filter((product) => product.status === 'ativo' && !product.excluido).map((product) => <option key={product.id} value={product.codigo}>{product.codigo} — {product.descricao}</option>)}</select></label>
          {!advancedIds.includes(item.id) && item.variantes.length === 1 && <label className="editor-label pf-simple-quantity">
            <span>Quantidade de unidades *</span><input type="number" inputMode="numeric" min={1} step={1} value={item.variantes[0].quantidade}
              onChange={(e) => updateVariant(item.id, item.variantes[0].id, { quantidade: Number(e.target.value) })}/>
          </label>}
          <button type="button" className="pf-optional-toggle" onClick={() => setAdvancedIds((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : [...old, item.id])}>
            {advancedIds.includes(item.id) ? 'Ocultar detalhes do produto' : 'Adicionar cor, tamanho ou versões (opcional)'}
          </button>
          {advancedIds.includes(item.id) && <>
            <label className="editor-label"><span>Cor / acabamento (opcional)</span><input value={item.cor} onChange={(e) => updateItem(item.id, { cor: e.target.value })} placeholder="Ex.: Azul marinho, natural, galvanizado..."/></label>
            <div className="pf-variants-caption">Tamanhos ou versões e quantidade de cada um</div>
            <div className="variant-list">{item.variantes.map((variant) => <div className="variant-row" key={variant.id}>
              <input value={variant.nome} onChange={(e) => updateVariant(item.id, variant.id, { nome: e.target.value })} aria-label="Nome da variante" placeholder="Ex.: P, M, G ou Padrão"/>
              <input type="number" min={1} step={1} inputMode="numeric" aria-label="Quantidade da variante" value={variant.quantidade} onChange={(e) => updateVariant(item.id, variant.id, { quantidade: Number(e.target.value) })}/>
              <button className="icon-button" title="Remover variante" disabled={item.variantes.length <= 1} onClick={() => updateItem(item.id, { variantes: item.variantes.filter((entry) => entry.id !== variant.id) })}><Trash2 size={14}/></button>
            </div>)}</div>
            <button className="text-button" onClick={() => addVariant(item.id)}><Plus size={14}/> Adicionar tamanho ou versão</button>
          </>}
        </div>)}
        {!metadataOnly && <button className="secondary-button compact" onClick={addItem}><Plus size={15}/> Adicionar outro produto à mesma OP</button>}
        <label className="editor-label"><span>Observações (opcional)</span><textarea rows={2} value={observacao}
          onChange={(e) => setObservacao(e.target.value)} placeholder="Informação adicional para a produção, se necessário"/></label>
        {!metadataOnly && <p className="pf-order-tip">A OP começa como rascunho. Depois de revisar, clique em <strong>Liberar OP</strong> para iniciar a produção.</p>}
        {localError && <div className="form-error" role="alert">{localError}</div>}
      </div>
      <div className="modal-actions"><button className="secondary-button" onClick={() => setModal(false)}>Cancelar</button><button className="primary-button" onClick={saveOrder} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} {editingOrderId ? (metadataOnly ? 'Salvar dados gerais' : 'Salvar alterações') : 'Criar OP'}</button></div>
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

import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Edit3, GitBranch, Loader2, PackageCheck, Plus, RotateCcw, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { createProduct, generateNextProductCode, setProductActive, setProductDeleted, updateProduct } from '../firebase/productRepository'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { Product } from '../domain/types'
import type { CodeStrategy } from '../domain/codeEngine'

type ClassificationRow = { id: string; chave: string; valor: string }

export default function ProductsPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, settings, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: products, loading, error } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [description, setDescription] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [externalCode, setExternalCode] = useState('')
  const [segmentValues, setSegmentValues] = useState<Record<string, string>>({})
  const [classificationRows, setClassificationRows] = useState<ClassificationRow[]>([])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const strategy = settings.estrategiaCodigo as CodeStrategy
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((product) => {
      if (!showDeleted && product.excluido) return false
      if (showDeleted && !product.excluido) return false
      if (!showInactive && product.status === 'inativo' && !product.excluido) return false
      if (!term) return true
      return [product.codigo, product.descricao, ...Object.values(product.classificacoes ?? {})]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [products, search, showInactive, showDeleted])

  const openCreate = () => {
    setEditing(null)
    setDescription('')
    setManualCode('')
    setExternalCode('')
    setSegmentValues({})
    setClassificationRows([])
    setFormError('')
    setModal(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setDescription(product.descricao)
    setClassificationRows(
      Object.entries(product.classificacoes ?? {}).map(([chave, valor]) => ({
        id: crypto.randomUUID(),
        chave,
        valor,
      })),
    )
    setFormError('')
    setModal(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user) return
    if (!description.trim()) {
      setFormError('Informe a descrição do produto.')
      return
    }

    setBusy(true)
    setFormError('')
    try {
      if (editing) {
        const classifications = Object.fromEntries(
          classificationRows
            .map((row) => [row.chave.trim(), row.valor.trim()] as const)
            .filter(([key]) => Boolean(key)),
        )
        await updateProduct(empresaId, user.uid, editing.codigo, {
          descricao: description,
          classificacoes: classifications,
        })
        notify(`Produto ${editing.codigo} atualizado.`)
      } else {
        const codigo = await generateNextProductCode(empresaId, strategy, {
          manual: manualCode,
          external: externalCode,
          segmentValues,
        })

        const customClassifications = Object.fromEntries(
          classificationRows
            .map((row) => [row.chave.trim(), row.valor.trim()] as const)
            .filter(([key]) => Boolean(key)),
        )
        const classifications = strategy.tipo === 'segmentado'
          ? {
              ...Object.fromEntries((strategy.segmentos ?? []).map((segment) => [segment.nome, segmentValues[segment.id] ?? ''])),
              ...customClassifications,
            }
          : customClassifications

        await createProduct(empresaId, user.uid, {
          codigo,
          descricao: description,
          classificacoes: classifications,
        })

        notify(`Produto ${codigo} criado.`)
      }

      setModal(false)
      setEditing(null)
      setDescription('')
      setManualCode('')
      setExternalCode('')
      setSegmentValues({})
      setClassificationRows([])
    } catch (reason) {
      console.error(reason)
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar o produto.')
    } finally {
      setBusy(false)
    }
  }

  const toggleState = async (product: Product) => {
    if (!empresaId || !user) return
    const next = product.status !== 'ativo'
    try {
      await setProductActive(empresaId, user.uid, product.codigo, next)
      notify(next ? 'Produto reativado.' : 'Produto inativado.')
    } catch (reason) {
      console.error(reason)
      notify('Não foi possível alterar o status do produto.')
    }
  }

  const toggleDeleted = async (product: Product) => {
    if (!empresaId || !user) return
    const restoring = Boolean(product.excluido)
    if (!restoring) {
      const confirmed = window.confirm(
        `Excluir ${product.codigo} · ${product.descricao}?\n\nO produto sairá das telas normais, mas o histórico e as Fichas Técnicas serão preservados e ele poderá ser restaurado.`,
      )
      if (!confirmed) return
    }

    setBusy(true)
    try {
      await setProductDeleted(empresaId, user.uid, product.codigo, !restoring)
      notify(restoring ? 'Produto restaurado.' : 'Produto excluído da visualização.')
      if (editing?.codigo === product.codigo) setModal(false)
    } catch (reason) {
      console.error(reason)
      notify(reason instanceof Error ? reason.message : 'Não foi possível alterar o produto.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="page-intro">
      <div>
        <span className="section-kicker">Cadastro universal</span>
        <h2>Produtos</h2>
        <p>O código segue a estratégia configurada pela empresa. Produtos podem existir antes da publicação de uma Ficha Técnica.</p>
      </div>
      <button className="primary-button" onClick={openCreate}><Plus size={18} /> Novo produto</button>
    </section>

    <section className="panel code-builder">
      <div className="panel-head">
        <div><span className="section-kicker">Estratégia ativa</span><h3>{strategyLabel(strategy.tipo)}</h3></div>
        <span className="status status-green">Configurada</span>
      </div>
      {strategy.tipo === 'segmentado' && <div className="segment-row">{(strategy.segmentos ?? []).map((segment) => <div className="segment-card" key={segment.id}><span>{segment.ordem}</span><div><strong>{segment.nome}</strong><small>{segment.tamanho} caracteres</small></div></div>)}</div>}
      <p className="helper-text">Esta configuração pertence somente a <strong>{activeCompany?.nomeFantasia}</strong> e pode ser alterada por um administrador.</p>
    </section>

    <div className="toolbar">
      <div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, descrição ou classificação..." /></div>
      <button className={`filter-button ${showInactive ? 'filter-active' : ''}`} onClick={() => setShowInactive((value) => !value)}>{showInactive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />} Inativos</button>
      <button className={`filter-button ${showDeleted ? 'filter-active danger-filter' : ''}`} onClick={() => setShowDeleted((value) => !value)}>
        {showDeleted ? <RotateCcw size={17} /> : <Trash2 size={17} />} {showDeleted ? 'Voltar aos produtos' : 'Excluídos'}
      </button>
    </div>
    {error && <div className="form-error page-message">{error}</div>}

    {loading ? <div className="loading-panel"><Loader2 className="spin" size={25} /> Carregando produtos...</div> :
      <section className="panel">
        {filtered.length === 0 ? <div className="empty-state"><PackageCheck size={30} /><strong>Nenhum produto cadastrado</strong><span>Crie o primeiro produto usando a estratégia de código da empresa.</span></div> :
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Classificações</th><th>Revisão vigente</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><strong>{product.codigo}</strong></td><td>{product.descricao}</td><td>{Object.entries(product.classificacoes ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || '—'}</td><td>{product.revisaoVigente ? `REV ${String(product.revisaoVigente).padStart(2, '0')}` : 'Sem FT padrão'}</td><td>{product.excluido
  ? <span className="status status-red">Excluído</span>
  : <span className={`status ${product.status === 'ativo' ? 'status-green' : 'status-slate'}`}>{product.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
}</td><td><div className="row-actions">
  {!product.excluido && <button title="Editar" onClick={() => openEdit(product)}><Edit3 size={15} /></button>}
  {!product.excluido && <button title={product.status === 'ativo' ? 'Inativar' : 'Reativar'} onClick={() => toggleState(product)}>{product.status === 'ativo' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button>}
  <button className={product.excluido ? 'restore-action' : 'danger-action'} title={product.excluido ? 'Restaurar' : 'Excluir'} onClick={() => void toggleDeleted(product)}>
    {product.excluido ? <RotateCcw size={15} /> : <Trash2 size={15} />}
  </button>
</div></td></tr>)}</tbody></table></div>}
      </section>}

    {modal && <div className="modal-backdrop"><form className="form-modal" onSubmit={submit}>
      <div className="modal-head"><div><span className="section-kicker">{editing ? 'Alteração controlada' : 'Novo cadastro'}</span><h2>{editing ? 'Editar produto' : 'Novo produto'}</h2></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X size={18} /></button></div>
      <div className="form-grid">
        {editing && <div className="info-banner span-2"><GitBranch size={18} /><div><strong>{editing.codigo}</strong><span>O código é imutável nesta edição. Mudanças estruturais devem usar uma migração controlada.</span></div></div>}
        <label className="span-2"><span>Descrição *</span><input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Nome/descrição do produto" /></label>

        <div className="span-2 product-classification-editor">
          <div className="classification-editor-head">
            <div><span>Classificações</span><small>Campos livres do produto: família, modelo, coleção, cor ou qualquer outra classificação.</small></div>
            <button type="button" className="secondary-button compact" onClick={() => setClassificationRows([...classificationRows, { id: crypto.randomUUID(), chave: '', valor: '' }])}><Plus size={14} /> Adicionar campo</button>
          </div>
          {classificationRows.length === 0 ? <div className="classification-empty">Nenhuma classificação adicional.</div> :
            <div className="classification-row-list">{classificationRows.map((row) => <div key={row.id} className="classification-row">
              <input value={row.chave} onChange={(e) => setClassificationRows(classificationRows.map((item) => item.id === row.id ? { ...item, chave: e.target.value } : item))} placeholder="Campo · Ex.: Família" />
              <input value={row.valor} onChange={(e) => setClassificationRows(classificationRows.map((item) => item.id === row.id ? { ...item, valor: e.target.value } : item))} placeholder="Valor · Ex.: Uniformes" />
              <button type="button" className="icon-button danger-icon" onClick={() => setClassificationRows(classificationRows.filter((item) => item.id !== row.id))}><Trash2 size={14} /></button>
            </div>)}</div>}
        </div>

        {!editing && strategy.tipo === 'manual' && <label className="span-2"><span>Código *</span><input value={manualCode} onChange={(e) => setManualCode(e.target.value)} required placeholder="Código definido pela empresa" /></label>}
        {!editing && strategy.tipo === 'externo' && <label className="span-2"><span>Código externo *</span><input value={externalCode} onChange={(e) => setExternalCode(e.target.value)} required placeholder="Código vindo do ERP/sistema externo" /></label>}
        {!editing && strategy.tipo === 'sequencial' && <div className="info-banner span-2"><GitBranch size={18} /><div><strong>Código automático</strong><span>O próximo sequencial será reservado de forma transacional ao salvar.</span></div></div>}
        {!editing && strategy.tipo === 'segmentado' && (strategy.segmentos ?? []).map((segment) => <label key={segment.id}><span>{segment.nome} ({segment.tamanho})</span><input value={segmentValues[segment.id] ?? ''} onChange={(e) => setSegmentValues({ ...segmentValues, [segment.id]: e.target.value })} required={segment.obrigatorio} maxLength={segment.tamanho} minLength={segment.tamanho} placeholder={`${segment.tamanho} caracteres`} /></label>)}
      </div>
      {formError && <div className="form-error">{formError}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />} {editing ? 'Salvar alterações' : 'Criar produto'}</button></div>
    </form></div>}
  </>
}

function strategyLabel(type: string) {
  if (type === 'manual') return 'Código manual'
  if (type === 'sequencial') return 'Código sequencial'
  if (type === 'segmentado') return 'Código por segmentos'
  return 'Código de sistema externo'
}

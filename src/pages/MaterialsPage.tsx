import { useMemo, useState, type FormEvent } from 'react'
import {
  Boxes,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import {
  createMaterial,
  setActiveState,
  updateMaterial,
} from '../firebase/catalogRepository'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type {
  Category,
  Material,
  MaterialSupplier,
  Supplier,
} from '../domain/types'

type SupplierLinkForm = {
  id: string
  fornecedorId: string
  referenciaFornecedor: string
  principal: boolean
}

type MaterialForm = {
  codigo: string
  codigoLegado: string
  descricao: string
  categoriaId: string
  unidade: string
  custoUnitario: string
  leadTimeDias: string
  loteMinimo: string
  observacao: string
  fornecedores: SupplierLinkForm[]
}

const emptyForm: MaterialForm = {
  codigo: '',
  codigoLegado: '',
  descricao: '',
  categoriaId: '',
  unidade: '',
  custoUnitario: '',
  leadTimeDias: '',
  loteMinimo: '',
  observacao: '',
  fornecedores: [],
}

function supplierNames(material: Material) {
  return material.fornecedores
    .map((item) => typeof item === 'string' ? item : item.nomeSnapshot)
    .join(', ')
}

function principalSupplier(material: Material) {
  const principal = material.fornecedores.find(
    (item) => typeof item !== 'string' && item.principal,
  )
  if (typeof principal === 'object') return principal.nomeSnapshot
  return supplierNames(material) || 'Não informado'
}

export default function MaterialsPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, settings, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: materials, loading, error } = useTenantCollection<Material>(
    empresaId,
    'materiais',
    'descricao',
  )
  const { items: suppliers } = useTenantCollection<Supplier>(
    empresaId,
    'fornecedores',
    'nome',
  )
  const { items: categories } = useTenantCollection<Category>(
    empresaId,
    'categorias',
    'nome',
  )

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [form, setForm] = useState<MaterialForm>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return materials.filter((material) => {
      if (!showInactive && !material.ativo) return false
      if (!term) return true
      return [
        material.codigo,
        material.codigoLegado,
        material.descricao,
        material.categoria,
        material.unidade,
        supplierNames(material),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(term)
    })
  }, [materials, search, showInactive])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setModal(true)
  }

  const openEdit = (material: Material) => {
    const links = material.fornecedores
      .filter((item): item is MaterialSupplier => typeof item !== 'string')
      .map((item) => ({
        id: crypto.randomUUID(),
        fornecedorId: item.fornecedorId,
        referenciaFornecedor: item.referenciaFornecedor ?? '',
        principal: item.principal,
      }))

    setEditing(material)
    setForm({
      codigo: material.codigo,
      codigoLegado: material.codigoLegado ?? '',
      descricao: material.descricao,
      categoriaId: material.categoriaId ?? '',
      unidade: material.unidade,
      custoUnitario: material.custoUnitario == null ? '' : String(material.custoUnitario),
      leadTimeDias: material.leadTimeDias == null ? '' : String(material.leadTimeDias),
      loteMinimo: material.loteMinimo == null ? '' : String(material.loteMinimo),
      observacao: material.observacao ?? '',
      fornecedores: links,
    })
    setFormError('')
    setModal(true)
  }

  const addSupplierLink = () => {
    setForm({
      ...form,
      fornecedores: [
        ...form.fornecedores,
        {
          id: crypto.randomUUID(),
          fornecedorId: '',
          referenciaFornecedor: '',
          principal: form.fornecedores.length === 0,
        },
      ],
    })
  }

  const updateSupplierLink = (
    id: string,
    patch: Partial<SupplierLinkForm>,
  ) => {
    setForm({
      ...form,
      fornecedores: form.fornecedores.map((item) => {
        if (patch.principal === true) {
          return item.id === id
            ? { ...item, ...patch, principal: true }
            : { ...item, principal: false }
        }
        return item.id === id ? { ...item, ...patch } : item
      }),
    })
  }

  const removeSupplierLink = (id: string) => {
    const next = form.fornecedores.filter((item) => item.id !== id)
    if (next.length > 0 && !next.some((item) => item.principal)) {
      next[0] = { ...next[0], principal: true }
    }
    setForm({ ...form, fornecedores: next })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user) return

    const selectedCategory = categories.find(
      (item) => item.id === form.categoriaId,
    )

    if (!form.codigo.trim() || !form.descricao.trim() || !selectedCategory || !form.unidade) {
      setFormError('Preencha código, descrição, categoria e unidade.')
      return
    }

    const supplierIds = form.fornecedores
      .map((item) => item.fornecedorId)
      .filter(Boolean)

    if (new Set(supplierIds).size !== supplierIds.length) {
      setFormError('O mesmo fornecedor não pode ser adicionado duas vezes.')
      return
    }

    if (form.fornecedores.some((item) => !item.fornecedorId)) {
      setFormError('Selecione o fornecedor em todas as linhas adicionadas.')
      return
    }

    const fornecedores: MaterialSupplier[] = form.fornecedores.map((link) => {
      const supplier = suppliers.find((item) => item.id === link.fornecedorId)
      if (!supplier) throw new Error('Fornecedor não encontrado.')
      return {
        fornecedorId: supplier.id,
        nomeSnapshot: supplier.nome,
        principal: link.principal,
        referenciaFornecedor: link.referenciaFornecedor.trim(),
      }
    })

    if (fornecedores.length > 0 && !fornecedores.some((item) => item.principal)) {
      fornecedores[0].principal = true
    }

    const payload = {
      codigo: form.codigo,
      codigoLegado: form.codigoLegado || undefined,
      descricao: form.descricao,
      categoriaId: selectedCategory.id,
      categoria: selectedCategory.nome,
      unidade: form.unidade,
      fornecedores,
      custoUnitario: form.custoUnitario === '' ? null : Number(form.custoUnitario),
      leadTimeDias: form.leadTimeDias === '' ? null : Number(form.leadTimeDias),
      loteMinimo: form.loteMinimo === '' ? null : Number(form.loteMinimo),
      observacao: form.observacao,
    }

    setBusy(true)
    setFormError('')
    try {
      if (editing) {
        await updateMaterial(empresaId, user.uid, editing.id, payload)
        notify('Material atualizado com sucesso.')
      } else {
        await createMaterial(empresaId, user.uid, payload)
        notify('Material cadastrado com sucesso.')
      }

      setModal(false)
      setForm(emptyForm)
      setEditing(null)
    } catch (reason) {
      console.error(reason)
      setFormError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível salvar o material.',
      )
    } finally {
      setBusy(false)
    }
  }

  const toggleState = async (material: Material) => {
    if (!empresaId || !user) return
    try {
      await setActiveState(
        empresaId,
        user.uid,
        'materiais',
        material.id,
        !material.ativo,
        material.descricao,
      )
      notify(material.ativo ? 'Material inativado.' : 'Material reativado.')
    } catch (reason) {
      console.error(reason)
      notify('Não foi possível alterar o status do material.')
    }
  }

  return <>
    <section className="page-intro">
      <div>
        <span className="section-kicker">Cadastro mestre</span>
        <h2>Materiais</h2>
        <p>Cadastro operacional com rastreabilidade, múltiplos fornecedores e inativação lógica.</p>
      </div>
      <button className="primary-button" onClick={openCreate}>
        <Plus size={18} /> Novo material
      </button>
    </section>

    <section className="stats-grid compact">
      <Stat
        label="Ativos"
        value={String(materials.filter((item) => item.ativo).length)}
        icon={<Boxes size={20} />}
      />
      <Stat
        label="Inativos"
        value={String(materials.filter((item) => !item.ativo).length)}
        icon={<ToggleLeft size={20} />}
      />
      <Stat
        label="Categorias"
        value={String(categories.filter((item) => item.ativo).length)}
        icon={<SlidersHorizontal size={20} />}
      />
      <Stat
        label="Fornecedores"
        value={String(suppliers.filter((item) => item.ativo).length)}
        icon={<Building2 size={20} />}
      />
    </section>

    <div className="toolbar">
      <div className="search-box">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por código, descrição, categoria ou fornecedor..."
        />
      </div>
      <button
        className={`filter-button ${showInactive ? 'filter-active' : ''}`}
        onClick={() => setShowInactive((value) => !value)}
      >
        {showInactive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
        Inativos
      </button>
    </div>

    {error && <div className="form-error page-message">{error}</div>}

    {loading ? (
      <div className="loading-panel">
        <Loader2 className="spin" size={25} /> Carregando materiais...
      </div>
    ) : (
      <section className="panel">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Boxes size={30} />
            <strong>Nenhum material encontrado</strong>
            <span>Cadastre o primeiro material ou ajuste os filtros.</span>
            <button className="primary-button compact" onClick={openCreate}>
              <Plus size={16} /> Novo material
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                  <th>Fornecedor principal</th>
                  <th>Fornec.</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((material) => (
                  <tr key={material.id}>
                    <td>
                      <strong>{material.codigo}</strong>
                      {material.codigoLegado && (
                        <small className="table-sub">
                          Legado: {material.codigoLegado}
                        </small>
                      )}
                    </td>
                    <td>{material.descricao}</td>
                    <td>{material.categoria || '—'}</td>
                    <td>{material.unidade}</td>
                    <td>{principalSupplier(material)}</td>
                    <td>{material.fornecedores.length}</td>
                    <td>
                      <span className={`status ${material.ativo ? 'status-green' : 'status-slate'}`}>
                        {material.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button title="Editar" onClick={() => openEdit(material)}>
                          <Edit3 size={15} />
                        </button>
                        <button
                          title={material.ativo ? 'Inativar' : 'Reativar'}
                          onClick={() => toggleState(material)}
                        >
                          {material.ativo
                            ? <ToggleRight size={16} />
                            : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )}

    {modal && (
      <div className="modal-backdrop">
        <form className="form-modal material-modal" onSubmit={submit}>
          <div className="modal-head">
            <div>
              <span className="section-kicker">
                {editing ? 'Alteração controlada' : 'Cadastro mestre'}
              </span>
              <h2>{editing ? 'Editar material' : 'Novo material'}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setModal(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="form-grid">
            <label>
              <span>Código *</span>
              <input
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value })}
                required
                placeholder="Ex.: MAT-0001"
              />
            </label>

            <label>
              <span>Código legado</span>
              <input
                value={form.codigoLegado}
                onChange={(event) => setForm({ ...form, codigoLegado: event.target.value })}
                placeholder="Opcional"
              />
            </label>

            <label className="span-2">
              <span>Descrição *</span>
              <input
                value={form.descricao}
                onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                required
                placeholder="Descrição objetiva do material"
              />
            </label>

            <label>
              <span>Categoria *</span>
              <select
                value={form.categoriaId}
                onChange={(event) => setForm({ ...form, categoriaId: event.target.value })}
                required
              >
                <option value="">Selecione</option>
                {categories
                  .filter((item) => item.ativo)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {'— '.repeat(Math.max(0, item.nivel - 1))}
                      {item.nome}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              <span>Unidade *</span>
              <select
                value={form.unidade}
                onChange={(event) => setForm({ ...form, unidade: event.target.value })}
                required
                disabled={Boolean(editing)}
              >
                <option value="">Selecione</option>
                {settings.unidades
                  .filter((item) => item.ativo)
                  .map((unit) => (
                    <option key={unit.id} value={unit.simbolo}>
                      {unit.simbolo} — {unit.nome}
                    </option>
                  ))}
              </select>
              {editing && (
                <small>
                  A unidade fica travada após o cadastro para preservar o histórico.
                </small>
              )}
            </label>

            <label>
              <span>Custo unitário</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={form.custoUnitario}
                onChange={(event) => setForm({ ...form, custoUnitario: event.target.value })}
                placeholder="Opcional"
              />
            </label>

            <label>
              <span>Lead time (dias)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.leadTimeDias}
                onChange={(event) => setForm({ ...form, leadTimeDias: event.target.value })}
                placeholder="Opcional"
              />
            </label>

            <label>
              <span>Lote mínimo</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={form.loteMinimo}
                onChange={(event) => setForm({ ...form, loteMinimo: event.target.value })}
                placeholder="Opcional"
              />
            </label>

            <label className="span-2">
              <span>Observação</span>
              <textarea
                value={form.observacao}
                onChange={(event) => setForm({ ...form, observacao: event.target.value })}
                rows={3}
                placeholder="Informações complementares"
              />
            </label>
          </div>

          <section className="supplier-editor">
            <div className="supplier-editor-head">
              <div>
                <span className="section-kicker">Fornecimento</span>
                <h3>Fornecedores do material</h3>
              </div>
              <button
                type="button"
                className="secondary-button compact"
                onClick={addSupplierLink}
              >
                <Plus size={15} /> Adicionar fornecedor
              </button>
            </div>

            {form.fornecedores.length === 0 ? (
              <div className="supplier-empty">
                Nenhum fornecedor vinculado. O material pode ser salvo assim e receber fornecedores depois.
              </div>
            ) : (
              <div className="supplier-link-list">
                {form.fornecedores.map((link) => (
                  <div className="supplier-link-row" key={link.id}>
                    <select
                      value={link.fornecedorId}
                      onChange={(event) => updateSupplierLink(link.id, {
                        fornecedorId: event.target.value,
                      })}
                    >
                      <option value="">Selecione o fornecedor</option>
                      {suppliers
                        .filter((item) => item.ativo)
                        .map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.nome}
                          </option>
                        ))}
                    </select>

                    <input
                      value={link.referenciaFornecedor}
                      onChange={(event) => updateSupplierLink(link.id, {
                        referenciaFornecedor: event.target.value,
                      })}
                      placeholder="Referência do fornecedor"
                    />

                    <button
                      type="button"
                      className={`principal-toggle ${link.principal ? 'active' : ''}`}
                      onClick={() => updateSupplierLink(link.id, { principal: true })}
                      title="Definir como principal"
                    >
                      <Star size={15} />
                      {link.principal ? 'Principal' : 'Tornar principal'}
                    </button>

                    <button
                      type="button"
                      className="icon-button danger-icon"
                      onClick={() => removeSupplierLink(link.id)}
                      title="Remover vínculo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {formError && <div className="form-error">{formError}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setModal(false)}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={busy}>
              {busy
                ? <Loader2 className="spin" size={17} />
                : <CheckCircle2 size={17} />}
              {editing ? 'Salvar alterações' : 'Cadastrar material'}
            </button>
          </div>
        </form>
      </div>
    )}
  </>
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <article className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>empresa ativa</small>
      </div>
    </article>
  )
}

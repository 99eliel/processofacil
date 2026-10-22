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
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { createMaterial, setActiveState, updateTenantDocument } from '../firebase/catalogRepository'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { Category, Material, MaterialSupplier, Supplier } from '../domain/types'

type MaterialForm = {
  codigo: string
  codigoLegado: string
  descricao: string
  categoriaId: string
  unidade: string
  fornecedorId: string
  referenciaFornecedor: string
  observacao: string
}

const emptyForm: MaterialForm = {
  codigo: '',
  codigoLegado: '',
  descricao: '',
  categoriaId: '',
  unidade: '',
  fornecedorId: '',
  referenciaFornecedor: '',
  observacao: '',
}

function supplierNames(material: Material) {
  return material.fornecedores.map((item) =>
    typeof item === 'string' ? item : item.nomeSnapshot,
  ).join(', ')
}

export default function MaterialsPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, settings, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: materials, loading, error } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: suppliers } = useTenantCollection<Supplier>(empresaId, 'fornecedores', 'nome')
  const { items: categories } = useTenantCollection<Category>(empresaId, 'categorias', 'nome')
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
      ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(term)
    })
  }, [materials, search, showInactive])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setModal(true)
  }

  const openEdit = (material: Material) => {
    const principal = material.fornecedores.find((item) => typeof item !== 'string' && item.principal)
    setEditing(material)
    setForm({
      codigo: material.codigo,
      codigoLegado: material.codigoLegado ?? '',
      descricao: material.descricao,
      categoriaId: material.categoriaId ?? '',
      unidade: material.unidade,
      fornecedorId: typeof principal === 'object' ? principal.fornecedorId : '',
      referenciaFornecedor: typeof principal === 'object' ? principal.referenciaFornecedor ?? '' : '',
      observacao: material.observacao ?? '',
    })
    setFormError('')
    setModal(true)
  }

  const selectedCategory = categories.find((item) => item.id === form.categoriaId)
  const selectedSupplier = suppliers.find((item) => item.id === form.fornecedorId)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user) return
    if (!form.codigo.trim() || !form.descricao.trim() || !form.categoriaId || !form.unidade) {
      setFormError('Preencha código, descrição, categoria e unidade.')
      return
    }

    setBusy(true)
    setFormError('')
    try {
      const fornecedores: MaterialSupplier[] = selectedSupplier ? [{
        fornecedorId: selectedSupplier.id,
        nomeSnapshot: selectedSupplier.nome,
        principal: true,
        referenciaFornecedor: form.referenciaFornecedor.trim(),
      }] : []

      if (editing) {
        await updateTenantDocument(
          empresaId,
          user.uid,
          'materiais',
          editing.id,
          {
            codigo: form.codigo.trim().toUpperCase(),
            codigoLegado: form.codigoLegado.trim(),
            descricao: form.descricao.trim(),
            categoriaId: selectedCategory?.id ?? '',
            categoria: selectedCategory?.nome ?? '',
            fornecedores,
            observacao: form.observacao.trim(),
          },
          `${form.codigo.trim().toUpperCase()} · ${form.descricao.trim()}`,
        )
        notify('Material atualizado com sucesso.')
      } else {
        await createMaterial(empresaId, user.uid, {
          codigo: form.codigo,
          codigoLegado: form.codigoLegado || undefined,
          descricao: form.descricao,
          categoriaId: selectedCategory?.id,
          categoria: selectedCategory?.nome ?? '',
          unidade: form.unidade,
          fornecedores,
          custoUnitario: null,
          leadTimeDias: null,
          loteMinimo: null,
          observacao: form.observacao,
        })
        notify('Material criado no Firestore.')
      }
      setModal(false)
      setForm(emptyForm)
      setEditing(null)
    } catch (reason) {
      console.error(reason)
      setFormError('Não foi possível salvar. Confira as regras do Firestore e se o código já está correto.')
    } finally {
      setBusy(false)
    }
  }

  const toggleState = async (material: Material) => {
    if (!empresaId || !user) return
    try {
      await setActiveState(empresaId, user.uid, 'materiais', material.id, !material.ativo, material.descricao)
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
        <p>Dados reais da empresa ativa. Materiais são inativados em vez de excluídos para preservar o histórico.</p>
      </div>
      <button className="primary-button" onClick={openCreate}><Plus size={18} /> Novo material</button>
    </section>

    <section className="stats-grid compact">
      <Stat label="Ativos" value={String(materials.filter((item) => item.ativo).length)} icon={<Boxes size={20} />} />
      <Stat label="Inativos" value={String(materials.filter((item) => !item.ativo).length)} icon={<ToggleLeft size={20} />} />
      <Stat label="Categorias" value={String(categories.filter((item) => item.ativo).length)} icon={<SlidersHorizontal size={20} />} />
      <Stat label="Fornecedores" value={String(suppliers.filter((item) => item.ativo).length)} icon={<Building2 size={20} />} />
    </section>

    <div className="toolbar">
      <div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, descrição, categoria ou fornecedor..." /></div>
      <button className={`filter-button ${showInactive ? 'filter-active' : ''}`} onClick={() => setShowInactive((value) => !value)}>
        {showInactive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />} Inativos
      </button>
    </div>

    {error && <div className="form-error page-message">{error}</div>}
    {loading ? <div className="loading-panel"><Loader2 className="spin" size={25} /> Carregando materiais...</div> :
      <section className="panel">
        {filtered.length === 0 ? <div className="empty-state"><Boxes size={30} /><strong>Nenhum material encontrado</strong><span>Cadastre o primeiro material ou ajuste os filtros.</span><button className="primary-button compact" onClick={openCreate}><Plus size={16} /> Novo material</button></div> :
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Unidade</th><th>Fornecedor principal</th><th>Status</th><th></th></tr></thead><tbody>
            {filtered.map((material) => <tr key={material.id}>
              <td><strong>{material.codigo}</strong>{material.codigoLegado && <small className="table-sub">Legado: {material.codigoLegado}</small>}</td>
              <td>{material.descricao}</td>
              <td>{material.categoria || '—'}</td>
              <td>{material.unidade}</td>
              <td>{supplierNames(material) || 'Não informado'}</td>
              <td><span className={`status ${material.ativo ? 'status-green' : 'status-slate'}`}>{material.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td><div className="row-actions"><button title="Editar" onClick={() => openEdit(material)}><Edit3 size={15} /></button><button title={material.ativo ? 'Inativar' : 'Reativar'} onClick={() => toggleState(material)}>{material.ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button></div></td>
            </tr>)}
          </tbody></table></div>}
      </section>}

    {modal && <div className="modal-backdrop">
      <form className="form-modal" onSubmit={submit}>
        <div className="modal-head"><div><span className="section-kicker">{editing ? 'Alteração controlada' : 'Cadastro mestre'}</span><h2>{editing ? 'Editar material' : 'Novo material'}</h2></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X size={18} /></button></div>
        <div className="form-grid">
          <label><span>Código *</span><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required placeholder="Ex.: MAT-0001" /></label>
          <label><span>Código legado</span><input value={form.codigoLegado} onChange={(e) => setForm({ ...form, codigoLegado: e.target.value })} placeholder="Opcional" /></label>
          <label className="span-2"><span>Descrição *</span><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required placeholder="Descrição objetiva do material" /></label>
          <label><span>Categoria *</span><select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} required><option value="">Selecione</option>{categories.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label><span>Unidade *</span><select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} required disabled={Boolean(editing)}><option value="">Selecione</option>{settings.unidades.filter((item) => item.ativo).map((unit) => <option key={unit.id} value={unit.simbolo}>{unit.simbolo} — {unit.nome}</option>)}</select>{editing && <small>Unidade travada após o cadastro para preservar fichas e histórico.</small>}</label>
          <label><span>Fornecedor principal</span><select value={form.fornecedorId} onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })}><option value="">Sem fornecedor</option>{suppliers.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label><span>Referência no fornecedor</span><input value={form.referenciaFornecedor} onChange={(e) => setForm({ ...form, referenciaFornecedor: e.target.value })} placeholder="Código/referência externa" /></label>
          <label className="span-2"><span>Observação</span><textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={3} placeholder="Informações complementares" /></label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />} {editing ? 'Salvar alterações' : 'Cadastrar material'}</button></div>
      </form>
    </div>}
  </>
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>empresa ativa</small></div></article>
}

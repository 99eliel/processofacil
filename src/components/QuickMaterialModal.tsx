import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, PackagePlus, Plus, X } from 'lucide-react'
import { createCategory, createMaterial } from '../firebase/catalogRepository'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { useSystem } from '../system/SystemProvider'
import type { Category, Material } from '../domain/types'

type Props = {
  onClose: () => void
  onCreated: (material: Material) => void
}

export default function QuickMaterialModal({ onClose, onCreated }: Props) {
  const { activeCompany, settings, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: categories, loading: categoriesLoading, error: categoriesError } =
    useTenantCollection<Category>(empresaId, 'categorias', 'nome')
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [unidade, setUnidade] = useState('')
  const [custoUnitario, setCustoUnitario] = useState('')
  const [observacao, setObservacao] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [addedCategory, setAddedCategory] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeCategories = categories.filter((category) => category.ativo)
  const category = [...activeCategories, ...(addedCategory ? [addedCategory] : [])]
    .find((item) => item.id === categoriaId)
  const units = settings.unidades.filter((item) => item.ativo)

  const saveCategory = async () => {
    const nome = newCategoryName.trim()
    if (!empresaId || !user || busy) return
    if (!nome) { setError('Informe o nome da nova categoria.'); return }
    setBusy(true); setError('')
    try {
      const id = await createCategory(empresaId, user.uid, {
        nome, parentId: null, nivel: 1, prefixo: '',
      })
      const created: Category = { id, nome, parentId: null, nivel: 1, ativo: true }
      setAddedCategory(created)
      setCategoriaId(id)
      setCreatingCategory(false)
      setNewCategoryName('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!empresaId || !user || busy) return
    const code = codigo.trim().toUpperCase()
    const name = descricao.trim()
    if (!code || !name || !category || !unidade) {
      setError('Preencha código, descrição, categoria e unidade.')
      return
    }
    const cost = custoUnitario.trim() === '' ? null : Number(custoUnitario)
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError('Informe um custo válido e não negativo.')
      return
    }
    setBusy(true); setError('')
    try {
      const payload = {
        codigo: code,
        descricao: name,
        categoriaId: category.id,
        categoria: category.nome,
        unidade,
        fornecedores: [] as Material['fornecedores'],
        custoUnitario: cost,
        leadTimeDias: null,
        loteMinimo: null,
        observacao: observacao.trim(),
      }
      const id = await createMaterial(empresaId, user.uid, payload)
      onCreated({
        ...payload, id, ativo: true,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar o material.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop ft-quick-material-backdrop"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <form className="modal-card ft-quick-material-modal" role="dialog" aria-modal="true"
      aria-label="Cadastrar novo material pela Ficha Técnica" onSubmit={(event) => void submit(event)}
      onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <div>
          <span className="section-kicker">CADASTRO RÁPIDO · MATERIAIS DO PRODUTO</span>
          <h2>Novo material</h2>
          <p>Cadastre aqui mesmo, sem perder os dados da Ficha Técnica. O material será incluído nos Materiais do Produto ao salvar.</p>
        </div>
        <button className="modal-close" type="button" disabled={busy} title="Fechar" aria-label="Fechar"
          onClick={onClose}><X size={18}/></button>
      </div>
      <div className="ft-quick-material-fields">
        <label><span>Código do material *</span>
          <input autoFocus required maxLength={80} value={codigo}
            placeholder="Ex.: MAT-001"
            onChange={(event) => setCodigo(event.target.value.toUpperCase())}/>
        </label>
        <label><span>Descrição *</span>
          <input required maxLength={250} value={descricao}
            placeholder="Ex.: Malha piquet azul marinho"
            onChange={(event) => setDescricao(event.target.value)}/>
        </label>
        <label><span>Categoria *</span>
          <select required value={categoriaId} disabled={busy || categoriesLoading}
            onChange={(event) => setCategoriaId(event.target.value)}>
            <option value="">Selecione a categoria</option>
            {activeCategories.map((item) => <option key={item.id} value={item.id}>
              {'— '.repeat(Math.max(0, item.nivel - 1))}{item.nome}
            </option>)}
            {addedCategory && !categories.some((item) => item.id === addedCategory.id) &&
              <option value={addedCategory.id}>{addedCategory.nome}</option>}
          </select>
          <button type="button" className="ft-category-create-link" disabled={busy}
            onClick={() => { setCreatingCategory((value) => !value); setError('') }}>
            <Plus size={14}/> {creatingCategory ? 'Cancelar nova categoria' : 'Cadastrar categoria sem sair da ficha'}
          </button>
        </label>
        <label><span>Unidade de consumo *</span>
          <select required value={unidade} disabled={busy} onChange={(event) => setUnidade(event.target.value)}>
            <option value="">Selecione a unidade</option>
            {units.map((item) => <option key={item.id} value={item.simbolo}>
              {item.simbolo} — {item.nome}
            </option>)}
          </select>
        </label>
        {creatingCategory && <div className="ft-quick-category-editor">
          <label><span>Nome da nova categoria</span>
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Ex.: Matérias-primas"/>
          </label>
          <button type="button" className="secondary-button compact" disabled={busy || !newCategoryName.trim()}
            onClick={() => void saveCategory()}>
            <Plus size={15}/> Criar categoria
          </button>
        </div>}
        <label><span>Custo unitário (opcional)</span>
          <input type="number" min="0" step="0.0001" inputMode="decimal" value={custoUnitario}
            onChange={(event) => setCustoUnitario(event.target.value)}
            placeholder="Ex.: 5,00"/>
        </label>
        <label><span>Observação (opcional)</span>
          <input value={observacao} onChange={(event) => setObservacao(event.target.value)}
            placeholder="Informação útil sobre o material"/>
        </label>
      </div>
      <div className="ft-quick-material-note">
        <CheckCircle2 size={16}/>
        <span>O cadastro será compartilhado com o módulo Materiais. Fornecedores e demais detalhes poderão ser preenchidos lá depois.</span>
      </div>
      {(error || categoriesError) && <div className="form-error" role="alert">{error || categoriesError}</div>}
      <div className="modal-actions">
        <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="primary-button" type="submit"
          disabled={busy || !codigo.trim() || !descricao.trim() || !category || !unidade || categoriesLoading}>
          {busy ? <Loader2 className="spin" size={16}/> : <PackagePlus size={16}/>}
          {busy ? 'Cadastrando...' : 'Cadastrar e adicionar ao produto'}
        </button>
      </div>
    </form>
  </div>
}

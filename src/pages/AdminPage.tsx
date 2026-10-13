import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Boxes,
  Building2,
  Check,
  ChevronRight,
  GitBranch,
  Layers3,
  Loader2,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import {
  addCompanyBranch,
  createCategory,
  createSupplier,
  saveCompanySettings,
  updateCompanyProfile,
} from '../firebase/catalogRepository'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { Category, CompanySettings, ModuleKey, Supplier, UnitDefinition } from '../domain/types'
import AuditPanel from '../components/AuditPanel'

const moduleLabels: Record<ModuleKey, { title: string; text: string }> = {
  materiais: { title: 'Materiais', text: 'Cadastro mestre, categorias, unidades e fornecedores.' },
  produtos: { title: 'Produtos', text: 'Produtos, classificações e estratégias de código.' },
  fichas: { title: 'Ficha Técnica', text: 'BOM, medidas, operações, revisões e anexos.' },
  workflow: { title: 'Workflow', text: 'Etapas, responsáveis e aprovações configuráveis.' },
  ordens: { title: 'Ordens de Produção', text: 'Planejamento, variantes, kits e rastreabilidade.' },
  qualidade: { title: 'Qualidade', text: 'Inspeções, critérios, tolerâncias e retrabalho.' },
}

type Tab = 'empresa' | 'cadastros' | 'modulos' | 'codigo' | 'auditoria'

export default function AdminPage({ notify }: { notify: (message: string) => void }) {
  const auth = useAuth()
  const empresaId = auth.activeCompany?.id
  const user = auth.user
  const { items: suppliers } = useTenantCollection<Supplier>(empresaId, 'fornecedores', 'nome')
  const { items: categories } = useTenantCollection<Category>(empresaId, 'categorias', 'nome')
  const [tab, setTab] = useState<Tab>('empresa')
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState<CompanySettings>(auth.settings)
  const [company, setCompany] = useState({
    nome: auth.activeCompany?.nome ?? '',
    nomeFantasia: auth.activeCompany?.nomeFantasia ?? '',
    documento: auth.activeCompany?.documento ?? '',
  })
  const [branchName, setBranchName] = useState('')
  const [supplierForm, setSupplierForm] = useState({ nome: '', contato: '', telefone: '', email: '', observacao: '' })
  const [categoryForm, setCategoryForm] = useState({ nome: '', parentId: '', prefixo: '' })
  const [unitForm, setUnitForm] = useState({ simbolo: '', nome: '' })
  const [segmentForm, setSegmentForm] = useState({ nome: '', tamanho: 2 })

  useEffect(() => setSettings(auth.settings), [auth.settings])
  useEffect(() => {
    if (!auth.activeCompany) return
    setCompany({
      nome: auth.activeCompany.nome,
      nomeFantasia: auth.activeCompany.nomeFantasia,
      documento: auth.activeCompany.documento,
    })
  }, [auth.activeCompany])

  const activeProfiles = auth.activeMembership?.perfis ?? []
  const canAdmin = activeProfiles.includes('admin') || auth.activeCompany?.ownerUid === user?.uid

  const saveSettings = async (next = settings) => {
    if (!empresaId || !user) return
    setBusy(true)
    try {
      await saveCompanySettings(empresaId, user.uid, next)
      setSettings(next)
      await auth.refreshActiveCompany()
      notify('Configurações salvas no Firestore.')
    } catch (error) {
      console.error(error)
      notify('Não foi possível salvar as configurações.')
    } finally {
      setBusy(false)
    }
  }

  const toggleModule = (key: ModuleKey) => {
    const next = { ...settings, modulos: { ...settings.modulos, [key]: !settings.modulos[key] } }
    setSettings(next)
  }

  const saveCompany = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user) return
    setBusy(true)
    try {
      await updateCompanyProfile(empresaId, user.uid, company)
      await auth.refreshActiveCompany()
      notify('Dados da empresa atualizados.')
    } catch (error) {
      console.error(error)
      notify('Não foi possível atualizar a empresa.')
    } finally {
      setBusy(false)
    }
  }

  const addBranch = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user || !auth.activeCompany) return
    setBusy(true)
    try {
      await addCompanyBranch(empresaId, user.uid, auth.activeCompany.filiais ?? [], branchName)
      setBranchName('')
      await auth.refreshActiveCompany()
      notify('Filial criada.')
    } catch (error) {
      console.error(error)
      notify('Não foi possível criar a filial.')
    } finally {
      setBusy(false)
    }
  }

  const addSupplier = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user || !supplierForm.nome.trim()) return
    setBusy(true)
    try {
      await createSupplier(empresaId, user.uid, supplierForm)
      setSupplierForm({ nome: '', contato: '', telefone: '', email: '', observacao: '' })
      notify('Fornecedor cadastrado.')
    } catch (error) {
      console.error(error)
      notify('Não foi possível cadastrar o fornecedor.')
    } finally {
      setBusy(false)
    }
  }

  const addCategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user || !categoryForm.nome.trim()) return
    const parent = categories.find((item) => item.id === categoryForm.parentId)
    setBusy(true)
    try {
      await createCategory(empresaId, user.uid, {
        nome: categoryForm.nome,
        parentId: parent?.id ?? null,
        nivel: (parent?.nivel ?? 0) + 1,
        prefixo: categoryForm.prefixo || undefined,
      })
      setCategoryForm({ nome: '', parentId: '', prefixo: '' })
      notify('Categoria cadastrada.')
    } catch (error) {
      console.error(error)
      notify('Não foi possível cadastrar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  const addUnit = () => {
    const simbolo = unitForm.simbolo.trim()
    const nome = unitForm.nome.trim()
    if (!simbolo || !nome) return
    if (settings.unidades.some((item) => item.simbolo.toLowerCase() === simbolo.toLowerCase())) {
      notify('Essa unidade já existe.')
      return
    }
    const unit: UnitDefinition = {
      id: simbolo.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `u-${Date.now()}`,
      simbolo,
      nome,
      ativo: true,
    }
    setSettings({ ...settings, unidades: [...settings.unidades, unit] })
    setUnitForm({ simbolo: '', nome: '' })
  }

  const toggleUnit = (id: string) => {
    setSettings({
      ...settings,
      unidades: settings.unidades.map((unit) => unit.id === id ? { ...unit, ativo: !unit.ativo } : unit),
    })
  }

  const addSegment = () => {
    if (!segmentForm.nome.trim() || segmentForm.tamanho < 1) return
    const current = settings.estrategiaCodigo.segmentos ?? []
    setSettings({
      ...settings,
      estrategiaCodigo: {
        ...settings.estrategiaCodigo,
        tipo: 'segmentado',
        segmentos: [...current, {
          id: segmentForm.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'),
          nome: segmentForm.nome.trim(),
          tamanho: segmentForm.tamanho,
          obrigatorio: true,
          ordem: current.length + 1,
        }],
      },
    })
    setSegmentForm({ nome: '', tamanho: 2 })
  }

  const segmentLength = useMemo(
    () => (settings.estrategiaCodigo.segmentos ?? []).reduce((sum, item) => sum + item.tamanho, 0),
    [settings.estrategiaCodigo.segmentos],
  )

  return <>
    <section className="page-intro">
      <div>
        <span className="section-kicker">Central do tenant</span>
        <h2>Configurações da empresa</h2>
        <p>Estas regras pertencem apenas à empresa ativa. Outros clientes podem usar estrutura, módulos e códigos diferentes.</p>
      </div>
      <button className="primary-button" onClick={() => saveSettings()} disabled={busy || !canAdmin}>
        {busy ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Salvar configurações
      </button>
    </section>

    {!canAdmin && <div className="form-error page-message">Seu perfil pode consultar estas configurações, mas somente um administrador pode alterá-las.</div>}

    <div className="config-tabs">
      <button className={tab === 'empresa' ? 'active' : ''} onClick={() => setTab('empresa')}><Building2 size={17} /> Empresa</button>
      <button className={tab === 'cadastros' ? 'active' : ''} onClick={() => setTab('cadastros')}><Boxes size={17} /> Cadastros base</button>
      <button className={tab === 'modulos' ? 'active' : ''} onClick={() => setTab('modulos')}><Layers3 size={17} /> Módulos</button>
      <button className={tab === 'codigo' ? 'active' : ''} onClick={() => setTab('codigo')}><GitBranch size={17} /> Código</button>
      {canAdmin && <button className={tab === 'auditoria' ? 'active' : ''} onClick={() => setTab('auditoria')}><Users size={17} /> Auditoria</button>}
    </div>

    {tab === 'empresa' && <div className="two-columns">
      <form className="panel form-panel" onSubmit={saveCompany}>
        <div className="panel-head"><div><span className="section-kicker">Identidade</span><h3>Dados institucionais</h3></div><Building2 size={20} /></div>
        <div className="form-grid">
          <label className="span-2"><span>Razão social / nome</span><input value={company.nome} onChange={(e) => setCompany({ ...company, nome: e.target.value })} required disabled={!canAdmin} /></label>
          <label><span>Nome fantasia</span><input value={company.nomeFantasia} onChange={(e) => setCompany({ ...company, nomeFantasia: e.target.value })} disabled={!canAdmin} /></label>
          <label><span>CNPJ / CPF</span><input value={company.documento} onChange={(e) => setCompany({ ...company, documento: e.target.value })} disabled={!canAdmin} /></label>
        </div>
        <button className="secondary-button" disabled={!canAdmin || busy}><Save size={16} /> Salvar dados</button>
      </form>

      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Estrutura</span><h3>Filiais e unidades</h3></div><span className="count-badge">{auth.activeCompany?.filiais?.length ?? 0}</span></div>
        <div className="branch-list">{auth.activeCompany?.filiais?.map((branch) => <span key={branch.id}><Building2 size={14} /> {branch.nome}</span>)}</div>
        <form className="inline-form" onSubmit={addBranch}><input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Nome da nova filial" disabled={!canAdmin} /><button className="secondary-button compact" disabled={!canAdmin || busy}><Plus size={15} /> Adicionar</button></form>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Acesso</span><h3>Usuário atual</h3></div><Users size={20} /></div>
        <div className="info"><span>Nome</span><strong>{user?.displayName || 'Não informado'}</strong></div>
        <div className="info"><span>E-mail</span><strong>{user?.email}</strong></div>
        <div className="branch-list">{activeProfiles.map((profile) => <span key={profile}><Check size={13} /> {profile}</span>)}</div>
      </section>
    </div>}

    {tab === 'cadastros' && <>
      <div className="two-columns">
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Fornecedores</span><h3>Cadastro base</h3></div><span className="count-badge">{suppliers.length}</span></div>
          <form className="stack-form" onSubmit={addSupplier}>
            <input value={supplierForm.nome} onChange={(e) => setSupplierForm({ ...supplierForm, nome: e.target.value })} placeholder="Nome do fornecedor" required disabled={!canAdmin} />
            <div className="inline-fields"><input value={supplierForm.contato} onChange={(e) => setSupplierForm({ ...supplierForm, contato: e.target.value })} placeholder="Contato" disabled={!canAdmin} /><input value={supplierForm.telefone} onChange={(e) => setSupplierForm({ ...supplierForm, telefone: e.target.value })} placeholder="Telefone" disabled={!canAdmin} /></div>
            <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="E-mail" disabled={!canAdmin} />
            <button className="secondary-button compact" disabled={!canAdmin || busy}><Plus size={15} /> Cadastrar fornecedor</button>
          </form>
          <div className="mini-list">{suppliers.slice(0, 8).map((item) => <div key={item.id}><strong>{item.nome}</strong><span>{item.email || item.telefone || 'Sem contato informado'}</span></div>)}</div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Categorias</span><h3>Árvore livre</h3></div><span className="count-badge">{categories.length}</span></div>
          <form className="stack-form" onSubmit={addCategory}>
            <input value={categoryForm.nome} onChange={(e) => setCategoryForm({ ...categoryForm, nome: e.target.value })} placeholder="Nome da categoria" required disabled={!canAdmin} />
            <select value={categoryForm.parentId} onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value })} disabled={!canAdmin}><option value="">Categoria raiz</option>{categories.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{'— '.repeat(Math.max(0, item.nivel - 1))}{item.nome}</option>)}</select>
            <input value={categoryForm.prefixo} onChange={(e) => setCategoryForm({ ...categoryForm, prefixo: e.target.value })} placeholder="Prefixo de código (opcional)" disabled={!canAdmin} />
            <button className="secondary-button compact" disabled={!canAdmin || busy}><Plus size={15} /> Cadastrar categoria</button>
          </form>
          <div className="mini-list">{categories.slice(0, 10).map((item) => <div key={item.id}><strong>{'— '.repeat(Math.max(0, item.nivel - 1))}{item.nome}</strong><span>Nível {item.nivel}{item.prefixo ? ` · ${item.prefixo}` : ''}</span></div>)}</div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Unidades</span><h3>Catálogo da empresa</h3></div><span className="count-badge">{settings.unidades.filter((item) => item.ativo).length}</span></div>
        <div className="unit-grid">{settings.unidades.map((unit) => <button key={unit.id} className={`unit-chip ${unit.ativo ? 'active' : ''}`} onClick={() => canAdmin && toggleUnit(unit.id)}><strong>{unit.simbolo}</strong><span>{unit.nome}</span></button>)}</div>
        <div className="inline-form"><input value={unitForm.simbolo} onChange={(e) => setUnitForm({ ...unitForm, simbolo: e.target.value })} placeholder="Símbolo" disabled={!canAdmin} /><input value={unitForm.nome} onChange={(e) => setUnitForm({ ...unitForm, nome: e.target.value })} placeholder="Nome da unidade" disabled={!canAdmin} /><button type="button" className="secondary-button compact" onClick={addUnit} disabled={!canAdmin}><Plus size={15} /> Adicionar</button></div>
      </section>
    </>}

    {tab === 'modulos' && <section className="panel">
      <div className="panel-head"><div><span className="section-kicker">Arquitetura modular</span><h3>Recursos ativos</h3></div><SlidersHorizontal size={20} /></div>
      <div className="toggle-grid">{(Object.keys(moduleLabels) as ModuleKey[]).map((key) => <button key={key} className={`toggle-card ${settings.modulos[key] ? 'enabled' : ''}`} onClick={() => canAdmin && toggleModule(key)}><span className="module-icon"><Settings2 size={19} /></span><div><strong>{moduleLabels[key].title}</strong><small>{moduleLabels[key].text}</small></div><span className="switch"><i /></span></button>)}</div>
      <div className="config-save-row"><button className="primary-button" onClick={() => saveSettings()} disabled={!canAdmin || busy}><Save size={16} /> Aplicar módulos</button></div>
    </section>}

    {tab === 'auditoria' && canAdmin && <AuditPanel />}

    {tab === 'codigo' && <section className="panel">
      <div className="panel-head"><div><span className="section-kicker">Identificação de produtos</span><h3>Estratégia de código</h3></div><GitBranch size={20} /></div>
      <div className="strategy-grid">
        {(['manual', 'sequencial', 'segmentado', 'externo'] as const).map((type) => <button key={type} className={settings.estrategiaCodigo.tipo === type ? 'strategy-card active' : 'strategy-card'} onClick={() => canAdmin && setSettings({ ...settings, estrategiaCodigo: { ...settings.estrategiaCodigo, tipo: type } })}><strong>{type === 'manual' ? 'Manual' : type === 'sequencial' ? 'Sequencial' : type === 'segmentado' ? 'Por segmentos' : 'Sistema externo'}</strong><span>{type === 'manual' ? 'Usuário informa o código.' : type === 'sequencial' ? 'Sistema gera uma sequência.' : type === 'segmentado' ? 'Código formado por partes configuráveis.' : 'Código vem de ERP/API externa.'}</span></button>)}
      </div>

      {settings.estrategiaCodigo.tipo === 'sequencial' && <div className="form-grid config-form"><label><span>Prefixo</span><input value={settings.estrategiaCodigo.prefixo ?? ''} onChange={(e) => setSettings({ ...settings, estrategiaCodigo: { ...settings.estrategiaCodigo, prefixo: e.target.value } })} disabled={!canAdmin} /></label><label><span>Quantidade de dígitos</span><input type="number" min={2} max={12} value={settings.estrategiaCodigo.digitos ?? 6} onChange={(e) => setSettings({ ...settings, estrategiaCodigo: { ...settings.estrategiaCodigo, digitos: Number(e.target.value) } })} disabled={!canAdmin} /></label></div>}

      {settings.estrategiaCodigo.tipo === 'segmentado' && <>
        <div className="segment-builder">
          {(settings.estrategiaCodigo.segmentos ?? []).map((segment) => <div className="segment-card" key={segment.id}><span>{segment.ordem}</span><div><strong>{segment.nome}</strong><small>{segment.tamanho} caracteres · {segment.obrigatorio ? 'obrigatório' : 'opcional'}</small></div></div>)}
        </div>
        <div className="inline-form"><input value={segmentForm.nome} onChange={(e) => setSegmentForm({ ...segmentForm, nome: e.target.value })} placeholder="Nome do segmento" disabled={!canAdmin} /><input type="number" min={1} max={12} value={segmentForm.tamanho} onChange={(e) => setSegmentForm({ ...segmentForm, tamanho: Number(e.target.value) })} disabled={!canAdmin} /><button type="button" className="secondary-button compact" onClick={addSegment} disabled={!canAdmin}><Plus size={15} /> Segmento</button></div>
        <p className="helper-text">Tamanho atual do código: <strong>{segmentLength} caracteres</strong>. A estrutura pertence somente a esta empresa.</p>
      </>}

      <div className="config-save-row"><button className="primary-button" onClick={() => saveSettings()} disabled={!canAdmin || busy}><Save size={16} /> Salvar estratégia</button></div>
    </section>}
  </>
}

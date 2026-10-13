import { useMemo, useState } from 'react'
import {
  Boxes,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import { useTenantCollection } from './hooks/useTenantCollection'
import MaterialsPage from './pages/MaterialsPage'
import ProductsPage from './pages/ProductsPage'
import AdminPage from './pages/AdminPage'
import TechnicalSheetsPage from './pages/TechnicalSheetsPage'
import type { Material, ModuleKey, Product, TechnicalSheetSummary } from './domain/types'

type Page = 'home' | 'materiais' | 'produtos' | 'fichas' | 'workflow' | 'ordens' | 'qualidade' | 'admin'
type ModuleCard = { id: Page; module?: ModuleKey; title: string; description: string; icon: LucideIcon }

const modules: ModuleCard[] = [
  { id: 'materiais', module: 'materiais', title: 'Materiais', description: 'Cadastro mestre, categorias, unidades e fornecedores', icon: Boxes },
  { id: 'produtos', module: 'produtos', title: 'Produtos', description: 'Produtos, classificações e códigos configuráveis', icon: PackageCheck },
  { id: 'fichas', module: 'fichas', title: 'Ficha Técnica', description: 'Blocos configuráveis, BOM, revisões e anexos', icon: FileText },
  { id: 'workflow', module: 'workflow', title: 'Workflow', description: 'Etapas, aprovações, perfis e regras de transição', icon: Workflow },
  { id: 'ordens', module: 'ordens', title: 'Ordens de Produção', description: 'OPs com vários itens, variantes e rastreabilidade', icon: Factory },
  { id: 'qualidade', module: 'qualidade', title: 'Qualidade', description: 'Critérios, tolerâncias, checklists e inspeções', icon: ShieldCheck },
]

export default function App() {
  const auth = useAuth()
  const [page, setPage] = useState<Page>('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const empresaId = auth.activeCompany?.id

  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: sheets } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')

  const activeModules = useMemo(
    () => modules.filter((item) => !item.module || auth.settings.modulos[item.module]),
    [auth.settings.modulos],
  )

  const open = (target: Page) => {
    setPage(target)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const initials = (auth.user?.displayName || auth.user?.email || 'PF')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('')

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><GitBranch size={24} /></div>
        <div><strong>Processo Fácil</strong><span>Sistema universal de processos</span></div>
        <button className="close-menu" onClick={() => setMobileMenu(false)}><X size={20} /></button>
      </div>

      <div className="tenant-card">
        <span className="tenant-logo"><Building2 size={18} /></span>
        <div>
          <small>Empresa ativa</small>
          {auth.memberships.length > 1 ? <select value={auth.activeCompany?.id ?? ''} onChange={(event) => auth.selectCompany(event.target.value)}>{auth.memberships.map((membership) => <option key={membership.empresaId} value={membership.empresaId}>{membership.nomeFantasia}</option>)}</select> : <strong>{auth.activeCompany?.nomeFantasia}</strong>}
        </div>
      </div>

      <nav className="desktop-nav">
        <NavButton active={page === 'home'} icon={LayoutDashboard} label="Visão geral" onClick={() => open('home')} />
        {activeModules.map(({ id, title, icon }) => <NavButton key={id} active={page === id} icon={icon} label={title} onClick={() => open(id)} />)}
        <div className="nav-separator" />
        <NavButton active={page === 'admin'} icon={Settings} label="Configurações" onClick={() => open('admin')} />
        <button className="nav-item" onClick={() => auth.logout()}><LogOut size={18} /><span>Sair</span></button>
      </nav>

      <div className="sidebar-footer">
        <div><span className="connection-dot" /> Firebase oficial conectado</div>
        <small>processofacil-3f688 · v0.5.0</small>
      </div>
    </aside>

    {mobileMenu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

    <main className="content">
      <header className="topbar">
        <div className="topbar-left">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div><p className="eyebrow">{auth.activeCompany?.nomeFantasia} · {auth.activeCompany?.filiais?.[0]?.nome ?? 'Matriz'}</p><h1>{pageTitle(page)}</h1></div>
        </div>
        <div className="topbar-actions">
          <div className="user-summary"><div><strong>{auth.user?.displayName || 'Usuário'}</strong><small>{auth.activeMembership?.perfis?.join(' · ')}</small></div><button className="profile-button" onClick={() => open('admin')} aria-label="Perfil">{initials}</button></div>
        </div>
      </header>

      {page === 'home' && <Home open={open} modules={activeModules} materialCount={materials.filter((item) => item.ativo).length} productCount={products.length} sheetCount={sheets.filter((item) => item.status === 'padrao').length} />}
      {page === 'materiais' && <MaterialsPage notify={notify} />}
      {page === 'produtos' && <ProductsPage notify={notify} />}
      {page === 'fichas' && <TechnicalSheetsPage notify={notify} />}
      {page === 'workflow' && <PreparedModule icon={Workflow} kicker="Automação" title="Workflow" text="O motor de workflow configurável já existe no domínio. A próxima camada é o editor visual das etapas e o histórico de transições." />}
      {page === 'ordens' && <PreparedModule icon={Factory} kicker="Planejamento" title="Ordens de Produção" text="A arquitetura prevê vários produtos, variantes e snapshots da revisão/kit na liberação. Ainda não há OPs fictícias: os dados aparecerão somente quando forem persistidos." />}
      {page === 'qualidade' && <PreparedModule icon={ShieldCheck} kicker="Controle" title="Qualidade" text="O módulo será ligado às revisões e OPs reais, com critérios numéricos, checklist, severidade, amostras individuais e retrabalho." />}
      {page === 'admin' && <AdminPage notify={notify} />}
    </main>

    <nav className="bottom-nav">
      <button className={page === 'home' ? 'active' : ''} onClick={() => open('home')}><LayoutDashboard size={20} /><span>Início</span></button>
      <button className={page === 'materiais' ? 'active' : ''} onClick={() => open('materiais')}><Boxes size={20} /><span>Materiais</span></button>
      <button className={page === 'produtos' ? 'active' : ''} onClick={() => open('produtos')}><PackageCheck size={20} /><span>Produtos</span></button>
      <button className={page === 'admin' ? 'active' : ''} onClick={() => open('admin')}><Settings size={20} /><span>Config.</span></button>
    </nav>

    {toast && <div className="toast"><ClipboardCheck size={18} /> {toast}</div>}
  </div>
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} /><span>{label}</span></button>
}

function Home({ open, modules, materialCount, productCount, sheetCount }: { open: (page: Page) => void; modules: ModuleCard[]; materialCount: number; productCount: number; sheetCount: number }) {
  const auth = useAuth()
  return <>
    <section className="hero-card universal-hero">
      <div>
        <span className="hero-label">Ambiente multiempresa ativo</span>
        <h2>{auth.activeCompany?.nomeFantasia}, seu processo começa pela configuração certa.</h2>
        <p>Os dados desta tela pertencem somente a esta empresa. Cadastros e regras não são compartilhados com outros clientes.</p>
        <button className="hero-action" onClick={() => open('admin')}><SlidersHorizontal size={18} /> Configurar empresa</button>
      </div>
      <div className="hero-stat"><strong>{modules.length}</strong><span>módulos ativos</span><div className="mini-progress"><i style={{ width: `${Math.min(100, modules.length / 6 * 100)}%` }} /></div></div>
    </section>

    <section className="stats-grid">
      <Stat icon={Boxes} label="Materiais ativos" value={String(materialCount)} meta="dados reais do Firestore" />
      <Stat icon={PackageCheck} label="Produtos" value={String(productCount)} meta="dados reais do Firestore" />
      <Stat icon={FileText} label="Fichas publicadas" value={String(sheetCount)} meta="revisões padrão reais" />
      <Stat icon={Factory} label="OPs abertas" value="0" meta="sem dados fictícios" />
    </section>

    <section className="dashboard-grid">
      <div className="panel">
        <div className="panel-head"><div><span className="section-kicker">Arquitetura</span><h3>Configuração desta empresa</h3></div><button className="text-button" onClick={() => open('admin')}>Editar <ChevronRight size={16} /></button></div>
        <div className="architecture-list">
          <ArchitectureItem icon={Building2} title="Tenant isolado" text="Cada leitura e gravação é feita dentro do ambiente da empresa ativa." />
          <ArchitectureItem icon={GitBranch} title="Código configurável" text={`Estratégia atual: ${auth.settings.estrategiaCodigo.tipo}.`} />
          <ArchitectureItem icon={Workflow} title="Workflow por empresa" text="O motor suporta etapas e perfis definidos por cada cliente." />
          <ArchitectureItem icon={ShieldCheck} title="Auditoria" text="Cadastros reais registram ação, usuário, entidade e data." />
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><div><span className="section-kicker">Comece por aqui</span><h3>Base operacional</h3></div></div>
        <QuickStep done={materialCount > 0} title="Cadastrar categorias e fornecedores" text="Configure a base em Configurações → Cadastros base." onClick={() => open('admin')} />
        <QuickStep done={materialCount > 0} title="Cadastrar materiais" text="Crie os primeiros materiais usando os cadastros base." onClick={() => open('materiais')} />
        <QuickStep done={productCount > 0} title="Cadastrar produtos" text="Use a estratégia de código definida pela empresa." onClick={() => open('produtos')} />
      </div>
    </section>

    <section className="section-header"><div><span className="section-kicker">Acesso rápido</span><h3>Módulos ativos</h3></div><span className="muted">controlados por empresa</span></section>
    <section className="module-grid">{modules.map(({ id, title, description, icon: Icon }) => <button className="module-card" key={id} onClick={() => open(id)}><span className="module-icon"><Icon size={22} /></span><span className="module-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight className="module-arrow" size={19} /></button>)}</section>
  </>
}

function PreparedModule({ icon: Icon, kicker, title, text }: { icon: LucideIcon; kicker: string; title: string; text: string }) {
  return <><section className="page-intro"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{text}</p></div></section><section className="panel prepared-module"><span><Icon size={34} /></span><strong>Estrutura preparada, sem dados simulados</strong><p>Este módulo já faz parte do modelo universal e será conectado ao Firestore seguindo as mesmas regras de tenant, auditoria e permissões dos cadastros que já estão funcionais.</p></section></>
}

function Stat({ icon: Icon, label, value, meta }: { icon: LucideIcon; label: string; value: string; meta: string }) {
  return <article className="stat-card"><span className="stat-icon"><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></article>
}

function ArchitectureItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="architecture-item"><span><Icon size={18} /></span><div><strong>{title}</strong><small>{text}</small></div></div>
}

function QuickStep({ done, title, text, onClick }: { done: boolean; title: string; text: string; onClick: () => void }) {
  return <button className="quick-step" onClick={onClick}><span className={done ? 'quick-check done' : 'quick-check'}>{done ? '✓' : '•'}</span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={16} /></button>
}

function pageTitle(page: Page) {
  const names: Record<Page, string> = { home: 'Visão geral', materiais: 'Materiais', produtos: 'Produtos', fichas: 'Fichas Técnicas', workflow: 'Workflow', ordens: 'Ordens de Produção', qualidade: 'Qualidade', admin: 'Configurações' }
  return names[page]
}

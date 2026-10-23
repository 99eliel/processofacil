import { useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FileText,
  LayoutDashboard,
  Menu,
  MonitorPlay,
  PackageCheck,
  PlayCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSystem } from './system/SystemProvider'
import { useTenantCollection } from './hooks/useTenantCollection'
import MaterialsPage from './pages/MaterialsPage'
import ProductsPage from './pages/ProductsPage'
import AdminPage from './pages/AdminPage'
import TechnicalSheetsPage from './pages/TechnicalSheetsPage'
import WorkflowPage from './pages/WorkflowPage'
import ProductionOrdersPage from './pages/ProductionOrdersPage'
import QualityPage from './pages/QualityPage'
import OperatorPage from './pages/OperatorPage'
import SimulationPage from './pages/SimulationPage'
import type {
  Material,
  Product,
  ProductionOrderRecord,
  TechnicalSheetSummary,
} from './domain/types'

type Page =
  | 'home'
  | 'materiais'
  | 'produtos'
  | 'fichas'
  | 'workflow'
  | 'ordens'
  | 'simulador'
  | 'operador'
  | 'qualidade'
  | 'admin'

type NavItem = {
  id: Page
  label: string
  icon: LucideIcon
}

const operationNav: NavItem[] = [
  { id: 'fichas', label: 'Passaporte Digital', icon: FileText },
  { id: 'ordens', label: 'Ordens de Produção', icon: Factory },
  { id: 'operador', label: 'Modo Operador', icon: MonitorPlay },
  { id: 'qualidade', label: 'Qualidade', icon: ShieldCheck },
]

const registerNav: NavItem[] = [
  { id: 'produtos', label: 'Produtos', icon: PackageCheck },
  { id: 'materiais', label: 'Materiais', icon: Boxes },
]

const systemNav: NavItem[] = [
  { id: 'workflow', label: 'Workflow', icon: Workflow },
  { id: 'simulador', label: 'Simulador', icon: ClipboardCheck },
  { id: 'admin', label: 'Configurações', icon: Settings },
]

export default function App() {
  const system = useSystem()
  const [page, setPage] = useState<Page>('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const empresaId = system.activeCompany?.id

  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: sheets } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')
  const { items: orders } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')

  const open = (target: Page) => {
    setPage(target)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const moduleEnabled = (pageId: Page) => {
    if (pageId === 'materiais') return system.settings.modulos.materiais
    if (pageId === 'produtos') return system.settings.modulos.produtos
    if (pageId === 'fichas') return system.settings.modulos.fichas
    if (pageId === 'workflow') return system.settings.modulos.workflow
    if (pageId === 'ordens') return system.settings.modulos.ordens
    if (pageId === 'qualidade') return system.settings.modulos.qualidade
    return true
  }

  const openOrders = orders.filter((item) => !['concluida', 'cancelada'].includes(item.status)).length
  const publishedSheets = sheets.filter((item) => item.status === 'padrao').length

  return <div className="app-shell presentation-shell">
    <aside className={`sidebar presentation-sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="brand presentation-brand">
        <div className="brand-mark"><Sparkles size={22} /></div>
        <div>
          <strong>Processo Fácil</strong>
          <span>Gestão visual da produção</span>
        </div>
        <button className="close-menu" onClick={() => setMobileMenu(false)}><X size={20} /></button>
      </div>

      <button className="presentation-company" onClick={() => open('home')}>
        <span className="tenant-logo"><Building2 size={17} /></span>
        <div>
          <small>Ambiente atual</small>
          <strong>{system.activeCompany?.nomeFantasia}</strong>
        </div>
        <ChevronRight size={15} />
      </button>

      <nav className="desktop-nav presentation-nav">
        <NavButton
          active={page === 'home'}
          icon={LayoutDashboard}
          label="Início"
          onClick={() => open('home')}
        />

        <NavGroup label="Operação">
          {operationNav.filter((item) => moduleEnabled(item.id)).map((item) => (
            <NavButton
              key={item.id}
              active={page === item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => open(item.id)}
            />
          ))}
        </NavGroup>

        <NavGroup label="Cadastros">
          {registerNav.filter((item) => moduleEnabled(item.id)).map((item) => (
            <NavButton
              key={item.id}
              active={page === item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => open(item.id)}
            />
          ))}
        </NavGroup>

        <NavGroup label="Sistema">
          {systemNav.filter((item) => moduleEnabled(item.id)).map((item) => (
            <NavButton
              key={item.id}
              active={page === item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => open(item.id)}
            />
          ))}
        </NavGroup>
      </nav>

      <div className="sidebar-footer presentation-footer">
        <span className="presentation-badge"><Sparkles size={13} /> Apresentação v1.0</span>
        <small>v1.0 · Processo Fácil</small>
      </div>
    </aside>

    {mobileMenu && (
      <button
        className="menu-backdrop"
        aria-label="Fechar menu"
        onClick={() => setMobileMenu(false)}
      />
    )}

    <main className="content presentation-content">
      <header className="topbar presentation-topbar">
        <div className="topbar-left">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}>
            <Menu size={21} />
          </button>
          <div>
            <p className="eyebrow">{system.activeCompany?.nomeFantasia}</p>
            <h1>{pageTitle(page)}</h1>
          </div>
        </div>

        <div className="topbar-actions presentation-top-actions">
          {page !== 'simulador' && (
            <button className="presentation-demo-button" onClick={() => open('simulador')}>
              <PlayCircle size={16} /> Demonstrar processo
            </button>
          )}
          <button className="profile-button presentation-profile" onClick={() => open('admin')} aria-label="Configurações">
            PF
          </button>
        </div>
      </header>

      {page === 'home' && (
        <Home
          open={open}
          materialCount={materials.filter((item) => item.ativo).length}
          productCount={products.length}
          sheetCount={publishedSheets}
          orderCount={openOrders}
        />
      )}
      {page === 'materiais' && <MaterialsPage notify={notify} />}
      {page === 'produtos' && <ProductsPage notify={notify} />}
      {page === 'fichas' && <TechnicalSheetsPage notify={notify} />}
      {page === 'workflow' && <WorkflowPage notify={notify} />}
      {page === 'ordens' && <ProductionOrdersPage notify={notify} />}
      {page === 'simulador' && (
        <SimulationPage notify={notify} openOperator={() => open('operador')} />
      )}
      {page === 'operador' && <OperatorPage notify={notify} />}
      {page === 'qualidade' && <QualityPage notify={notify} />}
      {page === 'admin' && <AdminPage notify={notify} />}
    </main>

    <nav className="bottom-nav presentation-bottom-nav">
      <button className={page === 'home' ? 'active' : ''} onClick={() => open('home')}>
        <LayoutDashboard size={20} /><span>Início</span>
      </button>
      <button className={page === 'fichas' ? 'active' : ''} onClick={() => open('fichas')}>
        <FileText size={20} /><span>Passaporte</span>
      </button>
      <button className={page === 'ordens' ? 'active' : ''} onClick={() => open('ordens')}>
        <Factory size={20} /><span>OPs</span>
      </button>
      <button className={page === 'operador' ? 'active' : ''} onClick={() => open('operador')}>
        <MonitorPlay size={20} /><span>Operador</span>
      </button>
      <button className={page === 'qualidade' ? 'active' : ''} onClick={() => open('qualidade')}>
        <ShieldCheck size={20} /><span>Qualidade</span>
      </button>
    </nav>

    {toast && <div className="toast"><ClipboardCheck size={18} /> {toast}</div>}
  </div>
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="nav-group">
    <span className="nav-group-label">{label}</span>
    {children}
  </div>
}

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    <Icon size={18} />
    <span>{label}</span>
  </button>
}

function Home({
  open,
  materialCount,
  productCount,
  sheetCount,
  orderCount,
}: {
  open: (page: Page) => void
  materialCount: number
  productCount: number
  sheetCount: number
  orderCount: number
}) {
  return <>
    <section className="presentation-hero">
      <div className="presentation-hero-copy">
        <span className="presentation-overline">
          <Sparkles size={14} /> Produção conectada do desenvolvimento ao chão de fábrica
        </span>
        <h2>Transforme a Ficha Técnica em um <em>processo vivo de produção.</em></h2>
        <p>
          O Processo Fácil conecta Passaporte Digital, POPs visuais, Ordens de Produção,
          execução no posto de trabalho e Qualidade em um fluxo único e rastreável.
        </p>

        <div className="presentation-hero-actions">
          <button className="presentation-primary-cta" onClick={() => open('simulador')}>
            <PlayCircle size={18} /> Iniciar demonstração
          </button>
          <button className="presentation-secondary-cta" onClick={() => open('operador')}>
            <MonitorPlay size={18} /> Ver chão de fábrica
          </button>
        </div>
      </div>

      <div className="presentation-hero-visual">
        <span className="presentation-visual-label">Fluxo conectado</span>
        <VisualStep icon={FileText} label="Passaporte" text="Produto + revisão + POP" />
        <VisualArrow />
        <VisualStep icon={Factory} label="Produção" text="OP + kit congelado" />
        <VisualArrow />
        <VisualStep icon={MonitorPlay} label="Execução" text="Fotos, vídeo e instrução" />
        <VisualArrow />
        <VisualStep icon={ShieldCheck} label="Qualidade" text="Inspeção + rastreabilidade" />
      </div>
    </section>

    <section className="presentation-section-head">
      <div>
        <span className="section-kicker">Como funciona</span>
        <h3>Um fluxo simples de explicar e fácil de demonstrar</h3>
      </div>
      <span className="presentation-section-note">Da engenharia à execução</span>
    </section>

    <section className="presentation-journey">
      <JourneyCard
        number="01"
        icon={FileText}
        title="Passaporte Digital"
        text="Centraliza produto, materiais, medidas, revisões, sequência operacional e POPs."
        action="Abrir passaportes"
        onClick={() => open('fichas')}
      />
      <JourneyCard
        number="02"
        icon={Factory}
        title="Planejamento"
        text="A OP congela a revisão correta, calcula materiais e organiza o que será produzido."
        action="Ver ordens"
        onClick={() => open('ordens')}
      />
      <JourneyCard
        number="03"
        icon={MonitorPlay}
        title="Chão de fábrica"
        text="O operador recebe exatamente a operação atual com fotos, vídeo e pontos críticos."
        action="Abrir operador"
        onClick={() => open('operador')}
      />
      <JourneyCard
        number="04"
        icon={ShieldCheck}
        title="Qualidade"
        text="Inspeções e retrabalhos ficam vinculados ao processo, preservando todo o histórico."
        action="Ver qualidade"
        onClick={() => open('qualidade')}
      />
    </section>

    <section className="presentation-demo-strip">
      <div className="presentation-demo-icon"><PlayCircle size={25} /></div>
      <div className="presentation-demo-copy">
        <span>Demonstração pronta para amanhã</span>
        <strong>Simule uma polo completa em poucos cliques</strong>
        <small>
          O cenário cria materiais, produto, Passaporte REV 01, POPs, OP e operações
          prontas para executar.
        </small>
      </div>
      <button onClick={() => open('simulador')}>
        Abrir simulador <ArrowRight size={17} />
      </button>
    </section>

    <section className="presentation-section-head compact">
      <div>
        <span className="section-kicker">Ambiente atual</span>
        <h3>Dados do sistema</h3>
      </div>
    </section>

    <section className="presentation-metrics">
      <MetricCard icon={PackageCheck} value={productCount} label="Produtos" />
      <MetricCard icon={Boxes} value={materialCount} label="Materiais" />
      <MetricCard icon={FileText} value={sheetCount} label="Passaportes publicados" />
      <MetricCard icon={Factory} value={orderCount} label="OPs em aberto" />
    </section>
  </>
}

function VisualStep({
  icon: Icon,
  label,
  text,
}: {
  icon: LucideIcon
  label: string
  text: string
}) {
  return <div className="presentation-visual-step">
    <span><Icon size={18} /></span>
    <div>
      <strong>{label}</strong>
      <small>{text}</small>
    </div>
  </div>
}

function VisualArrow() {
  return <div className="presentation-visual-arrow"><ArrowRight size={16} /></div>
}

function JourneyCard({
  number,
  icon: Icon,
  title,
  text,
  action,
  onClick,
}: {
  number: string
  icon: LucideIcon
  title: string
  text: string
  action: string
  onClick: () => void
}) {
  return <button className="presentation-journey-card" onClick={onClick}>
    <div className="presentation-journey-top">
      <span className="presentation-journey-number">{number}</span>
      <span className="presentation-journey-icon"><Icon size={20} /></span>
    </div>
    <strong>{title}</strong>
    <p>{text}</p>
    <span className="presentation-journey-link">
      {action} <ChevronRight size={15} />
    </span>
  </button>
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: number
  label: string
}) {
  return <article className="presentation-metric-card">
    <span><Icon size={18} /></span>
    <div>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  </article>
}

function pageTitle(page: Page) {
  const names: Record<Page, string> = {
    home: 'Visão geral',
    materiais: 'Materiais',
    produtos: 'Produtos',
    fichas: 'Passaporte Digital',
    workflow: 'Workflow',
    ordens: 'Ordens de Produção',
    simulador: 'Demonstração',
    operador: 'Modo Operador',
    qualidade: 'Qualidade',
    admin: 'Configurações',
  }
  return names[page]
}

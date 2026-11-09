import { useState } from 'react'
import {
  ArrowRight,
  Boxes,
  ClipboardCheck,
  Factory,
  Cpu,
  Users,
  FileText,
  MonitorPlay,
  PackageCheck,
  PlayCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  Home as HomeIcon,
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
import GuidedPieceFlowPage from './pages/GuidedPieceFlowPage'
import CapacityPage from './pages/CapacityPage'
import type {
  Material,
  Product,
  ProductionOrderRecord,
  TechnicalSheetSummary,
} from './domain/types'

type Page =
  | 'home'
  | 'fluxo'
  | 'materiais'
  | 'produtos'
  | 'fichas'
  | 'workflow'
  | 'ordens'
  | 'simulador'
  | 'operador'
  | 'cargaMaquina'
  | 'cargaMaoObra'
  | 'qualidade'
  | 'admin'

export default function App() {
  const system = useSystem()
  const [page, setPage] = useState<Page>('home')
  const [toast, setToast] = useState('')
  const [focusProductCode, setFocusProductCode] = useState('')
  const empresaId = system.activeCompany?.id

  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: sheets } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')
  const { items: orders } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')

  const open = (target: Page) => {
    setPage(target)
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

  const openOrders = orders.filter((item) => !item.excluido && !['concluida', 'cancelada'].includes(item.status)).length
  const visibleProducts = products.filter((item) => !item.excluido)
  const publishedSheets = sheets.filter((item) => item.status === 'padrao').length

  return <div className="app-shell presentation-shell block-navigation-shell">
    <main className="content presentation-content block-navigation-content">
      <header className="topbar presentation-topbar block-navigation-topbar">
        <div className="block-topbar-brand">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div>
            <strong>Processo Fácil</strong>
            <span>{system.activeCompany?.nomeFantasia || 'Ambiente principal'}</span>
          </div>
        </div>

        <div className="block-topbar-center">
          {page !== 'home' && (
            <button className="block-back-home" onClick={() => open('home')}>
              <HomeIcon size={17} /> Voltar ao menu
            </button>
          )}
          {page !== 'home' && <div>
            <p className="eyebrow">Módulo atual</p>
            <h1>{pageTitle(page)}</h1>
          </div>}
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
          productCount={visibleProducts.length}
          sheetCount={publishedSheets}
          orderCount={openOrders}
          moduleEnabled={moduleEnabled}
        />
      )}
      {page === 'fluxo' && (
        <GuidedPieceFlowPage
          notify={notify}
          openOperator={() => open('operador')}
          openPassport={() => open('fichas')}
        />
      )}
      {page === 'materiais' && <MaterialsPage notify={notify} />}
      {page === 'produtos' && <ProductsPage
        notify={notify}
        openPassport={(produtoCodigo) => {
          setFocusProductCode(produtoCodigo)
          open('fichas')
        }}
      />}
      {page === 'fichas' && <TechnicalSheetsPage
        notify={notify}
        initialProductCode={focusProductCode}
        onFocusConsumed={() => setFocusProductCode('')}
      />}
      {page === 'workflow' && <WorkflowPage notify={notify} />}
      {page === 'ordens' && <ProductionOrdersPage notify={notify} />}
      {page === 'simulador' && (
        <SimulationPage
          notify={notify}
          openOperator={() => open('operador')}
          openPassport={() => open('fichas')}
        />
      )}
      {page === 'operador' && <OperatorPage notify={notify} />}
      {page === 'cargaMaquina' && <CapacityPage kind="maquinas" notify={notify} />}
      {page === 'cargaMaoObra' && <CapacityPage kind="maoObra" notify={notify} />}
      {page === 'qualidade' && <QualityPage notify={notify} />}
      {page === 'admin' && <AdminPage notify={notify} />}
    </main>



    {toast && <div className="toast"><ClipboardCheck size={18} /> {toast}</div>}
  </div>
}

function Home({
  open,
  materialCount,
  productCount,
  sheetCount,
  orderCount,
  moduleEnabled,
}: {
  open: (page: Page) => void
  materialCount: number
  productCount: number
  sheetCount: number
  orderCount: number
  moduleEnabled: (page: Page) => boolean
}) {
  const operationBlocks = [
    {
      id: 'fichas' as Page,
      icon: FileText,
      title: 'Passaporte Digital',
      text: 'Ficha Técnica, revisões, imagens, materiais e documentação do produto.',
      badge: sheetCount > 0 ? `${sheetCount} publicados` : 'Fichas técnicas',
    },
    {
      id: 'ordens' as Page,
      icon: Factory,
      title: 'Ordens de Produção',
      text: 'Crie, acompanhe e libere o que será produzido.',
      badge: orderCount > 0 ? `${orderCount} em aberto` : 'Planejamento',
    },
    {
      id: 'operador' as Page,
      icon: MonitorPlay,
      title: 'Modo Operador',
      text: 'Execução direta no chão de fábrica com instrução e mídia.',
      badge: 'Execução',
    },
    {
      id: 'cargaMaquina' as Page,
      icon: Cpu,
      title: 'Carga Máquina',
      text: 'Capacidade das máquinas, demanda das OPs e execução real.',
      badge: 'Capacidade',
    },
    {
      id: 'cargaMaoObra' as Page,
      icon: Users,
      title: 'Carga Mão de Obra',
      text: 'Capacidade da equipe, carga planejada e horas decorridas.',
      badge: 'Equipe',
    },
    {
      id: 'qualidade' as Page,
      icon: ShieldCheck,
      title: 'Qualidade',
      text: 'Acompanhe inspeções, registros e rastreabilidade do processo.',
      badge: 'Controle',
    },
  ].filter((item) => moduleEnabled(item.id))

  const registerBlocks = [
    {
      id: 'produtos' as Page,
      icon: PackageCheck,
      title: 'Produtos',
      text: 'Cadastre e consulte os produtos da empresa.',
      badge: `${productCount} cadastrados`,
    },
    {
      id: 'materiais' as Page,
      icon: Boxes,
      title: 'Materiais',
      text: 'Gerencie tecidos, aviamentos, insumos e fornecedores.',
      badge: `${materialCount} ativos`,
    },
  ].filter((item) => moduleEnabled(item.id))

  const systemBlocks = [
    {
      id: 'workflow' as Page,
      icon: Workflow,
      title: 'Workflow',
      text: 'Configure etapas, aprovações e responsabilidades do processo.',
      badge: 'Fluxo',
    },
    {
      id: 'simulador' as Page,
      icon: ClipboardCheck,
      title: 'Simulador',
      text: 'Use cenários prontos para demonstrar o trajeto completo.',
      badge: 'Demonstração',
    },
    {
      id: 'admin' as Page,
      icon: Settings,
      title: 'Configurações',
      text: 'Empresa, módulos, códigos e parâmetros gerais do sistema.',
      badge: 'Sistema',
    },
  ].filter((item) => moduleEnabled(item.id))

  return <div className="block-home">
    <section className="block-home-intro">
      <div>
        <span className="section-kicker">Menu principal</span>
        <h2>O que você quer fazer?</h2>
        <p>Escolha um bloco abaixo. Cada área leva direto para a função desejada, sem precisar procurar em menus laterais.</p>
      </div>
      <button className="block-create-piece" onClick={() => open('fluxo')}>
        <span className="block-create-icon"><Plus size={26} /></span>
        <span>
          <small>Ação principal</small>
          <strong>Criar nova peça</strong>
          <em>Cadastro completo até a produção</em>
        </span>
        <ArrowRight size={22} />
      </button>
    </section>

    <ModuleGroup
      title="Produção"
      subtitle="Do desenvolvimento da peça até a execução"
      blocks={operationBlocks}
      open={open}
    />

    <ModuleGroup
      title="Cadastros"
      subtitle="Base de produtos e materiais"
      blocks={registerBlocks}
      open={open}
      compact
    />

    <ModuleGroup
      title="Gestão do sistema"
      subtitle="Configuração, fluxo e demonstração"
      blocks={systemBlocks}
      open={open}
      compact
    />

    <section className="block-home-footer">
      <div>
        <span>Ambiente atual</span>
        <strong>{productCount} produtos · {materialCount} materiais · {sheetCount} fichas publicadas · {orderCount} OPs em aberto</strong>
      </div>
      <button onClick={() => open('simulador')}>
        <PlayCircle size={17} /> Abrir demonstração
      </button>
    </section>
  </div>
}

type ModuleBlockData = {
  id: Page
  icon: LucideIcon
  title: string
  text: string
  badge: string
}

function ModuleGroup({
  title,
  subtitle,
  blocks,
  open,
  compact = false,
}: {
  title: string
  subtitle: string
  blocks: ModuleBlockData[]
  open: (page: Page) => void
  compact?: boolean
}) {
  if (blocks.length === 0) return null
  return <section className="block-module-section">
    <div className="block-module-heading">
      <div>
        <span className="section-kicker">{title}</span>
        <h3>{subtitle}</h3>
      </div>
    </div>
    <div className={`block-module-grid ${compact ? 'compact' : ''}`}>
      {blocks.map((block) => {
        const Icon = block.icon
        return <button key={block.id} className="block-module-card" onClick={() => open(block.id)}>
          <div className="block-module-card-top">
            <span className="block-module-icon"><Icon size={25} /></span>
            <span className="block-module-badge">{block.badge}</span>
          </div>
          <strong>{block.title}</strong>
          <p>{block.text}</p>
          <span className="block-module-link">Abrir módulo <ArrowRight size={16} /></span>
        </button>
      })}
    </div>
  </section>
}

function pageTitle(page: Page) {
  const names: Record<Page, string> = {
    home: 'Visão geral',
    fluxo: 'Criar nova peça',
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

import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, Boxes, ClipboardList, Factory, FileText,
  Home, PackageCheck, Plus, Settings2, ShieldCheck, Workflow,
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
import SimulationPage from './pages/SimulationPage'
import GuidedPieceFlowPage from './pages/GuidedPieceFlowPage'
import PlanningPage from './pages/PlanningPage'
import ProductionPage from './pages/ProductionPage'
import ReportsPage from './pages/ReportsPage'
import DiagnosticsPage from './pages/DiagnosticsPage'
import type { Material, Product, ProductionOrderRecord, TechnicalSheetSummary } from './domain/types'
import './remap.css'
import './production-upgrades.css'
import './diagnostics.css'

type Page = 'inicio' | 'catalogo' | 'ordens' | 'planejamento' | 'producao' | 'gestao' | 'configuracoes'
type CatalogTab = 'fichas' | 'produtos' | 'materiais' | 'novo'
type ProductionTab = 'apontamentos' | 'qualidade'
type ConfigTab = 'empresa' | 'workflow' | 'simulador' | 'diagnostico'

const sections = [
  { id: 'catalogo' as Page, title: 'Produtos e Fichas Técnicas', description: 'Cadastro, passaportes, operações e materiais.', icon: FileText, group: 'Engenharia' },
  { id: 'ordens' as Page, title: 'Ordens de Produção', description: 'Defina o que produzir e acompanhe as ordens.', icon: ClipboardList, group: 'Pedidos de produção' },
  { id: 'planejamento' as Page, title: 'Planejamento', description: 'Programação, capacidade, máquinas e equipes.', icon: Factory, group: 'PCP' },
  { id: 'producao' as Page, title: 'Produção', description: 'Quantidades produzidas, instruções e qualidade.', icon: PackageCheck, group: 'Execução' },
  { id: 'gestao' as Page, title: 'Gestão e Relatórios', description: 'Indicadores, acompanhamento e exportações.', icon: BarChart3, group: 'Resultados' },
]

export default function App() {
  const system = useSystem()
  const [page, setPage] = useState<Page>('inicio')
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('fichas')
  const [productionTab, setProductionTab] = useState<ProductionTab>('apontamentos')
  const [configTab, setConfigTab] = useState<ConfigTab>('empresa')
  const [focusProductCode, setFocusProductCode] = useState('')
  const [toast, setToast] = useState('')
  const empresaId = system.activeCompany?.id
  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: sheets } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')
  const { items: orders } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')

  const navigate = (destination: Page) => {
    setPage(destination)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }
  const openPassport = (productCode?: string) => {
    if (productCode) setFocusProductCode(productCode)
    setCatalogTab('fichas'); navigate('catalogo')
  }
  const openProduction = () => {
    setProductionTab('apontamentos'); navigate('producao')
  }
  const currentSection = sections.find((section) => section.id === page)
  const activeOrders = orders.filter((order) => !order.excluido && !['concluida', 'cancelada'].includes(order.status)).length

  return <div className="app-shell pf-shell">
    <div className="pf-app-layout">
      <header className="pf-global-header">
        <button className="pf-brand" onClick={() => navigate('inicio')}>
          <span className="pf-brand-symbol"><Workflow size={21}/></span>
          <span><strong>Processo Fácil</strong><small>{system.activeCompany?.nomeFantasia || 'Ambiente principal'}</small></span>
        </button>
        <div className="pf-header-right">
          {page !== 'inicio' && <button className="pf-home-link" onClick={() => navigate('inicio')}><Home size={16}/> Menu inicial</button>}
          <button className="pf-settings-link" title="Configurações" onClick={() => navigate('configuracoes')}><Settings2 size={19}/></button>
        </div>
      </header>
      <main className="pf-content">
        {page === 'inicio' && <div className="pf-home">
          <section className="pf-hero">
            <div><span className="pf-overline">Gestão industrial, sem complicação</span>
              <h1>O que vamos fazer hoje?</h1>
              <p>Da Ficha Técnica à produção real. Escolha uma área para começar.</p>
            </div>
            <button className="pf-hero-action" onClick={() => { setCatalogTab('novo'); navigate('catalogo') }}>
              <Plus size={19}/> Novo produto <ArrowRight size={17}/>
            </button>
          </section>
          <div className="pf-home-metrics">
            <div><small>Produtos ativos</small><strong>{products.filter((p) => !p.excluido && p.status === 'ativo').length}</strong></div>
            <div><small>Fichas publicadas</small><strong>{sheets.filter((s) => s.status === 'padrao').length}</strong></div>
            <div><small>OPs em aberto</small><strong>{activeOrders}</strong></div>
            <div><small>Materiais ativos</small><strong>{materials.filter((m) => m.ativo).length}</strong></div>
          </div>
          <section className="pf-home-section">
            <h2>Áreas do sistema</h2>
            <div className="pf-home-grid">{sections.map((section) => {
              const Icon = section.icon
              return <button className="pf-home-card" key={section.id} onClick={() => navigate(section.id)}>
                <span className="pf-card-top"><span className="pf-card-icon"><Icon size={25}/></span><ArrowRight size={17}/></span>
                <small>{section.group}</small><strong>{section.title}</strong><p>{section.description}</p>
              </button>
            })}</div>
          </section>
          <p className="pf-home-footnote">Módulos conectados. Os dados da Ficha Técnica alimentam as OPs, o planejamento e a produção.</p>
        </div>}
        {page !== 'inicio' && <div className="pf-workspace">
          <div className="pf-module-header">
            <button className="pf-back" onClick={() => navigate('inicio')}><ArrowLeft size={15}/> Voltar</button>
            <div><small>{currentSection?.group || 'Administração'}</small><h1>{currentSection?.title || 'Configurações'}</h1></div>
          </div>
          {page === 'catalogo' && <>
            <div className="pf-tabbar">
              <button className={catalogTab === 'fichas' ? 'active' : ''} onClick={() => setCatalogTab('fichas')}><FileText size={15}/> Fichas Técnicas</button>
              <button className={catalogTab === 'produtos' ? 'active' : ''} onClick={() => setCatalogTab('produtos')}><PackageCheck size={15}/> Produtos</button>
              <button className={catalogTab === 'materiais' ? 'active' : ''} onClick={() => setCatalogTab('materiais')}><Boxes size={15}/> Materiais</button>
              <button className={catalogTab === 'novo' ? 'active' : ''} onClick={() => setCatalogTab('novo')}><Plus size={15}/> Novo produto</button>
            </div>
            {catalogTab === 'fichas' && <TechnicalSheetsPage notify={notify} initialProductCode={focusProductCode} onFocusConsumed={() => setFocusProductCode('')}/>}
            {catalogTab === 'produtos' && <ProductsPage notify={notify} openPassport={openPassport}/>}
            {catalogTab === 'materiais' && <MaterialsPage notify={notify}/>}
            {catalogTab === 'novo' && <GuidedPieceFlowPage notify={notify} openOperator={openProduction} openPassport={() => openPassport()}/>}
          </>}
          {page === 'ordens' && <ProductionOrdersPage notify={notify} openProduction={openProduction}/>}
          {page === 'planejamento' && <PlanningPage notify={notify}/>}
          {page === 'producao' && <>
            <div className="pf-tabbar">
              <button className={productionTab === 'apontamentos' ? 'active' : ''} onClick={() => setProductionTab('apontamentos')}><Factory size={15}/> Apontamentos</button>
              <button className={productionTab === 'qualidade' ? 'active' : ''} onClick={() => setProductionTab('qualidade')}><ShieldCheck size={15}/> Qualidade</button>
            </div>
            {productionTab === 'apontamentos' && <ProductionPage notify={notify}/>}
            {productionTab === 'qualidade' && <QualityPage notify={notify}/>}
          </>}
          {page === 'gestao' && <ReportsPage/>}
          {page === 'configuracoes' && <>
            <div className="pf-tabbar">
              <button className={configTab === 'empresa' ? 'active' : ''} onClick={() => setConfigTab('empresa')}><Settings2 size={15}/> Empresa e cadastros</button>
              <button className={configTab === 'workflow' ? 'active' : ''} onClick={() => setConfigTab('workflow')}><Workflow size={15}/> Aprovações</button>
              <button className={configTab === 'simulador' ? 'active' : ''} onClick={() => setConfigTab('simulador')}><ClipboardList size={15}/> Laboratório de testes</button>
              <button className={configTab === 'diagnostico' ? 'active' : ''} onClick={() => setConfigTab('diagnostico')}><ShieldCheck size={15}/> Diagnóstico</button>
            </div>
            {configTab === 'empresa' && <AdminPage notify={notify}/>}
            {configTab === 'workflow' && <WorkflowPage notify={notify}/>}
            {configTab === 'simulador' && <SimulationPage notify={notify} openOperator={openProduction} openPassport={() => openPassport()}/>}
            {configTab === 'diagnostico' && <DiagnosticsPage/>}
          </>}
        </div>}
      </main>
    </div>
    {toast && <div className="toast"><ShieldCheck size={16}/> {toast}</div>}
  </div>
}

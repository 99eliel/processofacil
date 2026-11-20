import { useEffect, useState } from 'react'
import {
  ArrowLeft, BarChart3, Boxes, ClipboardList, Factory, FileText,
  Home, PackageCheck, Plus, Search, Settings2, ShieldCheck, Workflow, HelpCircle, X,
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
import HomeDashboard from './pages/HomeDashboard'
import QuickAccess from './components/QuickAccess'
import type { ProductionBalance } from './firebase/productionLedger'
import DiagnosticsPage from './pages/DiagnosticsPage'
import type { Material, Product, ProductionOrderRecord, TechnicalSheetSummary } from './domain/types'
import './remap.css'
import './production-upgrades.css'
import './diagnostics.css'
import './reports-upgrades.css'
import './time-studies.css'
import './easy-ux.css'
import './pcp-upgrades.css'

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
  const [quickOpen, setQuickOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [focusOrderId, setFocusOrderId] = useState('')
  const empresaId = system.activeCompany?.id
  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: sheets } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')
  const { items: orders } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const { items: balances } = useTenantCollection<ProductionBalance>(empresaId, 'saldosOperacoes', 'taskId')

  useEffect(() => {
    const handleQuickSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setQuickOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', handleQuickSearch)
    return () => window.removeEventListener('keydown', handleQuickSearch)
  }, [])

  const navigate = (destination: Page, opId?: string) => {
    if (destination === 'ordens' || destination === 'producao') setFocusOrderId(opId ?? '')
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
  const openProduction = (opId?: string) => {
    setProductionTab('apontamentos'); navigate('producao', opId)
  }
  const currentSection = sections.find((section) => section.id === page)


  return <div className="app-shell pf-shell">
    <div className="pf-app-layout">
      <header className="pf-global-header">
        <button className="pf-brand" onClick={() => navigate('inicio')}>
          <span className="pf-brand-symbol"><Workflow size={21}/></span>
          <span><strong>Processo Fácil</strong><small>{system.activeCompany?.nomeFantasia || 'Ambiente principal'}</small></span>
        </button>
        <div className="pf-header-right">
          <button className="pf-header-search" onClick={() => setQuickOpen(true)} title="Busca rápida (Ctrl + K)"><Search size={17}/><span>Busca rápida</span><kbd>Ctrl K</kbd></button>
          {page !== 'inicio' && <button className="pf-home-link" onClick={() => navigate('inicio')}><Home size={16}/> Início</button>}
          <button className="pf-settings-link" title="Como usar" aria-label="Como usar o Processo Fácil" onClick={() => setHelpOpen(true)}><HelpCircle size={19}/></button>
          <button className="pf-settings-link" title="Configurações" aria-label="Configurações" onClick={() => navigate('configuracoes')}><Settings2 size={19}/></button>
        </div>
      </header>
      <main className="pf-content">
        {page === 'inicio' && <HomeDashboard products={products} sheets={sheets} materials={materials}
          orders={orders} balances={balances} navigate={navigate}
          createProduct={() => { setCatalogTab('novo'); navigate('catalogo') }}/>}
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
          {page === 'ordens' && <ProductionOrdersPage notify={notify} initialOrderId={focusOrderId} openProduction={openProduction}/>}
          {page === 'planejamento' && <PlanningPage notify={notify}/>}
          {page === 'producao' && <>
            <div className="pf-tabbar">
              <button className={productionTab === 'apontamentos' ? 'active' : ''} onClick={() => setProductionTab('apontamentos')}><Factory size={15}/> Apontamentos</button>
              <button className={productionTab === 'qualidade' ? 'active' : ''} onClick={() => setProductionTab('qualidade')}><ShieldCheck size={15}/> Qualidade</button>
            </div>
            {productionTab === 'apontamentos' && <ProductionPage notify={notify} initialOrderId={focusOrderId}/>}
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
    <QuickAccess open={quickOpen} onClose={() => setQuickOpen(false)} onNavigate={navigate} orders={orders}/>
    {helpOpen && <div className="pf-search-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setHelpOpen(false)
    }}>
      <section className="pf-search-dialog pf-help-dialog" role="dialog" aria-modal="true" aria-label="Como usar o Processo Fácil">
        <div className="pf-search-input-row"><HelpCircle size={21}/><strong>Como usar o Processo Fácil</strong>
          <button onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda"><X size={19}/></button></div>
        <div className="pf-help-content">
          <p>Use este roteiro para seguir o processo sem precisar conhecer todos os módulos.</p>
          <ol>
            <li><strong>Ficha Técnica:</strong> cadastre o produto e publique sua revisão com as operações necessárias.</li>
            <li><strong>Ordem de Produção:</strong> informe produto, quantidade e necessidade; depois libere a OP.</li>
            <li><strong>Planejamento (opcional):</strong> escolha equipe, máquina e data se sua empresa precisar.</li>
            <li><strong>Produção:</strong> registre unidades boas e defeituosas em cada etapa. Retrabalhos ficam registrados.</li>
            <li><strong>Gestão:</strong> acompanhe o que foi concluído, filtre períodos e emita relatórios.</li>
          </ol>
          <p><strong>Dica:</strong> use o botão Busca rápida ou <kbd>Ctrl</kbd> + <kbd>K</kbd> para encontrar funções e OPs sem navegar por várias telas.</p>
          <p className="pf-help-warning">Ambiente de testes: o workspace principal não possui autenticação individual segura. Use apenas dados fictícios.</p>
          <button className="primary-button" onClick={() => { setHelpOpen(false); navigate('inicio') }}>Ir para o início <Home size={16}/></button>
        </div>
      </section>
    </div>}
    {toast && <div className="toast" role="status"><ShieldCheck size={16}/> {toast}</div>}
  </div>
}

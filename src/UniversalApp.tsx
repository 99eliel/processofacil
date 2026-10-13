import { useMemo, useState } from 'react'
import {
  ArrowRight, Boxes, Building2, Check, ChevronDown, ChevronRight, ClipboardCheck,
  Factory, FileSpreadsheet, FileText, GitBranch, LayoutDashboard, Menu, PackageCheck,
  Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Users, Workflow, X,
} from 'lucide-react'
import { codeSegments, demoCompany, materials, orders, products, sheets, workflow } from './data'
import type { ModuleKey } from './domain/types'

type Page = 'home' | 'materiais' | 'produtos' | 'fichas' | 'workflow' | 'ordens' | 'qualidade' | 'admin'
type ModuleCard = { id: Page; module?: ModuleKey; title: string; description: string; icon: typeof Boxes }

const modules: ModuleCard[] = [
  { id: 'materiais', module: 'materiais', title: 'Materiais', description: 'Cadastro mestre, categorias, unidades e fornecedores', icon: Boxes },
  { id: 'produtos', module: 'produtos', title: 'Produtos', description: 'Produtos, classificações e códigos configuráveis', icon: PackageCheck },
  { id: 'fichas', module: 'fichas', title: 'Ficha Técnica', description: 'Blocos configuráveis, BOM, revisões e anexos', icon: FileText },
  { id: 'workflow', module: 'workflow', title: 'Workflow', description: 'Etapas, aprovações, perfis e regras de transição', icon: Workflow },
  { id: 'ordens', module: 'ordens', title: 'Ordens de Produção', description: 'OPs com vários itens, variantes e rastreabilidade', icon: Factory },
  { id: 'qualidade', module: 'qualidade', title: 'Qualidade', description: 'Critérios, tolerâncias, checklists e inspeções', icon: ShieldCheck },
]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [enabledModules, setEnabledModules] = useState<Record<ModuleKey, boolean>>({ ...demoCompany.modulos })

  const activeModules = useMemo(
    () => modules.filter((item) => !item.module || enabledModules[item.module]),
    [enabledModules],
  )

  const open = (target: Page) => {
    setPage(target)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><GitBranch size={24} /></div>
        <div><strong>Processo Fácil</strong><span>Sistema universal de processos</span></div>
        <button className="close-menu" onClick={() => setMobileMenu(false)}><X size={20} /></button>
      </div>

      <div className="tenant-card">
        <span className="tenant-logo"><Building2 size={18} /></span>
        <div><small>Empresa ativa</small><strong>{demoCompany.nomeFantasia}</strong></div>
        <ChevronDown size={16} />
      </div>

      <nav className="desktop-nav">
        <NavButton active={page === 'home'} icon={LayoutDashboard} label="Visão geral" onClick={() => open('home')} />
        {activeModules.map(({ id, title, icon }) =>
          <NavButton key={id} active={page === id} icon={icon} label={title} onClick={() => open(id)} />)}
        <div className="nav-separator" />
        <NavButton active={page === 'admin'} icon={Settings} label="Configurações" onClick={() => open('admin')} />
      </nav>

      <div className="sidebar-footer">
        <div><span className="connection-dot" /> Ambiente multiempresa</div>
        <small>Base universal · v0.3.0</small>
      </div>
    </aside>

    {mobileMenu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

    <main className="content">
      <header className="topbar">
        <div className="topbar-left">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div><p className="eyebrow">{demoCompany.nomeFantasia} · Matriz</p><h1>{pageTitle(page)}</h1></div>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button compact" onClick={() => setShowWizard(true)}><Sparkles size={17} /> Configurar empresa</button>
          <button className="profile-button" aria-label="Perfil">AD</button>
        </div>
      </header>

      {page === 'home' && <Home open={open} modules={activeModules} />}
      {page === 'materiais' && <Materiais notify={notify} />}
      {page === 'produtos' && <Produtos notify={notify} />}
      {page === 'fichas' && <Fichas notify={notify} />}
      {page === 'workflow' && <WorkflowPage notify={notify} />}
      {page === 'ordens' && <Ordens notify={notify} />}
      {page === 'qualidade' && <Qualidade notify={notify} />}
      {page === 'admin' && <Admin enabledModules={enabledModules} setEnabledModules={setEnabledModules} onWizard={() => setShowWizard(true)} notify={notify} />}
    </main>

    <nav className="bottom-nav">
      <button className={page === 'home' ? 'active' : ''} onClick={() => open('home')}><LayoutDashboard size={20} /><span>Início</span></button>
      <button className={page === 'materiais' ? 'active' : ''} onClick={() => open('materiais')}><Boxes size={20} /><span>Materiais</span></button>
      <button className={page === 'fichas' ? 'active' : ''} onClick={() => open('fichas')}><FileText size={20} /><span>Fichas</span></button>
      <button className={page === 'admin' ? 'active' : ''} onClick={() => open('admin')}><Settings size={20} /><span>Config.</span></button>
    </nav>

    {showWizard && <SetupWizard onClose={() => setShowWizard(false)} notify={notify} />}
    {toast && <div className="toast"><Check size={18} /> {toast}</div>}
  </div>
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Boxes; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} /><span>{label}</span></button>
}

function Home({ open, modules }: { open: (page: Page) => void; modules: ModuleCard[] }) {
  return <>
    <section className="hero-card universal-hero">
      <div>
        <span className="hero-label">Núcleo universal ativo</span>
        <h2>Organize processos sem prender sua empresa a um modelo único.</h2>
        <p>Cadastros, fichas, aprovações, produção e qualidade compartilham a mesma base, mas cada empresa configura o próprio fluxo.</p>
        <button className="hero-action" onClick={() => open('admin')}><SlidersHorizontal size={18} /> Abrir configurações</button>
      </div>
      <div className="hero-stat"><strong>6</strong><span>módulos disponíveis</span><div className="mini-progress"><i style={{ width: '100%' }} /></div></div>
    </section>

    <section className="stats-grid">
      <Stat icon={Boxes} label="Materiais ativos" value="128" meta="4 pendências de cadastro" />
      <Stat icon={PackageCheck} label="Produtos" value="36" meta="3 sem ficha publicada" />
      <Stat icon={FileText} label="Fichas em validação" value="5" meta="2 aguardando aprovação" />
      <Stat icon={Factory} label="OPs abertas" value="11" meta="3 em produção" />
    </section>

    <section className="dashboard-grid">
      <div className="panel">
        <div className="panel-head"><div><span className="section-kicker">Arquitetura</span><h3>Configuração desta empresa</h3></div><button className="text-button" onClick={() => open('admin')}>Editar <ChevronRight size={16} /></button></div>
        <div className="architecture-list">
          <ArchitectureItem icon={Building2} title="Tenant isolado" text="Dados vinculados à empresa e protegidos por regras do Firestore." />
          <ArchitectureItem icon={GitBranch} title="Código configurável" text="A empresa define sua própria árvore e pode migrar estratégias futuras." />
          <ArchitectureItem icon={Workflow} title="Workflow configurável" text="Etapas, responsáveis, aprovações e retornos definidos pela empresa." />
          <ArchitectureItem icon={FileSpreadsheet} title="Ficha flexível" text="BOM, medidas e outros blocos podem ser ativados conforme o processo." />
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><div><span className="section-kicker">Pendências</span><h3>O que precisa de atenção</h3></div><span className="count-badge">4</span></div>
        <Alert title="2 fichas aguardando validação" text="Há revisões prontas para seguir no fluxo configurado." />
        <Alert title="1 material sem fornecedor principal" text="O cadastro aceita múltiplos fornecedores, mas um pode ser definido como principal." />
        <Alert title="1 produto sem ficha publicada" text="O produto existe, porém ainda não pode entrar em fluxos que exijam FT padrão." />
      </div>
    </section>

    <section className="section-header"><div><span className="section-kicker">Acesso rápido</span><h3>Módulos ativos</h3></div><span className="muted">configuráveis por empresa</span></section>
    <section className="module-grid">
      {modules.map(({ id, title, description, icon: Icon }) =>
        <button className="module-card" key={id} onClick={() => open(id)}>
          <span className="module-icon"><Icon size={22} /></span>
          <span className="module-copy"><strong>{title}</strong><small>{description}</small></span>
          <ChevronRight className="module-arrow" size={19} />
        </button>)}
    </section>
  </>
}

function Stat({ icon: Icon, label, value, meta }: { icon: typeof Boxes; label: string; value: string; meta: string }) {
  return <article className="stat-card"><span className="stat-icon"><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></article>
}

function ArchitectureItem({ icon: Icon, title, text }: { icon: typeof Boxes; title: string; text: string }) {
  return <div className="architecture-item"><span><Icon size={18} /></span><div><strong>{title}</strong><small>{text}</small></div></div>
}

function Alert({ title, text }: { title: string; text: string }) {
  return <div className="alert-row info"><span className="alert-icon"><ClipboardCheck size={18} /></span><div><strong>{title}</strong><small>{text}</small></div></div>
}

function PageIntro({ kicker, title, text, action, onAction }: { kicker: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return <section className="page-intro"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{text}</p></div>{action && <button className="primary-button" onClick={onAction}><Plus size={18} /> {action}</button>}</section>
}

function SearchToolbar({ placeholder }: { placeholder: string }) {
  return <div className="toolbar"><div className="search-box"><Search size={18} /><input placeholder={placeholder} /></div><button className="filter-button"><SlidersHorizontal size={16} /> Filtros</button></div>
}

function Materiais({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageIntro kicker="Cadastro mestre" title="Materiais" text="Cadastro universal de materiais com categorias configuráveis, unidades livres e múltiplos fornecedores." action="Novo material" onAction={() => notify('Formulário de material preparado para a próxima etapa.')} />
    <SearchToolbar placeholder="Buscar por código, descrição, categoria ou fornecedor..." />
    <section className="stats-grid compact"><Stat icon={Boxes} label="Ativos" value="128" meta="cadastros disponíveis" /><Stat icon={GitBranch} label="Categorias" value="18" meta="árvore configurável" /><Stat icon={Building2} label="Fornecedores" value="24" meta="3 alternativos" /><Stat icon={ClipboardCheck} label="Pendências" value="4" meta="requerem revisão" /></section>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Categoria</th><th>Unidade</th><th>Fornecedores</th><th>Status</th></tr></thead><tbody>{materials.map((m) => <tr key={m.id}><td><strong>{m.codigo}</strong></td><td>{m.descricao}</td><td>{m.categoria}</td><td>{m.unidade}</td><td>{m.fornecedores.join(', ')}</td><td><Status text={m.ativo ? 'Ativo' : 'Inativo'} tone={m.ativo ? 'green' : 'slate'} /></td></tr>)}</tbody></table></div></section>
  </>
}

function Produtos({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageIntro kicker="Cadastro universal" title="Produtos" text="Produtos independentes do segmento, com classificações e estratégia de código definidas pela própria empresa." action="Novo produto" onAction={() => notify('Gerador de produto aberto no protótipo.')} />
    <section className="panel code-builder">
      <div className="panel-head"><div><span className="section-kicker">Estratégia de código</span><h3>Árvore configurada</h3></div><Status text="Ativa" tone="green" /></div>
      <div className="segment-row">{codeSegments.map((segment) => <div className="segment-card" key={segment.id}><span>{segment.ordem}</span><div><strong>{segment.nome}</strong><small>{segment.tamanho} caracteres · {segment.obrigatorio ? 'obrigatório' : 'opcional'}</small></div></div>)}</div>
      <p className="helper-text">Esta árvore pertence apenas à empresa ativa. Outro cliente pode usar segmentos diferentes, código sequencial, código manual ou integração externa.</p>
    </section>
    <SearchToolbar placeholder="Buscar produto por código, descrição ou classificação..." />
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Classificações</th><th>Revisão vigente</th><th>Status</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><strong>{p.codigo}</strong></td><td>{p.descricao}</td><td>{Object.entries(p.classificacoes).map(([k,v]) => `${k}: ${v}`).join(' · ')}</td><td>{p.revisaoVigente ? `REV ${String(p.revisaoVigente).padStart(2, '0')}` : 'Sem FT padrão'}</td><td><Status text={p.status === 'ativo' ? 'Ativo' : 'Inativo'} tone={p.status === 'ativo' ? 'green' : 'slate'} /></td></tr>)}</tbody></table></div></section>
  </>
}

function Fichas({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageIntro kicker="Engenharia" title="Fichas Técnicas" text="Fichas flexíveis por tipo de produto. Uma ficha publicada pode ser editada pela interface, mas a alteração gera uma nova revisão preservando o histórico." action="Nova ficha" onAction={() => notify('Editor de ficha preparado para a próxima etapa.')} />
    <section className="info-banner"><ShieldCheck size={20} /><div><strong>Histórico preservado</strong><span>Editar uma ficha publicada cria automaticamente uma nova revisão. A revisão anterior permanece congelada para rastreabilidade.</span></div></section>
    <div className="cards-list">{sheets.map((sheet) => <article className="sheet-card" key={sheet.id}><div className="sheet-head"><span className="sheet-icon"><FileText size={21} /></span><div><span className="op-number">{sheet.produtoCodigo}</span><h3>{sheet.produtoDescricao}</h3><small>Atualizada em {sheet.atualizadoEm}</small></div><Status text={sheet.status} tone={sheet.status === 'Padrão' ? 'green' : sheet.status === 'Em validação' ? 'blue' : 'slate'} /></div><div className="sheet-meta"><div><span>Revisão</span><strong>REV {String(sheet.revisao).padStart(2, '0')}</strong></div><div><span>Blocos ativos</span><strong>{sheet.blocos.length}</strong></div><div className="sheet-tags">{sheet.blocos.map((block) => <span key={block}>{block}</span>)}</div></div><div className="sheet-actions"><button className="secondary-button" onClick={() => notify('Visualização da ficha aberta.')}>Visualizar</button><button className="primary-button" onClick={() => notify(sheet.status === 'Padrão' ? 'Nova revisão criada a partir da revisão vigente.' : 'Rascunho aberto para edição.')}>Editar ficha</button></div></article>)}</div>
  </>
}

function WorkflowPage({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageIntro kicker="Automação de processo" title="Workflow" text="Cada empresa monta suas próprias etapas, perfis responsáveis, aprovações paralelas ou sequenciais e destinos de reprovação." action="Nova etapa" onAction={() => notify('Nova etapa adicionada ao rascunho do workflow.')} />
    <section className="panel workflow-panel">
      <div className="panel-head"><div><span className="section-kicker">Fluxo ativo</span><h3>Processo principal</h3></div><button className="secondary-button compact" onClick={() => notify('Modo de edição do workflow ativado.')}><SlidersHorizontal size={16} /> Editar fluxo</button></div>
      <div className="workflow-list">{workflow.map((stage, index) => <div className="workflow-stage" key={stage.id}><div className="stage-number">{index + 1}</div><div className="stage-copy"><strong>{stage.nome}</strong><small>Perfil: {stage.perfil} · {stage.obrigatoria ? 'etapa obrigatória' : 'etapa opcional'}</small></div>{index < workflow.length - 1 && <ArrowRight size={18} />}</div>)}</div>
      <div className="workflow-options"><span><Check size={15} /> Aprovação sequencial</span><span><Check size={15} /> Aprovação paralela disponível</span><span><Check size={15} /> Reprovação pergunta o destino</span><span><Check size={15} /> Admin pode pular etapa com justificativa</span></div>
    </section>
  </>
}

function Ordens({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageIntro kicker="Planejamento" title="Ordens de Produção" text="OP genérica com vários produtos, variantes e revisão/kit congelados no momento da liberação quando a empresa exigir FT." action="Nova OP" onAction={() => notify('Nova Ordem de Produção iniciada.')} />
    <div className="cards-list">{orders.map((op) => <article className="op-card universal-op" key={op.id}><div className="op-top"><div><span className="op-number">{op.numero}</span><h3>{op.itens} {op.itens === 1 ? 'produto' : 'produtos'} · {op.variantes} variantes</h3><small>Prazo {op.prazo}</small></div><Status text={op.status} tone={op.status === 'Em produção' ? 'blue' : op.status === 'Qualidade' ? 'amber' : 'slate'} /></div><div className="progress-wrap"><div><span>Progresso do fluxo</span><strong>{op.progresso}%</strong></div><div className="progress"><i style={{ width: `${op.progresso}%` }} /></div></div><div className="op-footer"><span>Revisões e kits são snapshots da liberação.</span><button className="text-button" onClick={() => notify(`Abrindo ${op.numero}`)}>Abrir OP <ChevronRight size={16} /></button></div></article>)}</div>
  </>
}

function Qualidade({ notify }: { notify: (message: string) => void }) {
  const criteria = [['Dimensional', 'Numérico', 'Tolerância configurável'], ['Acabamento visual', 'Checklist', 'Maior'], ['Identificação', 'Checklist', 'Crítico'], ['Funcionamento', 'Sim/Não', 'Crítico']]
  return <>
    <PageIntro kicker="Controle configurável" title="Qualidade" text="A empresa combina critérios numéricos, checklist e classificações de severidade. Cada amostra permanece registrada individualmente." action="Nova inspeção" onAction={() => notify('Nova inspeção iniciada.')} />
    <section className="stats-grid compact"><Stat icon={ClipboardCheck} label="Inspeções" value="18" meta="últimos 30 dias" /><Stat icon={ShieldCheck} label="Aprovação" value="94,6%" meta="regra da empresa" /><Stat icon={GitBranch} label="Critérios" value="12" meta="4 críticos" /><Stat icon={Factory} label="Retrabalhos" value="2" meta="em acompanhamento" /></section>
    <section className="panel"><div className="panel-head"><div><span className="section-kicker">Critérios ativos</span><h3>Modelo de inspeção</h3></div><button className="secondary-button compact" onClick={() => notify('Editor de critérios aberto.')}>Configurar</button></div><div className="table-wrap"><table><thead><tr><th>Critério</th><th>Tipo</th><th>Regra</th><th>Status</th></tr></thead><tbody>{criteria.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td><Status text="Ativo" tone="green" /></td></tr>)}</tbody></table></div></section>
  </>
}

function Admin({ enabledModules, setEnabledModules, onWizard, notify }: { enabledModules: Record<ModuleKey, boolean>; setEnabledModules: (value: Record<ModuleKey, boolean>) => void; onWizard: () => void; notify: (message: string) => void }) {
  const toggle = (key: ModuleKey) => setEnabledModules({ ...enabledModules, [key]: !enabledModules[key] })
  return <>
    <PageIntro kicker="Administração" title="Configuração da empresa" text="As regras abaixo pertencem apenas a esta empresa. Nenhuma delas é hardcoded para os outros clientes." action="Assistente inicial" onAction={onWizard} />
    <div className="two-columns">
      <section className="panel"><BlockTitle title="Empresa e filiais" /><Info label="Razão social" value={demoCompany.nome} /><Info label="Documento" value={demoCompany.documento} /><div className="branch-list">{demoCompany.filiais.map((filial) => <span key={filial.id}><Building2 size={15} /> {filial.nome}</span>)}</div><button className="text-button" onClick={() => notify('Cadastro de filiais aberto.')}>Gerenciar filiais <ChevronRight size={16} /></button></section>
      <section className="panel"><BlockTitle title="Usuários e perfis" /><div className="profile-summary"><span><Users size={20} /></span><div><strong>Perfis configuráveis</strong><small>Um usuário pode ter mais de um perfil. Permissões são concedidas por perfil.</small></div></div><button className="text-button" onClick={() => notify('Gerenciamento de usuários preparado para Firebase Auth.')}>Gerenciar usuários <ChevronRight size={16} /></button></section>
    </div>
    <section className="panel"><BlockTitle title="Módulos ativos" /><div className="toggle-grid">{modules.filter((item) => item.module).map(({ module, title, description, icon: Icon }) => <button className={`toggle-card ${enabledModules[module!] ? 'enabled' : ''}`} key={module} onClick={() => toggle(module!)}><span className="module-icon"><Icon size={20} /></span><div><strong>{title}</strong><small>{description}</small></div><span className="switch"><i /></span></button>)}</div></section>
    <section className="settings-grid">
      <Setting icon={GitBranch} title="Estratégias de código" text="Árvores, sequenciais, códigos manuais e migrações" onClick={() => notify('Configuração de código selecionada.')} />
      <Setting icon={Boxes} title="Categorias e unidades" text="Árvore livre e catálogo de unidades por empresa" onClick={() => notify('Configuração de categorias selecionada.')} />
      <Setting icon={FileText} title="Blocos de Ficha Técnica" text="Ative BOM, medidas, operações, checklist e campos extras" onClick={() => notify('Configuração de FT selecionada.')} />
      <Setting icon={Workflow} title="Workflows" text="Etapas, aprovações, responsáveis e retornos" onClick={() => notify('Configuração de workflow selecionada.')} />
      <Setting icon={FileSpreadsheet} title="Importação Excel/CSV" text="Mapeamento genérico de colunas com pré-validação" onClick={() => notify('Importador genérico será a próxima entrega funcional.')} />
      <Setting icon={ShieldCheck} title="Auditoria e segurança" text="Histórico, exportação e isolamento por tenant" onClick={() => notify('Painel de auditoria selecionado.')} />
    </section>
  </>
}

function SetupWizard({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [step, setStep] = useState(1)
  const finish = () => { notify('Configuração inicial salva para a empresa ativa.'); onClose() }
  return <div className="modal-backdrop"><section className="wizard-modal">
    <div className="wizard-head"><div><span className="section-kicker">Assistente da empresa</span><h2>Configuração inicial</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
    <div className="wizard-progress"><i style={{ width: `${step * 25}%` }} /></div>
    {step === 1 && <WizardStep title="1. Identidade e estrutura" text="Cadastre nome, documento, logo, matriz e filiais. Estes dados aparecem também nos documentos gerados." items={['Dados institucionais', 'Matriz e filiais', 'Identidade da empresa']} />}
    {step === 2 && <WizardStep title="2. Módulos" text="Ative apenas as áreas que fazem sentido para a empresa. Os módulos podem ser alterados depois." items={['Materiais e produtos', 'Ficha Técnica', 'Workflow, OP e Qualidade']} />}
    {step === 3 && <WizardStep title="3. Regras do processo" text="Defina código de produto, categorias, unidades, perfis e etapas sem depender de regras de um segmento específico." items={['Estratégia de código', 'Árvore de categorias', 'Perfis e workflow']} />}
    {step === 4 && <WizardStep title="4. Importação" text="Comece vazio, escolha um template ou importe planilhas usando mapeamento de colunas." items={['Começar vazio', 'Usar template', 'Importar Excel/CSV']} />}
    <div className="wizard-actions"><button className="secondary-button" disabled={step === 1} onClick={() => setStep(Math.max(1, step - 1))}>Voltar</button>{step < 4 ? <button className="primary-button" onClick={() => setStep(step + 1)}>Continuar <ArrowRight size={17} /></button> : <button className="primary-button" onClick={finish}><Check size={17} /> Concluir</button>}</div>
  </section></div>
}

function WizardStep({ title, text, items }: { title: string; text: string; items: string[] }) {
  return <div className="wizard-body"><h3>{title}</h3><p>{text}</p><div className="wizard-options">{items.map((item) => <div key={item}><Check size={16} /><span>{item}</span></div>)}</div></div>
}

function Setting({ icon: Icon, title, text, onClick }: { icon: typeof Boxes; title: string; text: string; onClick: () => void }) {
  return <button className="setting-card" onClick={onClick}><span><Icon size={21} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={18} /></button>
}
function BlockTitle({ title }: { title: string }) { return <div className="block-title"><h3>{title}</h3></div> }
function Info({ label, value }: { label: string; value: string }) { return <div className="info"><span>{label}</span><strong>{value}</strong></div> }
function Status({ text, tone }: { text: string; tone: string }) { return <span className={`status status-${tone}`}>{text}</span> }
function pageTitle(page: Page) {
  const names: Record<Page, string> = { home: 'Visão geral', materiais: 'Materiais', produtos: 'Produtos', fichas: 'Fichas Técnicas', workflow: 'Workflow', ordens: 'Ordens de Produção', qualidade: 'Qualidade', admin: 'Configurações' }
  return names[page]
}

export default App

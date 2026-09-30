import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Factory,
  FileText,
  Heart,
  LayoutDashboard,
  Menu,
  PackageCheck,
  PlayCircle,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
  X,
} from 'lucide-react'

type Page =
  | 'home'
  | 'oficinas'
  | 'ordens'
  | 'ficha'
  | 'pop'
  | 'carga'
  | 'qualidade'
  | 'ra'
  | 'busca'
  | 'favoritos'
  | 'atualizacoes'
  | 'pagamentos'
  | 'admin'

type ModuleCard = {
  id: Page
  title: string
  description: string
  icon: typeof Factory
  tone: string
}

const modules: ModuleCard[] = [
  { id: 'oficinas', title: 'Oficinas', description: 'Facções, capacidade e desempenho', icon: Factory, tone: 'blue' },
  { id: 'ordens', title: 'Ordens de Produção', description: 'Criar, distribuir e acompanhar OPs', icon: PackageCheck, tone: 'indigo' },
  { id: 'ficha', title: 'Ficha Técnica', description: 'Passaporte digital do produto', icon: FileText, tone: 'cyan' },
  { id: 'pop', title: 'POP', description: 'Procedimentos, vídeos e operação', icon: ClipboardCheck, tone: 'violet' },
  { id: 'carga', title: 'Carga Máq. e M.O.', description: 'Capacidade, máquinas e operadores', icon: Wrench, tone: 'orange' },
  { id: 'qualidade', title: 'Qualidade', description: 'Inspeções e não conformidades', icon: ShieldCheck, tone: 'green' },
  { id: 'ra', title: 'Realidade Aumentada', description: 'Consulta guiada em campo', icon: Sparkles, tone: 'pink' },
  { id: 'busca', title: 'Busca Avançada', description: 'Localize fichas, POPs e OPs', icon: Search, tone: 'slate' },
  { id: 'favoritos', title: 'Favoritos', description: 'Biblioteca de acesso rápido', icon: Heart, tone: 'rose' },
  { id: 'atualizacoes', title: 'Atualizações', description: 'Comunicados e novas versões', icon: Bell, tone: 'amber' },
  { id: 'pagamentos', title: 'Pagamentos', description: 'Fechamento das facções', icon: WalletCards, tone: 'emerald' },
]

const oficinas = [
  { nome: 'Facção Horizonte', cidade: 'Goiânia · GO', categoria: 'A', capacidade: 520, pessoas: 18, qualidade: '9,7', prazo: '98%', status: 'Ativa' },
  { nome: 'Costura Nova Era', cidade: 'Aparecida de Goiânia · GO', categoria: 'A', capacidade: 430, pessoas: 14, qualidade: '9,4', prazo: '95%', status: 'Ativa' },
  { nome: 'Ateliê União', cidade: 'Trindade · GO', categoria: 'B', capacidade: 310, pessoas: 11, qualidade: '8,6', prazo: '86%', status: 'Ativa' },
]

const ordens = [
  { numero: 'OP-2026-0184', produto: 'Polo Masculina Manga Curta', ref: 'UNI-2458', oficina: 'Facção Horizonte', qtd: 1200, progresso: 68, prazo: '04 out', status: 'Em produção', prioridade: 'Alta' },
  { numero: 'OP-2026-0185', produto: 'Camiseta Básica Uniforme', ref: 'UNI-2191', oficina: 'Costura Nova Era', qtd: 800, progresso: 42, prazo: '07 out', status: 'Em produção', prioridade: 'Normal' },
  { numero: 'OP-2026-0182', produto: 'Polo Feminina Manga Curta', ref: 'UNI-2459', oficina: 'Ateliê União', qtd: 540, progresso: 100, prazo: '29 set', status: 'Concluída', prioridade: 'Normal' },
  { numero: 'OP-2026-0186', produto: 'Jaleco Profissional', ref: 'UNI-3010', oficina: 'Facção Horizonte', qtd: 300, progresso: 0, prazo: '10 out', status: 'Distribuída', prioridade: 'Urgente' },
]

const operations = [
  ['10', 'Fechar ombros', 'Overloque 5 fios', '0,35 min'],
  ['20', 'Preparar gola', 'Reta eletrônica', '0,42 min'],
  ['30', 'Pregar gola', 'Overloque 5 fios', '0,58 min'],
  ['40', 'Pregar mangas', 'Overloque 5 fios', '0,48 min'],
  ['50', 'Fechar laterais', 'Overloque 5 fios', '0,57 min'],
  ['60', 'Fazer bainha', 'Galoneira', '0,45 min'],
]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [favorite, setFavorite] = useState(true)
  const [selectedOp, setSelectedOp] = useState(ordens[0])

  const today = useMemo(
    () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()),
    [],
  )

  const open = (target: Page) => {
    setPage(target)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2300)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={24} /></div>
          <div><strong>Processo Fácil</strong><span>Gestão de Produção</span></div>
          <button className="close-menu" onClick={() => setMobileMenu(false)}><X size={20} /></button>
        </div>

        <nav className="desktop-nav">
          <NavButton active={page === 'home'} icon={LayoutDashboard} label="Visão geral" onClick={() => open('home')} />
          <NavButton active={page === 'oficinas'} icon={Factory} label="Oficinas" onClick={() => open('oficinas')} />
          <NavButton active={page === 'ordens'} icon={PackageCheck} label="Ordens de Produção" onClick={() => open('ordens')} />
          <NavButton active={page === 'ficha'} icon={FileText} label="Ficha Técnica" onClick={() => open('ficha')} />
          <NavButton active={page === 'pop'} icon={ClipboardCheck} label="POP" onClick={() => open('pop')} />
          <NavButton active={page === 'qualidade'} icon={ShieldCheck} label="Qualidade" onClick={() => open('qualidade')} />
          <div className="nav-separator" />
          <NavButton active={page === 'busca'} icon={Search} label="Busca" onClick={() => open('busca')} />
          <NavButton active={page === 'atualizacoes'} icon={Bell} label="Atualizações" onClick={() => open('atualizacoes')} badge="3" />
          <NavButton active={page === 'admin'} icon={Settings} label="Administração" onClick={() => open('admin')} />
        </nav>

        <div className="sidebar-footer">
          <div><span className="connection-dot" /> Online e sincronizado</div>
          <small>Protótipo · Versão 0.2.0</small>
        </div>
      </aside>

      {mobileMenu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
            <div>
              <p className="eyebrow">{page === 'home' ? today : 'Processo Fácil'}</p>
              <h1>{page === 'home' ? 'Visão geral' : pageTitle(page)}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => open('atualizacoes')}><Bell size={19} /><span className="notification-dot" /></button>
            <button className="profile-button" aria-label="Perfil">EF</button>
          </div>
        </header>

        {page !== 'home' && <button className="back-link" onClick={() => open('home')}><ArrowLeft size={17} /> Voltar à visão geral</button>}

        {page === 'home' && <Home open={open} />}
        {page === 'oficinas' && <Oficinas notify={notify} />}
        {page === 'ordens' && <Ordens selectedOp={selectedOp} setSelectedOp={setSelectedOp} notify={notify} />}
        {page === 'ficha' && <Ficha favorite={favorite} setFavorite={setFavorite} notify={notify} open={open} />}
        {page === 'pop' && <Pop notify={notify} />}
        {page === 'carga' && <Carga />}
        {page === 'qualidade' && <Qualidade notify={notify} />}
        {page === 'ra' && <RealidadeAumentada notify={notify} />}
        {page === 'busca' && <Busca open={open} />}
        {page === 'favoritos' && <Favoritos open={open} />}
        {page === 'atualizacoes' && <Atualizacoes />}
        {page === 'pagamentos' && <Pagamentos notify={notify} />}
        {page === 'admin' && <Admin notify={notify} />}
      </main>

      <nav className="bottom-nav">
        <button className={page === 'home' ? 'active' : ''} onClick={() => open('home')}><LayoutDashboard size={20} /><span>Início</span></button>
        <button className={page === 'ordens' ? 'active' : ''} onClick={() => open('ordens')}><PackageCheck size={20} /><span>OPs</span></button>
        <button className={page === 'busca' ? 'active' : ''} onClick={() => open('busca')}><Search size={20} /><span>Buscar</span></button>
        <button className={page === 'atualizacoes' ? 'active' : ''} onClick={() => open('atualizacoes')}><Bell size={20} /><span>Atualizações</span><i /></button>
      </nav>

      {toast && <div className="toast"><Check size={18} /> {toast}</div>}
    </div>
  )
}

function NavButton({ active, icon: Icon, label, onClick, badge }: { active: boolean; icon: typeof Factory; label: string; onClick: () => void; badge?: string }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} /><span>{label}</span>{badge && <b>{badge}</b>}</button>
}

function Home({ open }: { open: (page: Page) => void }) {
  return <>
    <section className="hero-card">
      <div>
        <span className="hero-label">Quarta-feira · Operação ativa</span>
        <h2>Produção organizada do início ao fim.</h2>
        <p>Acompanhe produção, capacidade, qualidade e conhecimento técnico em um único ambiente.</p>
        <button className="hero-action" onClick={() => open('ordens')}><PackageCheck size={18} /> Acompanhar produção</button>
      </div>
      <div className="hero-stat"><strong>68%</strong><span>produção da OP principal</span><div className="mini-progress"><i style={{ width: '68%' }} /></div></div>
    </section>

    <section className="stats-grid">
      <Stat icon={PackageCheck} label="OPs em produção" value="7" meta="2 vencem esta semana" />
      <Stat icon={Factory} label="Oficinas ativas" value="3" meta="1.260 peças/dia" />
      <Stat icon={TrendingUp} label="Eficiência média" value="91,4%" meta="+3,2% no mês" positive />
      <Stat icon={ShieldCheck} label="Qualidade" value="96,8%" meta="1 NC em aberto" />
    </section>

    <div className="dashboard-grid">
      <section className="panel production-panel">
        <div className="panel-head"><div><span className="section-kicker">Produção agora</span><h3>OP-2026-0184</h3></div><button className="text-button" onClick={() => open('ordens')}>Ver detalhes <ChevronRight size={16} /></button></div>
        <div className="product-row"><div className="product-thumb">UNI</div><div><strong>Polo Masculina Manga Curta</strong><span>Ref. UNI-2458 · Facção Horizonte</span></div><Status text="Em produção" tone="blue" /></div>
        <div className="progress-wrap"><div><span>Produzido</span><strong>816 / 1.200 peças</strong></div><div className="progress"><i style={{ width: '68%' }} /></div></div>
        <div className="timeline-mini"><div className="done"><i /><span>Corte</span></div><div className="done"><i /><span>Preparação</span></div><div className="current"><i /><span>Costura</span></div><div><i /><span>Acabamento</span></div><div><i /><span>Final</span></div></div>
      </section>

      <section className="panel alerts-panel">
        <div className="panel-head"><div><span className="section-kicker">Atenção</span><h3>Pontos do dia</h3></div><span className="count-badge">3</span></div>
        <Alert tone="warning" title="Capacidade próxima do limite" text="Overloque 5 fios está com 94% de utilização." />
        <Alert tone="danger" title="Não conformidade aberta" text="OP-0185 · Bainha ondulada · Prazo hoje." />
        <Alert tone="info" title="Nova ficha aprovada" text="UNI-2458 · versão 4 disponível para consulta." />
      </section>
    </div>

    <section className="section-header"><div><span className="section-kicker">Acesso rápido</span><h3>Módulos do sistema</h3></div><span className="muted">11 áreas</span></section>
    <section className="module-grid">
      {modules.map(({ id, title, description, icon: Icon, tone }) => <button className="module-card" key={id} onClick={() => open(id)}><span className={`module-icon ${tone}`}><Icon size={22} /></span><span className="module-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight className="module-arrow" size={19} /></button>)}
    </section>
  </>
}

function Stat({ icon: Icon, label, value, meta, positive }: { icon: typeof Factory; label: string; value: string; meta: string; positive?: boolean }) {
  return <article className="stat-card"><span className="stat-icon"><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong><small className={positive ? 'positive' : ''}>{meta}</small></div></article>
}

function Alert({ tone, title, text }: { tone: string; title: string; text: string }) {
  return <div className={`alert-row ${tone}`}><span className="alert-icon">{tone === 'danger' ? <AlertTriangle size={18} /> : tone === 'warning' ? <Clock3 size={18} /> : <Bell size={18} />}</span><div><strong>{title}</strong><small>{text}</small></div></div>
}

function PageIntro({ kicker, title, text, action, onAction }: { kicker: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return <section className="page-intro"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{text}</p></div>{action && <button className="primary-button" onClick={onAction}><Plus size={18} /> {action}</button>}</section>
}

function Oficinas({ notify }: { notify: (message: string) => void }) {
  return <>
    <PageIntro kicker="Módulo 1" title="Rede de oficinas" text="Capacidade, estrutura e desempenho das facções parceiras." action="Nova oficina" onAction={() => notify('Formulário de nova oficina aberto no protótipo.')} />
    <div className="toolbar"><div className="search-box"><Search size={18} /><input placeholder="Buscar oficina, cidade ou responsável..." /></div><button className="filter-button">Todas <ChevronRight size={16} /></button></div>
    <section className="stats-grid compact"><Stat icon={Factory} label="Oficinas ativas" value="3" meta="3 cadastradas" /><Stat icon={PackageCheck} label="Capacidade/dia" value="1.260" meta="peças estimadas" /><Stat icon={Users} label="Pessoas" value="43" meta="nas facções" /><Stat icon={ShieldCheck} label="Nota média" value="9,2" meta="qualidade geral" /></section>
    <section className="cards-list">
      {oficinas.map((o) => <article className="office-card" key={o.nome}><div className="office-head"><div className="office-avatar"><Factory size={23} /></div><div><h3>{o.nome}</h3><span>{o.cidade}</span></div><span className={`category category-${o.categoria.toLowerCase()}`}>Categoria {o.categoria}</span></div><div className="office-metrics"><Metric label="Capacidade" value={`${o.capacidade} peças/dia`} /><Metric label="Equipe" value={`${o.pessoas} pessoas`} /><Metric label="Qualidade" value={o.qualidade} /><Metric label="No prazo" value={o.prazo} /></div><div className="office-footer"><Status text={o.status} tone="green" /><button className="text-button" onClick={() => notify(`Abrindo ficha de ${o.nome}`)}>Ver ficha <ChevronRight size={16} /></button></div></article>)}
    </section>
  </>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }

function Ordens({ selectedOp, setSelectedOp, notify }: { selectedOp: typeof ordens[0]; setSelectedOp: (op: typeof ordens[0]) => void; notify: (message: string) => void }) {
  const [detail, setDetail] = useState(false)
  if (detail) return <OpDetail op={selectedOp} onBack={() => setDetail(false)} />
  return <>
    <PageIntro kicker="Módulo 2" title="Ordens de Produção" text="Distribuição, progresso, prioridades e rastreabilidade da produção." action="Criar OP" onAction={() => notify('Nova ordem preparada para cadastro.')} />
    <div className="tab-row"><button className="active">Todas <b>12</b></button><button>Em produção <b>7</b></button><button>Distribuídas <b>2</b></button><button>Concluídas <b>3</b></button></div>
    <section className="op-list">
      {ordens.map((op) => <button className="op-card" key={op.numero} onClick={() => { setSelectedOp(op); setDetail(true) }}><div className="op-top"><div><span className="op-number">{op.numero}</span><h3>{op.produto}</h3><small>Ref. {op.ref} · {op.oficina}</small></div><Status text={op.status} tone={op.status === 'Concluída' ? 'green' : op.status === 'Distribuída' ? 'slate' : 'blue'} /></div><div className="op-data"><Metric label="Quantidade" value={`${op.qtd.toLocaleString('pt-BR')} peças`} /><Metric label="Prazo" value={op.prazo} /><Metric label="Prioridade" value={op.prioridade} /><div className="metric progress-metric"><span>Progresso</span><strong>{op.progresso}%</strong><div className="progress thin"><i style={{ width: `${op.progresso}%` }} /></div></div></div></button>)}
    </section>
  </>
}

function OpDetail({ op, onBack }: { op: typeof ordens[0]; onBack: () => void }) {
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Lista de ordens</button>
    <section className="detail-hero"><div><span className="op-number">{op.numero}</span><h2>{op.produto}</h2><p>Ref. {op.ref} · {op.oficina}</p></div><Status text={op.status} tone="blue" /></section>
    <section className="detail-summary"><Metric label="Quantidade total" value={`${op.qtd.toLocaleString('pt-BR')} peças`} /><Metric label="Produzido" value={`${Math.round(op.qtd * op.progresso / 100).toLocaleString('pt-BR')} peças`} /><Metric label="Prazo" value={op.prazo} /><Metric label="Progresso" value={`${op.progresso}%`} /></section>
    <div className="two-columns"><section className="panel"><div className="panel-head"><div><span className="section-kicker">Fluxo</span><h3>Etapas de produção</h3></div></div>{['Preparar gola', 'Fechar ombros', 'Pregar gola', 'Pregar mangas', 'Fechar laterais', 'Fazer bainha'].map((name, i) => <div className="task-row" key={name}><span className={`task-check ${i < 3 ? 'done' : i === 3 ? 'current' : ''}`}>{i < 3 ? <Check size={14} /> : i + 1}</span><div><strong>{name}</strong><small>{i < 3 ? 'Concluído' : i === 3 ? 'Em andamento · 68%' : 'Aguardando'}</small></div><span className="task-qty">{i < 3 ? '1.200' : i === 3 ? '816' : '—'}</span></div>)}</section><section className="panel"><div className="panel-head"><div><span className="section-kicker">Rastreabilidade</span><h3>Últimos eventos</h3></div></div><Timeline /></section></div>
  </>
}

function Timeline() { return <div className="timeline"><div><i /><span>Hoje · 15:42</span><strong>Apontamento de 120 peças</strong><small>Maria S. · Pregar mangas</small></div><div><i /><span>Hoje · 13:08</span><strong>Inspeção aprovada</strong><small>Amostra de 32 peças · 1 defeito</small></div><div><i /><span>Hoje · 08:03</span><strong>Produção retomada</strong><small>Turno da manhã iniciado</small></div><div><i /><span>Ontem · 17:55</span><strong>Etapa “Pregar gola” concluída</strong><small>1.200 peças processadas</small></div></div> }

function Ficha({ favorite, setFavorite, notify, open }: { favorite: boolean; setFavorite: (value: boolean) => void; notify: (message: string) => void; open: (page: Page) => void }) {
  return <>
    <section className="passport-header"><div className="passport-thumb"><FileText size={36} /></div><div className="passport-main"><span className="section-kicker">Passaporte Digital do Produto</span><h2>Polo Masculina Manga Curta</h2><div className="passport-meta"><span>Ref. <strong>UNI-2458</strong></span><span>Versão <strong>4</strong></span><span>Atualizada <strong>28/09/2026</strong></span><Status text="Aprovada" tone="green" /></div></div><div className="passport-actions"><button className={`icon-button large ${favorite ? 'favorite' : ''}`} onClick={() => setFavorite(!favorite)}><Star size={20} fill={favorite ? 'currentColor' : 'none'} /></button><button className="secondary-button" onClick={() => notify('QR Code da ficha exibido no protótipo.')}><QrCode size={18} /> QR Code</button></div></section>
    <div className="passport-tabs"><button className="active">Visão geral</button><button>Medidas</button><button>Operações</button><button>Qualidade</button><button>Anexos</button><button>Histórico</button></div>
    <div className="two-columns passport-grid"><section className="panel"><BlockTitle title="Identificação" /><div className="data-grid"><Info label="Cliente" value="MA Uniformes" /><Info label="Coleção" value="Corporativo 2026" /><Info label="Família" value="Uniformes" /><Info label="Grade" value="PP · P · M · G · GG · XG" /><Info label="Responsável técnico" value="Márcia Pedro" /><Info label="Tempo total" value="2,85 min/peça" /></div></section><section className="panel"><BlockTitle title="Tecido principal" /><div className="fabric-row"><span className="fabric-swatch" /><div><strong>Malha Piquet Azul Marinho</strong><span>50% algodão · 50% poliéster</span></div></div><div className="data-grid compact-data"><Info label="Gramatura" value="190 g/m²" /><Info label="Largura" value="1,80 m" /><Info label="Consumo" value="0,82 m/peça" /><Info label="Encolhimento máx." value="3%" /></div></section></div>
    <section className="panel"><div className="panel-head"><div><span className="section-kicker">Sequência operacional</span><h3>6 operações · 2,85 min</h3></div><button className="text-button" onClick={() => open('pop')}>Ver POPs <ChevronRight size={16} /></button></div><div className="table-wrap"><table><thead><tr><th>Nº</th><th>Operação</th><th>Máquina</th><th>Tempo padrão</th><th></th></tr></thead><tbody>{operations.map((row) => <tr key={row[0]}><td><span className="operation-number">{row[0]}</span></td><td><strong>{row[1]}</strong></td><td>{row[2]}</td><td>{row[3]}</td><td><ChevronRight size={17} /></td></tr>)}</tbody></table></div></section>
    <div className="two-columns"><section className="panel"><BlockTitle title="Pontos críticos de qualidade" /><ul className="check-list"><li><Check size={16} /> Gola centralizada e sem torção</li><li><Check size={16} /> Ombros simétricos</li><li><Check size={16} /> Bainha sem ondulação</li><li><Check size={16} /> Etiqueta alinhada ao centro costas</li></ul></section><section className="panel"><BlockTitle title="DNA do produto" /><div className="dna-box"><div className="dna-placeholder"><Sparkles size={30} /><span>Peça perfeita</span></div><div><span className="section-kicker">Nível de dificuldade</span><strong>Médio</strong><small>Máquina principal: Overloque 5 fios</small><button className="text-button" onClick={() => notify('Vídeo de montagem iniciado no protótipo.')}><PlayCircle size={17} /> Ver vídeo de montagem</button></div></div></section></div>
  </>
}

function Info({ label, value }: { label: string; value: string }) { return <div className="info"><span>{label}</span><strong>{value}</strong></div> }
function BlockTitle({ title }: { title: string }) { return <div className="block-title"><h3>{title}</h3></div> }

function Pop({ notify }: { notify: (message: string) => void }) {
  const [selected, setSelected] = useState(2)
  const pops = operations.map((o, i) => ({ n: o[0], name: o[1], machine: o[2], time: o[3], done: i < 5 }))
  return <>
    <PageIntro kicker="Módulo 4" title="Procedimentos Operacionais" text="Instruções visuais, regulagens, vídeos e critérios de qualidade por operação." action="Novo POP" onAction={() => notify('Editor de novo POP aberto no protótipo.')} />
    <div className="pop-layout"><aside className="pop-list">{pops.map((p, i) => <button key={p.n} className={selected === i ? 'active' : ''} onClick={() => setSelected(i)}><span>{p.n}</span><div><strong>{p.name}</strong><small>{p.machine}</small></div><ChevronRight size={17} /></button>)}</aside><section className="pop-document"><div className="pop-doc-head"><div><span className="section-kicker">POP · Operação {pops[selected].n}</span><h2>{pops[selected].name}</h2><p>Ref. UNI-2458 · Polo Masculina Manga Curta</p></div><Status text="Ativo · v4" tone="green" /></div><div className="video-placeholder" onClick={() => notify('Player de vídeo demonstrativo.')}><span><PlayCircle size={48} /></span><strong>Vídeo da operação</strong><small>Toque para reproduzir</small></div><div className="pop-facts"><Info label="Máquina" value={pops[selected].machine} /><Info label="Tempo padrão" value={pops[selected].time} /><Info label="Habilidade" value="Nível 2" /><Info label="Ponto" value="504 · Segurança" /></div><BlockTitle title="Passo a passo" />{['Posicionar as partes conforme gabarito', 'Alinhar bordas e iniciar costura', 'Manter margem constante durante a operação', 'Finalizar sem repuxar o tecido', 'Conferir padrão visual da peça'].map((step, i) => <div className="step-row" key={step}><span>{i + 1}</span><div><strong>{step}</strong><small>{i === 0 ? 'Confira direito com direito e marque o início.' : 'Seguir orientação visual definida pela engenharia.'}</small></div></div>)}</section></div>
  </>
}

function Carga() {
  const machines = [['Overloque 5 fios', '8', '94%', 'Gargalo'], ['Reta eletrônica', '6', '76%', 'Normal'], ['Galoneira', '4', '81%', 'Normal'], ['Botoneira', '2', '45%', 'Ociosa']]
  return <><PageIntro kicker="Módulo 5" title="Carga de Máquinas e M.O." text="Capacidade instalada, utilização, gargalos e distribuição da mão de obra." /><section className="stats-grid compact"><Stat icon={Wrench} label="Máquinas" value="20" meta="18 disponíveis" /><Stat icon={Users} label="Operadores" value="43" meta="40 presentes" /><Stat icon={TrendingUp} label="Utilização geral" value="82%" meta="+5% hoje" positive /><Stat icon={AlertTriangle} label="Gargalos" value="1" meta="Overloque 5 fios" /></section><div className="two-columns"><section className="panel"><BlockTitle title="Carga por tipo de máquina" />{machines.map((m) => <div className="capacity-row" key={m[0]}><div><strong>{m[0]}</strong><small>{m[1]} máquinas</small></div><div className="capacity-bar"><i style={{ width: m[2] }} /></div><strong>{m[2]}</strong><Status text={m[3]} tone={m[3] === 'Gargalo' ? 'red' : m[3] === 'Ociosa' ? 'slate' : 'green'} /></div>)}</section><section className="panel"><BlockTitle title="Equipe por turno" /><div className="shift-card"><span>Manhã</span><strong>24 operadores</strong><small>93% de eficiência</small><div className="progress"><i style={{ width: '93%' }} /></div></div><div className="shift-card"><span>Tarde</span><strong>19 operadores</strong><small>88% de eficiência</small><div className="progress"><i style={{ width: '88%' }} /></div></div><BlockTitle title="Ausências hoje" /><div className="empty-small"><Users size={22} /><span>3 ausências registradas · 2 substituídas</span></div></section></div></>
}

function Qualidade({ notify }: { notify: (message: string) => void }) {
  return <><PageIntro kicker="Módulo 6" title="Qualidade" text="Inspeções, defeitos, não conformidades e ações corretivas." action="Nova inspeção" onAction={() => notify('Formulário de inspeção aberto.')} /><section className="stats-grid compact"><Stat icon={ShieldCheck} label="Aprovação" value="96,8%" meta="últimos 30 dias" /><Stat icon={ClipboardCheck} label="Inspeções" value="28" meta="6 nesta semana" /><Stat icon={AlertTriangle} label="NC abertas" value="1" meta="ação vence hoje" /><Stat icon={TrendingUp} label="Retrabalho" value="2,1%" meta="-0,7% no mês" positive /></section><div className="two-columns"><section className="panel"><div className="panel-head"><div><span className="section-kicker">Inspeções recentes</span><h3>Últimos registros</h3></div></div>{[['OP-2026-0184','Processo · Pregar mangas','32 peças','Aprovado'],['OP-2026-0185','Final · Lote 04','50 peças','Reprovado'],['OP-2026-0182','Final · Lote completo','80 peças','Aprovado']].map((x) => <div className="inspection-row" key={x[0]+x[1]}><span className="inspection-icon"><ClipboardCheck size={19} /></span><div><strong>{x[0]}</strong><small>{x[1]} · {x[2]}</small></div><Status text={x[3]} tone={x[3] === 'Aprovado' ? 'green' : 'red'} /></div>)}</section><section className="panel"><div className="panel-head"><div><span className="section-kicker">Não conformidade</span><h3>NC-0041</h3></div><Status text="Em ação" tone="amber" /></div><div className="nc-highlight"><AlertTriangle size={22} /><div><strong>Bainha ondulada acima do limite</strong><span>OP-2026-0185 · Costura Nova Era</span></div></div><Info label="Causa raiz" value="Regulagem inadequada do diferencial da galoneira" /><Info label="Ação corretiva" value="Revisar regulagem e reinspecionar lote" /><div className="deadline"><CalendarDays size={17} /> Prazo: hoje, 17:00</div></section></div></>
}

function RealidadeAumentada({ notify }: { notify: (message: string) => void }) {
  return <><PageIntro kicker="Módulo 7 · Conceito" title="Consulta guiada por câmera" text="Escaneie um QR ou marcador para abrir informações da peça, máquina ou operação no ponto de trabalho." /><section className="scanner-card"><div className="scanner-frame"><span className="corner c1" /><span className="corner c2" /><span className="corner c3" /><span className="corner c4" /><ScanLine size={56} /></div><h3>Aponte a câmera para o QR da estação</h3><p>O protótipo simula a experiência. A câmera e RA completa entram em uma fase posterior.</p><button className="primary-button" onClick={() => notify('Leitura simulada: POP 30 · Pregar gola')}><ScanLine size={18} /> Simular leitura</button></section><section className="module-grid small-grid"><button className="module-card"><span className="module-icon cyan"><FileText size={21} /></span><span className="module-copy"><strong>Medidas da peça</strong><small>Sobreposição de medidas e tolerâncias</small></span></button><button className="module-card"><span className="module-icon orange"><Wrench size={21} /></span><span className="module-copy"><strong>Regulagem da máquina</strong><small>Parâmetros no ponto de uso</small></span></button><button className="module-card"><span className="module-icon green"><ShieldCheck size={21} /></span><span className="module-copy"><strong>Inspeção guiada</strong><small>Critérios críticos sobre a peça</small></span></button></section></>
}

function Busca({ open }: { open: (page: Page) => void }) {
  const [query, setQuery] = useState('UNI-2458')
  return <><PageIntro kicker="Módulo 8" title="Busca Avançada" text="Encontre qualquer documento, operação ou ordem de produção em poucos segundos." /><div className="big-search"><Search size={22} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite referência, produto, operação, máquina..." /><button>Buscar</button></div><div className="chips"><button className="active">Todos</button><button>Fichas</button><button>POPs</button><button>OPs</button><button>Vídeos</button></div>{query && <section className="search-results"><span className="section-kicker">Resultados para “{query}”</span><button className="search-result" onClick={() => open('ficha')}><span className="module-icon cyan"><FileText size={21} /></span><div><b>Ficha Técnica · UNI-2458</b><strong>Polo Masculina Manga Curta</strong><small>Versão 4 · Aprovada</small></div><ChevronRight /></button><button className="search-result" onClick={() => open('pop')}><span className="module-icon violet"><ClipboardCheck size={21} /></span><div><b>6 POPs encontrados</b><strong>Operações da UNI-2458</strong><small>Fechar ombros, preparar gola, pregar gola...</small></div><ChevronRight /></button><button className="search-result" onClick={() => open('ordens')}><span className="module-icon indigo"><PackageCheck size={21} /></span><div><b>Ordem de Produção</b><strong>OP-2026-0184</strong><small>1.200 peças · Em produção · 68%</small></div><ChevronRight /></button></section>}</>
}

function Favoritos({ open }: { open: (page: Page) => void }) {
  return <><PageIntro kicker="Módulo 9" title="Favoritos" text="Documentos e operações salvos para acesso rápido, inclusive em campo." /><section className="module-grid small-grid"><button className="module-card" onClick={() => open('ficha')}><span className="module-icon cyan"><FileText size={21} /></span><span className="module-copy"><strong>UNI-2458 · Polo Masculina</strong><small>Ficha Técnica · Versão 4</small></span><Star size={18} fill="currentColor" /></button><button className="module-card" onClick={() => open('pop')}><span className="module-icon violet"><ClipboardCheck size={21} /></span><span className="module-copy"><strong>POP 30 · Pregar gola</strong><small>Overloque 5 fios · 0,58 min</small></span><Star size={18} fill="currentColor" /></button><button className="module-card"><span className="module-icon orange"><PlayCircle size={21} /></span><span className="module-copy"><strong>Vídeo · Regulagem Galoneira</strong><small>Treinamento técnico · 03:42</small></span><Star size={18} fill="currentColor" /></button></section></>
}

function Atualizacoes() {
  const items = [['Hoje · 16:10','Ficha técnica revisada','UNI-2458 chegou à versão 4. Confira medidas e sequência operacional.','Versão revisada'],['Hoje · 10:25','Comunicado de qualidade','Atenção ao padrão de bainha da família Uniformes nesta semana.','Comunicado'],['Ontem · 15:40','Novo vídeo disponível','Regulagem rápida da Galoneira para malha piquet.','Novo vídeo'],['28 set · 09:10','POP aprovado','POP 30 · Pregar gola foi revisado e aprovado pela responsável técnica.','Documento']]
  return <><PageIntro kicker="Módulo 10" title="Atualizações" text="Novas versões, comunicados técnicos, vídeos e documentos importantes para a operação." /><section className="updates-list">{items.map((x, i) => <article className={`update-item ${i < 3 ? 'unread' : ''}`} key={x[1]}><span className="update-dot" /><div><span className="update-time">{x[0]} · {x[3]}</span><h3>{x[1]}</h3><p>{x[2]}</p></div>{i < 3 && <span className="new-badge">Novo</span>}</article>)}</section></>
}

function Pagamentos({ notify }: { notify: (message: string) => void }) {
  return <><PageIntro kicker="Apoio" title="Pagamentos" text="Fechamentos por oficina, período e ordens concluídas." action="Novo fechamento" onAction={() => notify('Novo fechamento iniciado no protótipo.')} /><section className="stats-grid compact"><Stat icon={CircleDollarSign} label="A pagar" value="R$ 18.420" meta="3 fechamentos" /><Stat icon={WalletCards} label="Em conferência" value="R$ 7.880" meta="1 oficina" /><Stat icon={Check} label="Pago no mês" value="R$ 42.610" meta="6 fechamentos" /><Stat icon={ShieldCheck} label="Descontos" value="R$ 480" meta="por não qualidade" /></section><section className="panel"><div className="table-wrap"><table><thead><tr><th>Oficina</th><th>Período</th><th>OPs</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody><tr><td><strong>Facção Horizonte</strong></td><td>16–30 set</td><td>3 OPs</td><td><strong>R$ 9.840,00</strong></td><td><Status text="Conferido" tone="blue" /></td><td><ChevronRight /></td></tr><tr><td><strong>Costura Nova Era</strong></td><td>16–30 set</td><td>2 OPs</td><td><strong>R$ 7.880,00</strong></td><td><Status text="Em conferência" tone="amber" /></td><td><ChevronRight /></td></tr><tr><td><strong>Ateliê União</strong></td><td>16–30 set</td><td>1 OP</td><td><strong>R$ 3.420,00</strong></td><td><Status text="Aberto" tone="slate" /></td><td><ChevronRight /></td></tr></tbody></table></div></section></>
}

function Admin({ notify }: { notify: (message: string) => void }) {
  return <><PageIntro kicker="Administração" title="Configurações da empresa" text="Usuários, perfis, parâmetros e dados de demonstração." /><section className="settings-grid"><Setting icon={Users} title="Usuários e permissões" text="6 usuários ativos · 5 perfis configurados" /><Setting icon={Factory} title="Dados da empresa" text="Processo Fácil Demo · Plano demonstração" /><Setting icon={ShieldCheck} title="Regras de qualidade" text="Limites, alertas e escalonamento" /><Setting icon={CircleDollarSign} title="Tabela de preços" text="Valores por peça e operação" /><Setting icon={Bell} title="Notificações" text="Públicos e comunicações internas" /><button className="setting-card" onClick={() => notify('Seed demonstrativo sinalizado para carga no Firebase.')}><span><Sparkles size={21} /></span><div><strong>Dados de demonstração</strong><small>Carregar ou restaurar exemplos do protótipo</small></div><ChevronRight size={18} /></button></section></>
}

function Setting({ icon: Icon, title, text }: { icon: typeof Factory; title: string; text: string }) { return <button className="setting-card"><span><Icon size={21} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={18} /></button> }

function Status({ text, tone }: { text: string; tone: string }) { return <span className={`status status-${tone}`}>{text}</span> }

function pageTitle(page: Page) {
  const names: Record<Page, string> = { home: 'Visão geral', oficinas: 'Oficinas', ordens: 'Ordens de Produção', ficha: 'Ficha Técnica', pop: 'POP', carga: 'Carga de Máquinas e M.O.', qualidade: 'Qualidade', ra: 'Realidade Aumentada', busca: 'Busca Avançada', favoritos: 'Favoritos', atualizacoes: 'Atualizações', pagamentos: 'Pagamentos', admin: 'Administração' }
  return names[page]
}

export default App

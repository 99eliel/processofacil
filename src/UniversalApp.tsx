import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, ChevronRight, FileText, HelpCircle, Home, Lock, ShieldAlert, X } from 'lucide-react'
import { useSystem } from './system/SystemProvider'
import TechnicalSheetsPage from './pages/TechnicalSheetsPage'
import PopPage from './pages/PopPage'
import { useLocation, useNavigate } from 'react-router-dom'
import './pop.css'
import { PROJECT_ROADMAP } from './domain/projectRoadmap'
import './remap.css'
import './production-upgrades.css'
import './diagnostics.css'
import './reports-upgrades.css'
import './time-studies.css'
import './easy-ux.css'
import './pcp-upgrades.css'
import './technical-bom-upgrades.css'
import './ficha-only.css'

/**
 * Etapa 1 do Processo Fácil.
 *
 * A Ficha Técnica é o único módulo acessível. Os demais módulos permanecem
 * versionados no repositório para reconstrução posterior, sem exclusão dos
 * registros já existentes no Firebase.
 */
export default function App() {
  const system = useSystem()
  const [toast, setToast] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [page, setPage] = useState<'home' | 'ficha' | 'pop'>('home')
  const [sheetVisited, setSheetVisited] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const focusId = location.pathname.startsWith('/pop/') ? location.pathname.slice(5) : ''
  useEffect(() => { if (location.pathname === '/pop' || location.pathname.startsWith('/pop/')) setPage('pop'); else if (location.pathname === '/ficha') { setSheetVisited(true); setPage('ficha') } else setPage('home') }, [location.pathname])
  const openPop = () => { setPage('pop'); navigate('/pop'); window.scrollTo(0, 0) }
  const openSheet = () => { setSheetVisited(true); setPage('ficha'); navigate('/ficha'); window.scrollTo(0, 0) }
  const openHome = () => { setPage('home'); navigate('/'); window.scrollTo(0, 0) }
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
  }, [])

  const notify = (message: string) => {
    setToast(message)
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(''), 4200)
  }

  return <div className={`app-shell pf-shell pf-ft-only-shell${page === 'home' ? ' pf-reference-home-shell' : ''}`}>
    <div className="pf-app-layout">
      {page !== 'home' && <header className="pf-global-header pf-ft-only-header">
        <button type="button" className="pf-brand pf-ft-only-brand pf-menu-brand-button" onClick={openHome} aria-label="Página inicial do Processo Fácil">
          <span className="pf-brand-symbol"><FileText size={22}/></span>
          <span>
            <strong>Processo Fácil</strong>
            <small>{system.activeCompany?.nomeFantasia || 'Gestão de processos'}</small>
          </span>
        </button>
        <div className="pf-ft-only-header-actions">
          <button type="button" className="pf-menu-home-link" onClick={openHome}><Home size={17}/> Início</button>
          <button type="button" className="pf-settings-link" onClick={() => setHelpOpen(true)}
            title="Ajuda da Ficha Técnica" aria-label="Ajuda da Ficha Técnica">
            <HelpCircle size={19}/>
          </button>
        </div>
      </header>}

      <main className={`pf-content pf-ft-only-content${page === 'home' ? ' pf-reference-content' : ''}`}>
        {page === 'home' && <section className="pf-reference-home" aria-labelledby="pf-module-home-title">
          <button type="button" className="pf-reference-help" onClick={() => setHelpOpen(true)} aria-label="Ajuda da Ficha Técnica" title="Ajuda"><HelpCircle size={21}/></button>
          <div className="pf-reference-heading">
            <div className="pf-reference-logo" aria-hidden="true">
              <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.8" opacity=".5"/>
                <path d="M26 67V29h19c12 0 15 18 0 18H26M53 67V29h25M53 47h19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>PROCESSOS</span>
            </div>
            <div className="pf-reference-brand">
              <h1 id="pf-module-home-title">PROCESSO<br/>FÁCIL</h1>
              <button type="button" className="pf-reference-enter" onClick={openSheet} aria-label="Abrir Ficha Técnica" title="Abrir Ficha Técnica"><ChevronRight size={25}/></button>
            </div>
          </div>
          <nav className="pf-reference-menu" aria-label="Módulos do Processo Fácil">
            {PROJECT_ROADMAP.map(stage => {
              const active = stage.status === 'atual'
              const next = stage.status === 'proxima'
              const status = active ? 'Disponível' : next ? 'Próximo módulo' : 'Em breve'
              return <button key={stage.id} type="button" disabled={!active}
                className={`pf-reference-item pf-reference-item-${stage.status}`}
                title={stage.title + ' — ' + status}
                aria-label={stage.title + ' — ' + status}
                onClick={active ? (stage.id === 'pop' ? openPop : openSheet) : undefined}>
                <span className="pf-reference-circle" aria-hidden="true">{active ? <Check size={29} strokeWidth={3.5}/> : <Lock size={18} strokeWidth={2}/>}</span>
                <span className="pf-reference-label">{stage.id === 'carga' ? 'Carga Máq. e M.O.' : stage.title}</span>
              </button>
            })}
          </nav>
          <p className="pf-reference-note">Ficha Técnica <span>·</span> POP disponíveis</p>
        </section>}
        {sheetVisited && <div hidden={page !== 'ficha'} className="pf-sheet-module">
          <button type="button" className="pf-module-back" onClick={openHome}><ArrowLeft size={17}/> Voltar aos módulos</button>
          <div className="pf-ft-only-intro">
            <div><span className="pf-ft-only-stage">MÓDULO 01</span><h1>Ficha Técnica</h1>
              <p>Cadastre e organize produtos, materiais, medidas, operações e revisões em um só lugar.</p></div>
          </div>
          <TechnicalSheetsPage notify={notify}/>
        </div>}
        {page === 'pop' && <><button type="button" className="pf-module-back" onClick={openHome}><ArrowLeft size={17}/> Voltar aos módulos</button><PopPage key={focusId || 'library'} notify={notify} focusId={focusId} onLinked={()=>setSheetVisited(false)}/></>}
      </main>
    </div>

    {helpOpen && <div className="pf-search-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setHelpOpen(false)
    }}>
      <section className="pf-search-dialog pf-help-dialog" role="dialog" aria-modal="true"
        aria-label="Como usar a Ficha Técnica">
        <div className="pf-search-input-row">
          <FileText size={20}/><strong>Como usar a Ficha Técnica</strong>
          <button type="button" onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda"><X size={19}/></button>
        </div>
        <div className="pf-help-content">
          <p>Ficha Técnica e POP são os módulos ativos nesta etapa. As demais funções serão reconstruídas posteriormente.</p>
          <ol>
            <li><strong>Criar:</strong> selecione um produto existente ou clique em Cadastrar novo produto. A primeira revisão será aberta automaticamente.</li>
            <li><strong>Preencher:</strong> informe materiais, medidas, dados de consumo, operações, fotos e instruções. Novos materiais podem ser cadastrados dentro da ficha.</li>
            <li><strong>Salvar:</strong> grave o rascunho antes de sair. Consulte o histórico para comparar revisões.</li>
            <li><strong>Publicar:</strong> use o fluxo de validação da própria Ficha Técnica para aprovar a versão.</li>
            <li><strong>Imprimir:</strong> abra a ficha e clique em Ficha para impressão / PDF.</li>
          </ol>
          <p className="pf-ft-only-security"><ShieldAlert size={16}/>
            O ambiente principal de testes ainda não possui autenticação individual segura. Não utilize dados confidenciais.</p>
          <button type="button" className="primary-button" onClick={() => setHelpOpen(false)}>Entendi</button>
        </div>
      </section>
    </div>}

    {toast && <div className="toast" role="status"><CheckCircle2 size={16}/>{toast}</div>}
  </div>
}

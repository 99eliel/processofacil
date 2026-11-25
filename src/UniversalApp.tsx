import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileText, HelpCircle, ShieldAlert, X } from 'lucide-react'
import { useSystem } from './system/SystemProvider'
import TechnicalSheetsPage from './pages/TechnicalSheetsPage'
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
  const [roadmapOpen, setRoadmapOpen] = useState(false)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
  }, [])

  const notify = (message: string) => {
    setToast(message)
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(''), 4200)
  }

  return <div className="app-shell pf-shell pf-ft-only-shell">
    <div className="pf-app-layout">
      <header className="pf-global-header pf-ft-only-header">
        <div className="pf-brand pf-ft-only-brand">
          <span className="pf-brand-symbol"><FileText size={22}/></span>
          <span>
            <strong>Processo Fácil</strong>
            <small>{system.activeCompany?.nomeFantasia || 'Ficha Técnica'}</small>
          </span>
        </div>
        <div className="pf-ft-only-header-actions">
          <span className="pf-ft-only-active-label"><CheckCircle2 size={15}/> Ficha Técnica</span>
          <button type="button" className="pf-settings-link" onClick={() => setHelpOpen(true)}
            title="Ajuda da Ficha Técnica" aria-label="Ajuda da Ficha Técnica">
            <HelpCircle size={19}/>
          </button>
        </div>
      </header>

      <main className="pf-content pf-ft-only-content">
        <div className="pf-ft-only-intro">
          <div>
            <span className="pf-ft-only-stage">ETAPA 1 · MÓDULO PRINCIPAL</span>
            <h1>Ficha Técnica</h1>
            <p>Cadastre e organize produtos, materiais, medidas, operações e revisões em um só lugar.</p>
          </div>
          <div className="pf-ft-only-state"><FileText size={19}/><span>Único módulo ativo</span></div>
        </div>

        <div className="pf-ft-roadmap-strip">
          <div className="pf-ft-roadmap-current"><strong>1 · Ficha Técnica</strong><small>Etapa atual</small></div>
          <span className="pf-ft-roadmap-separator" aria-hidden="true">→</span>
          <div className="pf-ft-roadmap-next"><strong>2 · POP</strong><small>Próximo módulo a construir juntos</small></div>
          <button type="button" onClick={() => setRoadmapOpen(true)}>Ver roteiro completo</button>
        </div>

        <TechnicalSheetsPage notify={notify}/>
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
          <p>A Ficha Técnica é a única parte ativa do Processo Fácil nesta etapa. As demais funções serão reconstruídas posteriormente.</p>
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

    {roadmapOpen && <div className="pf-search-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setRoadmapOpen(false)
    }}>
      <section className="pf-search-dialog pf-roadmap-dialog" role="dialog" aria-modal="true" aria-label="Roteiro oficial do Processo Fácil">
        <div className="pf-search-input-row">
          <FileText size={20}/><strong>Roteiro do Processo Fácil</strong>
          <button type="button" onClick={() => setRoadmapOpen(false)} aria-label="Fechar roteiro"><X size={19}/></button>
        </div>
        <div className="pf-roadmap-dialog-content">
          <p>Construiremos cada módulo por etapas. Por enquanto, só a Ficha Técnica está disponível.</p>
          <ol className="pf-roadmap-list">
            {PROJECT_ROADMAP.map((stage) => <li key={stage.id} className={`pf-roadmap-step pf-roadmap-step-${stage.status}`}>
              <span className="pf-roadmap-index">{PROJECT_ROADMAP.indexOf(stage) + 1}</span>
              <strong>{stage.title}</strong>
              {stage.status === 'atual' && <small>Etapa atual</small>}
              {stage.status === 'proxima' && <small>Próxima etapa</small>}
              {stage.status === 'planejada' && <small>Planejada</small>}
            </li>)}
          </ol>
          <p className="pf-roadmap-note">O POP será definido a partir das operações e instruções já registradas na Ficha Técnica, sem duplicar cadastros desnecessariamente.</p>
          <button type="button" className="primary-button" onClick={() => setRoadmapOpen(false)}>Voltar à Ficha Técnica</button>
        </div>
      </section>
    </div>}

    {toast && <div className="toast" role="status"><CheckCircle2 size={16}/>{toast}</div>}
  </div>
}

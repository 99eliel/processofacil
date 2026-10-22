import { AlertTriangle, Database, Loader2, RefreshCw } from 'lucide-react'
import { useSystem } from './SystemProvider'

export default function SystemGate({ children }: { children: React.ReactNode }) {
  const system = useSystem()

  if (system.loading) {
    return <div className="system-boot-screen">
      <div className="system-boot-card">
        <span className="boot-logo"><Database size={28} /></span>
        <strong>Preparando o Processo Fácil</strong>
        <p>Conectando ao Firestore e carregando o ambiente principal.</p>
        <Loader2 className="spin" size={22} />
      </div>
    </div>
  }

  if (system.error || !system.activeCompany) {
    return <div className="system-boot-screen">
      <div className="system-boot-card system-boot-error">
        <span className="boot-logo error"><AlertTriangle size={28} /></span>
        <strong>Não foi possível iniciar o ambiente</strong>
        <p>{system.error || 'O ambiente principal não foi encontrado.'}</p>
        <button onClick={() => system.refreshSystem()}><RefreshCw size={16} /> Tentar novamente</button>
        <small>Modo operacional temporário: autenticação desativada e workspace fixo “principal”.</small>
      </div>
    </div>
  }

  return <>{children}</>
}

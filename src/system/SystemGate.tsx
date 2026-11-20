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

  if (system.secureMode && !system.authenticated) {
    return <div className="system-boot-screen"><div className="system-boot-card">
      <span className="boot-logo"><Database size={28}/></span>
      <strong>Acesso ao Processo Fácil</strong>
      <p>Entre com sua conta Google cadastrada na empresa.</p>
      {system.error && <p className="form-error" role="alert">{system.error}</p>}
      <button onClick={() => void system.signInGoogle()}>Entrar com Google</button>
      <small>O acesso depende de um cadastro de membro ativo. Não existe cadastro público de administradores.</small>
    </div></div>
  }
  
  if (system.error || !system.activeCompany) {
    return <div className="system-boot-screen">
      <div className="system-boot-card system-boot-error">
        <span className="boot-logo error"><AlertTriangle size={28} /></span>
        <strong>Não foi possível iniciar o ambiente</strong>
        <p>{system.error || 'O ambiente principal não foi encontrado.'}</p>
        <button onClick={() => system.refreshSystem()}><RefreshCw size={16} /> Tentar novamente</button>
        {system.secureMode && <button onClick={() => void system.signOutUser()}>Sair e usar outra conta</button>}
        <small>{system.secureMode?'Acesso autorizado por membro e login Google.':'Modo operacional temporário: autenticação desativada e workspace principal aberto.'}</small>
      </div>
    </div>
  }

  return <>{children}</>
}

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Erro inesperado' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Processo Fácil — erro de interface', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return <div className="fatal-error-screen">
      <div className="fatal-error-card">
        <span><AlertTriangle size={28} /></span>
        <h1>O Processo Fácil encontrou um erro</h1>
        <p>A interface foi interrompida, mas seus dados não foram apagados. Atualize a aplicação para tentar novamente.</p>
        <code>{this.state.message}</code>
        <button onClick={() => window.location.reload()}><RefreshCw size={17} /> Recarregar sistema</button>
      </div>
    </div>
  }
}

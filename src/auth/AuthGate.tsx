import { useState, type FormEvent } from 'react'
import { Building2, CheckCircle2, KeyRound, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'register' | 'reset'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState({ nome: '', nomeFantasia: '', documento: '' })

  if (auth.loading) {
    return <div className="auth-screen"><div className="auth-loading"><Loader2 className="spin" size={28} /><strong>Carregando Processo Fácil...</strong></div></div>
  }

  if (!auth.user) {
    const submit = async (event: FormEvent) => {
      event.preventDefault()
      setBusy(true)
      setLocalError('')
      setMessage('')
      try {
        if (mode === 'login') await auth.login(email, password)
        if (mode === 'register') await auth.register(nome, email, password)
        if (mode === 'reset') {
          await auth.resetPassword(email)
          setMessage('E-mail de recuperação enviado. Confira sua caixa de entrada.')
          setMode('login')
        }
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : 'Não foi possível concluir.')
      } finally {
        setBusy(false)
      }
    }

    return <div className="auth-screen">
      <div className="auth-brand-panel">
        <div className="auth-brand-mark"><Building2 size={30} /></div>
        <span>PROCESSO FÁCIL</span>
        <h1>Um sistema. Vários processos. Cada empresa do seu jeito.</h1>
        <p>Padronização, fichas técnicas, produção, qualidade e fluxo de aprovação em uma base universal e multiempresa.</p>
        <div className="auth-benefits">
          <span><CheckCircle2 size={17} /> Dados isolados por empresa</span>
          <span><CheckCircle2 size={17} /> Módulos configuráveis</span>
          <span><CheckCircle2 size={17} /> Histórico e rastreabilidade</span>
        </div>
      </div>

      <div className="auth-card-wrap">
        <form className="auth-card" onSubmit={submit}>
          <div>
            <span className="section-kicker">{mode === 'login' ? 'Acesso' : mode === 'register' ? 'Nova conta' : 'Recuperação'}</span>
            <h2>{mode === 'login' ? 'Entrar no Processo Fácil' : mode === 'register' ? 'Criar sua conta' : 'Recuperar senha'}</h2>
            <p>{mode === 'login' ? 'Use seu e-mail e senha para acessar suas empresas.' : mode === 'register' ? 'Depois do cadastro você cria a primeira empresa.' : 'Enviaremos um link para redefinir sua senha.'}</p>
          </div>

          {mode === 'register' && <label className="form-field"><span>Seu nome</span><div><UserRound size={17} /><input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Nome completo" /></div></label>}
          <label className="form-field"><span>E-mail</span><div><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@empresa.com" /></div></label>
          {mode !== 'reset' && <label className="form-field"><span>Senha</span><div><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" /></div></label>}

          {(localError || auth.error) && <div className="form-error">{localError || auth.error}</div>}
          {message && <div className="form-success">{message}</div>}

          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar recuperação'}
          </button>

          <div className="auth-links">
            {mode !== 'login' && <button type="button" onClick={() => setMode('login')}>Voltar para login</button>}
            {mode === 'login' && <><button type="button" onClick={() => setMode('register')}>Criar conta</button><button type="button" onClick={() => setMode('reset')}>Esqueci minha senha</button></>}
          </div>
        </form>
      </div>
    </div>
  }

  if (!auth.activeCompany) {
    const create = async (event: FormEvent) => {
      event.preventDefault()
      setBusy(true)
      setLocalError('')
      try {
        await auth.createCompany(company)
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : 'Não foi possível criar a empresa.')
      } finally {
        setBusy(false)
      }
    }

    return <div className="auth-screen company-onboarding">
      <form className="auth-card onboarding-card" onSubmit={create}>
        <div className="auth-brand-mark"><Building2 size={28} /></div>
        <span className="section-kicker">Primeira configuração</span>
        <h2>Crie sua empresa</h2>
        <p>Ela será o primeiro ambiente isolado dentro do Processo Fácil. Você será o administrador inicial.</p>

        <label className="form-field"><span>Razão social / nome completo</span><div><Building2 size={17} /><input value={company.nome} onChange={(e) => setCompany({ ...company, nome: e.target.value })} required placeholder="Empresa Exemplo Ltda." /></div></label>
        <label className="form-field"><span>Nome fantasia</span><div><Building2 size={17} /><input value={company.nomeFantasia} onChange={(e) => setCompany({ ...company, nomeFantasia: e.target.value })} placeholder="Empresa Exemplo" /></div></label>
        <label className="form-field"><span>CNPJ / CPF (opcional)</span><div><Building2 size={17} /><input value={company.documento} onChange={(e) => setCompany({ ...company, documento: e.target.value })} placeholder="00.000.000/0001-00" /></div></label>

        {localError && <div className="form-error">{localError}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />} Criar empresa</button>
        <button className="text-button auth-logout" type="button" onClick={auth.logout}>Sair desta conta</button>
      </form>
    </div>
  }

  return <>{children}</>
}

import { useMemo } from 'react'
import {
  Bell,
  Boxes,
  ClipboardCheck,
  Factory,
  FileText,
  Heart,
  LayoutDashboard,
  PackageCheck,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Wrench,
} from 'lucide-react'

const modules = [
  { title: 'Oficinas', description: 'Facções, capacidade e desempenho', icon: Factory },
  { title: 'Ordens de Produção', description: 'Criar, distribuir e acompanhar OPs', icon: PackageCheck },
  { title: 'Ficha Técnica', description: 'Passaporte digital do produto', icon: FileText },
  { title: 'POP', description: 'Procedimentos, vídeos e operação', icon: ClipboardCheck },
  { title: 'Carga Máq. e M.O.', description: 'Capacidade, máquinas e operadores', icon: Wrench },
  { title: 'Qualidade', description: 'Inspeções e não conformidades', icon: ShieldCheck },
  { title: 'Realidade Aumentada', description: 'Consulta guiada em campo', icon: Sparkles },
  { title: 'Busca Avançada', description: 'Localize fichas, POPs e OPs', icon: Search },
  { title: 'Favoritos', description: 'Sua biblioteca de acesso rápido', icon: Heart },
  { title: 'Atualizações', description: 'Comunicados e novas versões', icon: Bell },
  { title: 'Pagamentos', description: 'Fechamento das facções', icon: WalletCards },
]

export default function App() {
  const today = useMemo(
    () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()),
    [],
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Boxes size={24} /></div>
          <div><strong>Processo Fácil</strong><span>Gestão de Produção</span></div>
        </div>

        <nav className="desktop-nav">
          <button className="nav-item active"><LayoutDashboard size={19} /> Início</button>
          <button className="nav-item"><Factory size={19} /> Oficinas</button>
          <button className="nav-item"><PackageCheck size={19} /> Produção</button>
          <button className="nav-item"><ShieldCheck size={19} /> Qualidade</button>
          <button className="nav-item"><Settings size={19} /> Administração</button>
        </nav>

        <div className="sidebar-footer">
          <span className="connection-dot" /> Online
          <small>Versão 0.1.0</small>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{today}</p>
            <h1>Visão geral</h1>
          </div>
          <button className="profile-button" aria-label="Perfil">EF</button>
        </header>

        <section className="hero-card">
          <div>
            <span className="hero-label">Processo Fácil</span>
            <h2>Produção organizada do início ao fim.</h2>
            <p>Ficha técnica, operação, qualidade e gestão das oficinas em um único lugar.</p>
          </div>
          <div className="hero-stat">
            <strong>11</strong>
            <span>módulos disponíveis</span>
          </div>
        </section>

        <section className="section-header">
          <div>
            <span className="section-kicker">Acesso rápido</span>
            <h3>Módulos do sistema</h3>
          </div>
        </section>

        <section className="module-grid">
          {modules.map(({ title, description, icon: Icon }) => (
            <button className="module-card" key={title} onClick={() => alert(`${title}: tela em construção na Fase 1.`)}>
              <span className="module-icon"><Icon size={22} /></span>
              <span className="module-copy">
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <span className="module-arrow">›</span>
            </button>
          ))}
        </section>
      </main>

      <nav className="bottom-nav">
        <button className="active"><LayoutDashboard size={20} /><span>Início</span></button>
        <button><PackageCheck size={20} /><span>OPs</span></button>
        <button><Search size={20} /><span>Buscar</span></button>
        <button><Bell size={20} /><span>Atualizações</span></button>
      </nav>
    </div>
  )
}

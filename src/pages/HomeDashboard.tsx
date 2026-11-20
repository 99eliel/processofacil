import { ArrowRight, AlertCircle, CalendarDays, CheckCircle2, ClipboardList, Factory, FileText, Lightbulb, PackagePlus, TrendingUp } from 'lucide-react'
import type { Material, Product, ProductionOrderRecord, TechnicalSheetSummary } from '../domain/types'
import type { ProductionBalance } from '../firebase/productionLedger'
import { orderProgress } from '../domain/progressEngine'

type Area = 'catalogo' | 'ordens' | 'planejamento' | 'producao' | 'gestao' | 'configuracoes'
type Props = {
  products: Product[]
  sheets: TechnicalSheetSummary[]
  materials: Material[]
  orders: ProductionOrderRecord[]
  balances: ProductionBalance[]
  navigate: (page: Area, opId?: string) => void
  createProduct: () => void
}
const nf = new Intl.NumberFormat('pt-BR')
const sections: { page: Area; title: string; description: string; icon: typeof FileText }[] = [
  { page: 'catalogo', title: 'Produtos e Fichas', description: 'Defina o que será fabricado', icon: FileText },
  { page: 'ordens', title: 'Ordens de Produção', description: 'Escolha produto, quantidade e necessidade', icon: ClipboardList },
  { page: 'planejamento', title: 'Planejamento', description: 'Organize equipe, máquina e capacidade', icon: CalendarDays },
  { page: 'producao', title: 'Produção', description: 'Registre as peças produzidas', icon: Factory },
  { page: 'gestao', title: 'Gestão e Relatórios', description: 'Veja resultados, defeitos e produtividade', icon: TrendingUp },
]
const statusText: Record<string, string> = {
  rascunho: 'Aguardando liberação', liberada: 'Pronta para produzir', em_fluxo: 'Em produção',
  reprovada: 'Atenção à qualidade', concluida: 'Concluída', cancelada: 'Cancelada',
}
function dateDisplay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split('-')
  return day + '/' + month + '/' + year
}
export default function HomeDashboard({ products, sheets, materials, orders, balances, navigate, createProduct }: Props) {
  const activeProducts = products.filter((p) => !p.excluido && p.status === 'ativo')
  const published = sheets.filter((s) => s.status === 'padrao')
  const visible = orders.filter((o) => !o.excluido && o.status !== 'cancelada')
  const active = visible.filter((o) => !['concluida', 'rascunho'].includes(o.status))
  const drafts = visible.filter((o) => o.status === 'rascunho')
  const today = new Date()
  const isoToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
  const overdue = active.filter((o) => o.prazo && /^\d{4}-\d{2}-\d{2}$/.test(o.prazo) && o.prazo < isoToday)
  const latest = [...visible].reverse().slice(0, 5)

  const guide = activeProducts.length === 0 ? {
    title: 'Comece cadastrando seu primeiro produto',
    body: 'A Ficha Técnica será a referência para as operações e para as Ordens de Produção.',
    action: 'Cadastrar produto',
    page: 'catalogo' as Area,
    create: true,
  } : published.length === 0 ? {
    title: 'Publique a Ficha Técnica de um produto',
    body: 'Assim você poderá criar OPs com operações, materiais e revisões corretamente vinculados.',
    action: 'Abrir Fichas Técnicas',
    page: 'catalogo' as Area,
    create: false,
  } : drafts.length ? {
    title: 'Você tem OPs aguardando liberação',
    body: 'Confira os itens e libere a OP. Isso preserva a revisão técnica utilizada na produção.',
    action: 'Liberar uma OP',
    page: 'ordens' as Area,
    create: false,
  } : active.length ? {
    title: 'Continue a produção que está em andamento',
    body: 'Registre as quantidades boas e defeituosas em cada operação e acompanhe o progresso.',
    action: 'Abrir Produção',
    page: 'producao' as Area,
    create: false,
  } : {
    title: 'Tudo pronto para criar uma Ordem de Produção',
    body: 'Você já tem uma Ficha Técnica publicada. Escolha o produto e informe a quantidade necessária.',
    action: 'Criar uma OP',
    page: 'ordens' as Area,
    create: false,
  }
  const guideAction = () => guide.create ? createProduct() : navigate(guide.page)

  return <div className="pf-easy-home">
    <section className="pf-easy-welcome">
      <div>
        <span className="pf-easy-eyebrow">VISÃO GERAL</span>
        <h1>Seu trabalho, em um só lugar.</h1>
        <p>O Processo Fácil organiza a produção do produto até o resultado final.</p>
      </div>
      <button className="pf-easy-welcome-action" onClick={guideAction}><PackagePlus size={18}/>{guide.action}<ArrowRight size={16}/></button>
    </section>

    <section className="pf-easy-guide" aria-label="Próximo passo recomendado">
      <div className="pf-easy-guide-icon"><Lightbulb size={24}/></div>
      <div className="pf-easy-guide-copy">
        <span>PRÓXIMO PASSO RECOMENDADO</span>
        <h2>{guide.title}</h2><p>{guide.body}</p>
      </div>
      <button className="primary-button" onClick={guideAction}>{guide.action}<ArrowRight size={16}/></button>
    </section>

    {overdue.length > 0 && <section className="pf-easy-warning" role="status">
      <AlertCircle size={19}/>
      <span><strong>{overdue.length} OP{overdue.length > 1 ? 's' : ''} com necessidade vencida.</strong> Confira as prioridades de produção.</span>
      <button onClick={() => navigate('ordens')}>Ver OPs <ArrowRight size={15}/></button>
    </section>}

    <section className="pf-easy-overview" aria-label="Resumo do sistema">
      <div><small>Produtos ativos</small><strong>{nf.format(activeProducts.length)}</strong><span>Produtos cadastrados</span></div>
      <div><small>Fichas publicadas</small><strong>{nf.format(published.length)}</strong><span>Prontas para gerar OP</span></div>
      <div><small>OPs em andamento</small><strong>{nf.format(active.length)}</strong><span>{drafts.length} aguardando liberação</span></div>
      <div><small>Materiais ativos</small><strong>{nf.format(materials.filter((m) => m.ativo).length)}</strong><span>Itens do catálogo</span></div>
    </section>

    <div className="pf-easy-columns">
      <section className="pf-easy-panel">
        <div className="pf-easy-section-title">
          <div><span>ACESSO RÁPIDO</span><h2>Áreas do sistema</h2></div>
        </div>
        <div className="pf-easy-module-grid">{sections.map(({ page, title, description, icon: Icon }, i) =>
          <button key={page} className="pf-easy-module" onClick={() => navigate(page)}>
            <span className="pf-easy-module-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="pf-easy-module-icon"><Icon size={21}/></span>
            <span className="pf-easy-module-text"><strong>{title}</strong><small>{description}</small></span>
            <ArrowRight size={17} className="pf-easy-module-arrow"/>
          </button>)}</div>
      </section>

      <section className="pf-easy-panel">
        <div className="pf-easy-section-title">
          <div><span>ACOMPANHAMENTO</span><h2>Ordens recentes</h2></div>
          <button onClick={() => navigate('ordens')}>Ver todas <ArrowRight size={14}/></button>
        </div>
        {latest.length === 0
          ? <div className="pf-easy-empty"><ClipboardList size={28}/><strong>Nenhuma OP cadastrada</strong>
            <p>Depois de criar uma OP, ela aparecerá aqui com seu progresso.</p>
            <button onClick={() => navigate('ordens')}>Ir para Ordens de Produção</button>
          </div>
          : <div className="pf-easy-recent-list">{latest.map((order) => {
            const progress = orderProgress(order, balances)
            return <button key={order.id} className="pf-easy-recent" onClick={() => navigate('ordens', order.id)}>
              <span className="pf-easy-recent-head"><strong>{order.numero}</strong><small>{statusText[order.status] ?? order.status}</small></span>
              <span className="pf-easy-recent-name">{order.itens.map((item) => item.produtoDescricao).filter(Boolean).join(' · ') || 'Produtos da OP'}</span>
              <span className="pf-easy-recent-progress"><span style={{ width: progress.percentage + '%' }}/></span>
              <span className="pf-easy-recent-foot"><small>{progress.finished} de {progress.planned} unidades finalizadas</small>
                <small>{order.prazo ? 'Necessidade: ' + dateDisplay(order.prazo) : 'Sem data definida'}</small></span>
            </button>
          })}</div>}
      </section>
    </div>
    <section className="pf-easy-foot" aria-label="Como o sistema funciona">
      <CheckCircle2 size={17}/><span>Fluxo simples: <strong>Ficha Técnica</strong> → <strong>OP</strong> → <strong>Planejamento</strong> → <strong>Produção</strong> → <strong>Relatório</strong>. O Planejamento é opcional para empresas pequenas.</span>
    </section>
  </div>
}

import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Play,
  Printer,
  Ruler,
  Shirt,
  Video,
  X,
} from 'lucide-react'
import type { Company, Material, Product, TechnicalRevision } from '../domain/types'

type Props = {
  revision: TechnicalRevision
  product?: Product
  company?: Company | null
  materials: Material[]
  responsibleName?: string
  onClose: () => void
}

function timestampDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') return toDate().toLocaleDateString('pt-BR')
  }
  return '—'
}

function statusText(status: TechnicalRevision['status']) {
  if (status === 'padrao') return 'APROVADA'
  if (status === 'em_validacao') return 'EM VALIDAÇÃO'
  if (status === 'obsoleta') return 'OBSOLETA'
  return 'RASCUNHO'
}

function difficultyLabel(value: 'facil' | 'medio' | 'dificil') {
  if (value === 'facil') return 'FÁCIL'
  if (value === 'dificil') return 'DIFÍCIL'
  return 'MÉDIO'
}

function placeholder(label: string) {
  return <div className="ft-doc-image-placeholder"><Shirt size={34} /><span>{label}</span></div>
}

function ProductImage({
  src,
  label,
  className = '',
}: {
  src?: string
  label: string
  className?: string
}) {
  return <div className={`ft-doc-product-image ${className}`}>
    <b>{label}</b>
    {src ? <img src={src} alt={label} /> : placeholder(label)}
  </div>
}

function QrVisual() {
  return <div className="ft-doc-qr" aria-label="QR Code de acesso rápido">
    {Array.from({ length: 81 }).map((_, index) => (
      <i key={index} className={(index * 17 + Math.floor(index / 9) * 7 + index % 5) % 4 !== 0 ? 'on' : ''} />
    ))}
  </div>
}

export default function TechnicalSheetPrintDocument({
  revision,
  product,
  company,
  materials,
  responsibleName,
  onClose,
}: Props) {
  const classifications = product?.classificacoes ?? {}
  const linkedMaterials = revision.bom
    .map((line) => ({
      line,
      material: materials.find((item) => item.id === line.materialId),
    }))

  const mainFabric = linkedMaterials.find(({ material }) => {
    const category = material?.categoria?.toLowerCase() ?? ''
    const description = material?.descricao?.toLowerCase() ?? ''
    return category.includes('tecido')
      || category.includes('malha')
      || description.includes('tecido')
      || description.includes('malha')
  }) ?? linkedMaterials[0]

  const notions = linkedMaterials
    .filter(({ line }) => line.id !== mainFabric?.line.id)
    .slice(0, 6)

  const machines = Array.from(new Map(
    revision.operacoes
      .filter((operation) => operation.maquina.trim())
      .map((operation) => [operation.maquina.trim(), operation]),
  ).values()).slice(0, 6)

  const machineAccessories = revision.operacoes
    .filter((operation) => operation.ferramenta.trim() || operation.regulagem.trim())
    .slice(0, 5)

  const needlesAndThreads = linkedMaterials
    .filter(({ material, line }) => {
      const text = `${material?.categoria ?? ''} ${line.descricaoSnapshot}`.toLowerCase()
      return text.includes('linha') || text.includes('agulha')
    })
    .slice(0, 5)

  const totalTime = revision.operacoes.reduce(
    (sum, operation) => sum + Number(operation.tempoPadraoMin ?? 0),
    0,
  )

  const difficultyRank = { facil: 1, medio: 2, dificil: 3 } as const
  const difficulty = revision.operacoes.reduce<'facil' | 'medio' | 'dificil'>(
    (current, operation) => difficultyRank[operation.dificuldade] > difficultyRank[current]
      ? operation.dificuldade
      : current,
    'facil',
  )

  const mainMachine = machines[0]?.maquina ?? '—'
  const primaryVideo = revision.operacoes
    .flatMap((operation) => operation.midias.map((media) => ({ operation, media })))
    .find(({ media }) => media.tipo === 'video')

  const criticalPoints = revision.operacoes
    .flatMap((operation) => operation.pontosCriticos)
    .filter(Boolean)
    .slice(0, 5)

  const images = [...revision.imagens].sort((a, b) => a.ordem - b.ordem)

  const print = () => {
    window.setTimeout(() => window.print(), 60)
  }

  return createPortal(
    <div className="ft-print-preview-overlay">
      <div className="ft-print-preview-toolbar">
        <div>
          <strong>Ficha Técnica · {revision.produtoCodigo}</strong>
          <span>Prévia A4 do documento oficial</span>
        </div>
        <div>
          <button onClick={onClose}><X size={17} /> Fechar</button>
          <button className="primary" onClick={print}><Printer size={17} /> Imprimir / Salvar PDF</button>
        </div>
      </div>

      <div className="technical-print-root">
        <article className="ft-document-sheet">
          <header className="ft-doc-header">
            <div className="ft-doc-brand">
              <div className="ft-doc-logo">
                {company?.logoUrl ? <img src={company.logoUrl} alt="" /> : <span>PF</span>}
              </div>
              <div>
                <h1>FICHA TÉCNICA</h1>
                <p>PASSAPORTE DIGITAL DO PRODUTO</p>
              </div>
            </div>
            <div className="ft-doc-meta">
              <div><span>REFERÊNCIA</span><strong>{revision.produtoCodigo}</strong></div>
              <div><span>VERSÃO</span><strong>{String(revision.numero).padStart(2, '0')}</strong></div>
              <div><span>DATA DE CRIAÇÃO</span><strong>{timestampDate(revision.aprovadoEm)}</strong></div>
              <div><span>STATUS</span><strong className={revision.status === 'padrao' ? 'approved' : ''}>{revision.status === 'padrao' && <CheckCircle2 size={10} />} {statusText(revision.status)}</strong></div>
            </div>
          </header>

          <section className="ft-doc-top-grid">
            <div className="ft-doc-visuals">
              <ProductImage src={images[0]?.url} label="FRENTE" className="front" />
              <ProductImage src={images[1]?.url} label="COSTAS" className="back" />
              <div className="ft-doc-detail-stack">
                <ProductImage src={images[2]?.url} label="DETALHES" />
                <ProductImage src={images[3]?.url} label="" />
              </div>
            </div>

            <div className="ft-doc-identity">
              <DocLine label="DESCRIÇÃO" value={revision.produtoDescricao} />
              <DocLine label="CLIENTE" value={company?.nomeFantasia || company?.nome || '—'} />
              <DocLine label="COLEÇÃO" value={classifications.colecao || classifications.linha || '—'} />
              <DocLine label="FAMÍLIA" value={classifications.familia || '—'} />
              <DocLine label="MODELO" value={classifications.modelo || '—'} />
              <DocLine label="GRADE" value={revision.tamanhos.join(' / ') || '—'} />
              <DocLine label="RESPONSÁVEL TÉCNICO" value={responsibleName || '—'} />
            </div>

            <div className="ft-doc-top-right">
              <DocBox title="DADOS DO TECIDO">
                <MiniTable rows={[
                  ['TECIDO PRINCIPAL', mainFabric?.line.descricaoSnapshot || '—'],
                  ['COMPOSIÇÃO', classifications.composicao || '—'],
                  ['GRAMATURA', classifications.gramatura || '—'],
                  ['LARGURA', classifications.largura || '—'],
                  ['FORNECEDOR', mainFabric?.line.fornecedorSnapshot || '—'],
                  ['COR', classifications.cor || mainFabric?.line.corFixa || '—'],
                  ['ENCOLHIMENTO MÁXIMO', classifications.encolhimento || '—'],
                  ['SOLIDEZ DA COR', classifications.solidez || '—'],
                ]} />
              </DocBox>
              <DocBox title="AVIAMENTOS">
                <table className="ft-doc-table compact">
                  <thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO</th><th>CONSUMO / PEÇA</th></tr></thead>
                  <tbody>
                    {notions.length > 0 ? notions.map(({ line }) => <tr key={line.id}><td>{line.codigoSnapshot}</td><td>{line.descricaoSnapshot}</td><td>{formatNumber(line.consumo)} {line.unidade}</td></tr>) : <tr><td colSpan={3}>—</td></tr>}
                  </tbody>
                </table>
              </DocBox>
            </div>
          </section>

          <section className="ft-doc-middle-grid">
            <DocBox title="TABELA DE MEDIDAS (cm)">
              <table className="ft-doc-table measures">
                <thead>
                  <tr><th>MEDIDA</th>{revision.tamanhos.slice(0, 6).map((size) => <th key={size}>{size}</th>)}</tr>
                </thead>
                <tbody>
                  {revision.medidas.slice(0, 6).map((row) => <tr key={row.id}><td>{row.ponto}</td>{revision.tamanhos.slice(0, 6).map((size) => <td key={size}>{row.valores.find((value) => value.tamanho === size)?.valor ?? '—'}</td>)}</tr>)}
                  {revision.medidas.length === 0 && <tr><td colSpan={Math.max(2, revision.tamanhos.slice(0, 6).length + 1)}>—</td></tr>}
                </tbody>
              </table>
            </DocBox>

            <DocBox title="DESENHO TÉCNICO">
              <div className="ft-doc-drawing">
                <div><Shirt strokeWidth={1} /><span>FRENTE</span></div>
                <div><Shirt strokeWidth={1} /><span>COSTAS</span></div>
              </div>
            </DocBox>

            <div className="ft-doc-right-stack">
              <DocBox title="ACESSÓRIOS DAS MÁQUINAS">
                <table className="ft-doc-table compact"><thead><tr><th>MÁQUINA</th><th>ACESSÓRIO</th></tr></thead><tbody>
                  {machineAccessories.length > 0 ? machineAccessories.map((operation) => <tr key={operation.id}><td>{operation.maquina || '—'}</td><td>{operation.ferramenta || operation.regulagem || '—'}</td></tr>) : <tr><td colSpan={2}>—</td></tr>}
                </tbody></table>
              </DocBox>
              <DocBox title="AGULHAS E LINHAS">
                <table className="ft-doc-table compact"><thead><tr><th>ITEM</th><th>ESPECIFICAÇÃO</th></tr></thead><tbody>
                  {needlesAndThreads.length > 0 ? needlesAndThreads.map(({ line }) => <tr key={line.id}><td>{line.codigoSnapshot}</td><td>{line.descricaoSnapshot}</td></tr>) : <tr><td colSpan={2}>—</td></tr>}
                </tbody></table>
              </DocBox>
            </div>
          </section>

          <section className="ft-doc-sequence-grid">
            <DocBox title="SEQUÊNCIA OPERACIONAL">
              <table className="ft-doc-table operations">
                <thead><tr><th>Nº</th><th>OPERAÇÃO</th><th>MÁQUINA</th><th>TEMPO PADRÃO (min)</th></tr></thead>
                <tbody>
                  {revision.operacoes.slice(0, 8).map((operation) => <tr key={operation.id}><td>{operation.codigo || operation.ordem * 10}</td><td>{operation.nome}</td><td>{operation.maquina || '—'}</td><td>{operation.tempoPadraoMin == null ? '—' : formatNumber(operation.tempoPadraoMin)}</td></tr>)}
                  {revision.operacoes.length === 0 && <tr><td colSpan={4}>—</td></tr>}
                </tbody>
                <tfoot><tr><td colSpan={3}>TEMPO TOTAL DA PEÇA</td><td>{formatNumber(totalTime)} min</td></tr></tfoot>
              </table>
            </DocBox>

            <DocBox title="MÁQUINAS NECESSÁRIAS">
              <table className="ft-doc-table compact"><thead><tr><th>OPERAÇÃO</th><th>MÁQUINA</th></tr></thead><tbody>
                {machines.length > 0 ? machines.map((operation) => <tr key={operation.id}><td>{operation.nome}</td><td>{operation.maquina}</td></tr>) : <tr><td colSpan={2}>—</td></tr>}
              </tbody></table>
            </DocBox>

            <div />
          </section>

          <section className="ft-doc-control-grid">
            <DocBox title="CONTROLE DE QUALIDADE">
              <div className="ft-doc-quality-columns">
                <div><strong>PONTOS CRÍTICOS DE CONTROLE</strong>
                  {(criticalPoints.length > 0 ? criticalPoints : revision.checklist.map((item) => item.descricao).slice(0, 5)).map((item) => <span className="ok" key={item}>✓ {item}</span>)}
                  {criticalPoints.length === 0 && revision.checklist.length === 0 && <span>—</span>}
                </div>
                <div><strong>DEFEITOS NÃO ACEITOS</strong>
                  {revision.checklist.slice(0, 5).map((item) => <span className="bad" key={item.id}>✕ {item.descricao}</span>)}
                  {revision.checklist.length === 0 && <span>—</span>}
                </div>
              </div>
            </DocBox>

            <DocBox title="PROCESSO DE CORTE">
              <MiniTable rows={[
                ['ENCAIXE', classifications.encaixe || '—'],
                ['CONSUMO DE TECIDO', mainFabric ? `${formatNumber(mainFabric.line.consumo)} ${mainFabric.line.unidade} / peça` : '—'],
                ['COMPRIMENTO DO RISCO', classifications.risco || '—'],
                ['ALTURA DO ENFESTO', classifications.enfesto || '—'],
                ['Nº DE FOLHAS', classifications.folhas || '—'],
                ['PERDAS (%)', mainFabric ? `${formatNumber(mainFabric.line.perdaPercentual)}%` : '—'],
              ]} />
            </DocBox>

            <DocBox title="ACESSO RÁPIDO">
              <div className="ft-doc-quick-access">
                <p>Aponte a câmera do celular para o QR Code e acesse todas as informações da peça.</p>
                <QrVisual />
              </div>
            </DocBox>
          </section>

          <DocBox title="ANEXOS">
            <div className="ft-doc-attachments">
              <Attachment icon={<FileText />} label="Molde PDF" active={false} />
              <Attachment icon={<Ruler />} label="Encaixe Audaces" active={false} />
              <Attachment icon={<Shirt />} label="Desenho Técnico" active={revision.imagens.length > 0} />
              <Attachment icon={<ClipboardCheck />} label="Procedimento Operacional (POP)" active={revision.operacoes.length > 0} />
              <Attachment icon={<Video />} label="Vídeo Operacional" active={Boolean(primaryVideo)} />
              <Attachment icon={<Ruler />} label="Relatório de Medidas" active={revision.medidas.length > 0} />
              <Attachment icon={<CheckCircle2 />} label="Aprovação do Cliente" active={revision.status === 'padrao'} />
            </div>
          </DocBox>

          <section className="ft-doc-dna">
            <div className="ft-doc-section-title">DNA DO PRODUTO <small>INFORMAÇÃO QUE GERA QUALIDADE E PRODUTIVIDADE</small></div>
            <div className="ft-doc-dna-grid">
              <div className="ft-doc-perfect">
                <strong>PEÇA PERFEITA</strong>
                {images[0]?.url ? <img src={images[0].url} alt="Peça perfeita" /> : placeholder('PEÇA')}
              </div>
              <div className="ft-doc-errors">
                <strong>PRINCIPAIS ERROS ENCONTRADOS</strong>
                {(revision.checklist.length > 0 ? revision.checklist.slice(0, 5).map((item) => item.descricao) : ['Sem critérios cadastrados']).map((item) => <span key={item}>✕ {item}</span>)}
              </div>
              <div className="ft-doc-video">
                <strong>VÍDEO DE MONTAGEM</strong>
                <div className="ft-doc-video-card">
                  <Play size={24} />
                  <span>{primaryVideo?.operation.nome || 'Vídeo operacional'}</span>
                </div>
              </div>
              <div className="ft-doc-dna-stats">
                <div><span>TEMPO PADRÃO</span><strong>{formatNumber(totalTime)} min</strong></div>
                <div><span>MÁQUINA PRINCIPAL</span><strong>{mainMachine}</strong></div>
              </div>
              <div className="ft-doc-difficulty">
                <strong>NÍVEL DE DIFICULDADE</strong>
                <div>
                  <span className={difficulty === 'facil' ? 'active easy' : 'easy'} />
                  <span className={difficulty === 'medio' ? 'active medium' : 'medium'} />
                  <span className={difficulty === 'dificil' ? 'active hard' : 'hard'} />
                </div>
                <small>{difficultyLabel(difficulty)}</small>
              </div>
            </div>
          </section>

          <footer className="ft-doc-footer">
            <span>Documento mestre orienta toda a produção. Manter sempre acessível no chão de fábrica.</span>
            <strong>Revisão: {timestampDate(revision.aprovadoEm)} · {responsibleName || company?.nomeFantasia || 'Processo Fácil'}</strong>
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  )
}

function DocBox({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="ft-doc-box">
    <div className="ft-doc-section-title">{title}</div>
    <div className="ft-doc-box-body">{children}</div>
  </section>
}

function DocLine({ label, value }: { label: string; value: string }) {
  return <div className="ft-doc-line"><span>{label}</span><strong>{value || '—'}</strong></div>
}

function MiniTable({ rows }: { rows: Array<[string, string]> }) {
  return <div className="ft-doc-mini-table">
    {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}
  </div>
}

function Attachment({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return <div className={`ft-doc-attachment ${active ? 'active' : ''}`}>
    <span>{icon}</span>
    <strong>{label}</strong>
  </div>
}

function formatNumber(value: number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

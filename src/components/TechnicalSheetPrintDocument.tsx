import { createPortal } from 'react-dom'
import { CheckCircle2, FileText, Printer, X } from 'lucide-react'
import type {
  BomLine, Company, Material, Product, TechnicalProductImage, TechnicalRevision,
} from '../domain/types'
import {
  buildConsumptionPrintRows,
  buildMaterialPrintDetails,
  formatMaterialConsumption,
} from '../domain/technicalPrintModel'

type Props = {
  revision: TechnicalRevision
  product?: Product
  company?: Company | null
  materials: Material[]
  responsibleName?: string
  onClose: () => void
}

type InfoRow = [label: string, value: string]

function displayDate(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString('pt-BR') : ''
  }
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? '' : value.toLocaleDateString('pt-BR')
  return ''
}

function statusLabel(status: TechnicalRevision['status']): string {
  if (status === 'padrao') return 'Aprovada'
  if (status === 'em_validacao') return 'Em validação'
  if (status === 'obsoleta') return 'Obsoleta'
  return 'Rascunho'
}

function difficultyLabel(level: string): string {
  return level === 'facil' ? 'Fácil' : level === 'medio' ? 'Médio' : level === 'dificil' ? 'Difícil' : level
}

function numberBR(value: number): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function findImage(
  images: TechnicalProductImage[],
  type: TechnicalProductImage['tipo'],
  oldPosition: number,
): TechnicalProductImage | undefined {
  const named = images.find((image) => image.tipo === type)
  return named ?? (images.every((image) => !image.tipo) ? images[oldPosition] : undefined)
}

function Section({ title, children, kind = '' }: {
  title: string; children: React.ReactNode; kind?: string
}) {
  return <section className={'pf-pdf-section ' + kind}>
    <h2 className="pf-pdf-section-title">{title}</h2>
    <div className="pf-pdf-section-body">{children}</div>
  </section>
}

function InfoRows({ rows }: { rows: InfoRow[] }) {
  return <dl className="pf-pdf-info-list">
    {rows.filter(([, value]) => Boolean(value?.trim())).map(([key, value]) =>
      <div className="pf-pdf-info-row" key={key}>
        <dt>{key}</dt>
        <dd>{value}</dd>
      </div>)}
  </dl>
}

function MaterialDetails({ line }: { line: BomLine }) {
  const details = buildMaterialPrintDetails(line)
  if (!details.length) return null
  return <tr className="pf-pdf-material-more">
    <td colSpan={4}>
      <div className="pf-pdf-material-tags">
        {details.map((detail) => <span key={detail.label}>
          <b>{detail.label}:</b> {detail.value}
        </span>)}
      </div>
    </td>
  </tr>
}

export default function TechnicalSheetPrintDocument({
  revision, company, onClose,
}: Props) {
  const images = [...(revision.imagens ?? [])].sort((a, b) => a.ordem - b.ordem)
  const photos = ([
    { label: 'Frente', image: findImage(images, 'frente', 0) },
    { label: 'Costas', image: findImage(images, 'costas', 1) },
    { label: 'Detalhe 1', image: findImage(images, 'detalhe_1', 2) },
    { label: 'Detalhe 2', image: findImage(images, 'detalhe_2', 3) },
  ]).filter(({ image }) => Boolean(image?.url))
  const perfectPhoto = findImage(images, 'peca_perfeita', 4)
  const orderedOperations = [...(revision.operacoes ?? [])].sort((a, b) => a.ordem - b.ordem)
  const fabric = revision.dadosTecido
  const identityRows: InfoRow[] = [
    ['Descrição', revision.produtoDescricao],
    ['Cliente', revision.cliente],
    ['Coleção', revision.colecao],
    ['Família', revision.familia],
    ['Modelo', revision.modelo],
    ['Grade', (revision.tamanhos ?? []).join(' / ')],
    ['Responsável técnico', revision.responsavelTecnico],
  ]
  const fabricRows: InfoRow[] = [
    ['Tecido principal', fabric.tecidoPrincipal],
    ['Composição', fabric.composicao],
    ['Gramatura', fabric.gramatura],
    ['Largura', fabric.largura],
    ['Rendimento', fabric.rendimento],
    ['Fornecedor', fabric.fornecedor],
    ['Cor', fabric.cor],
    ['Encolhimento máximo', fabric.encolhimentoMaximo],
    ['Solidez da cor', fabric.solidezCor],
  ]
  const consumptionRows = buildConsumptionPrintRows(revision.processoCorte) as InfoRow[]
  const materialLines = revision.blocos.bom ? (revision.bom ?? []) : []
  const measureRows = revision.blocos.medidas ? (revision.medidas ?? []) : []
  const checklist = revision.blocos.checklist ? (revision.checklist ?? []) : []
  const annexes = revision.anexos?.filter((a) => Boolean(a.url)) ?? []
  const drawing = annexes.find((a) => a.tipo === 'desenho')
  const totalTimeFromOperations = orderedOperations.reduce((sum, item) => sum + Number(item.tempoPadraoMin || 0), 0)
  const totalTime = revision.dnaProduto.tempoPadraoMin ??
    (totalTimeFromOperations > 0 ? totalTimeFromOperations : null)
  const hasDna = totalTime !== null || Boolean(revision.dnaProduto.nivelDificuldade) || Boolean(perfectPhoto?.url)
  const hasContent = photos.length > 0 || identityRows.some(([,v]) => v?.trim())
    || Boolean(revision.construcao?.trim()) || fabricRows.some(([,v]) => v?.trim())
    || consumptionRows.length > 0 || materialLines.length > 0 || measureRows.length > 0
    || orderedOperations.length > 0 || revision.agulhasLinhas.length > 0 || checklist.length > 0
    || annexes.length > 0 || hasDna

  const handlePrint = () => {
    const pending = [...document.querySelectorAll<HTMLImageElement>('.pf-pdf-overlay img')]
      .filter((img) => !img.complete)
      .map((img) => new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          img.removeEventListener('load', finish)
          img.removeEventListener('error', finish)
          resolve()
        }
        const timeout = setTimeout(finish, 3500)
        img.addEventListener('load', finish)
        img.addEventListener('error', finish)
        if (img.complete) finish()
      }))
    void Promise.all(pending).then(() => window.print())
  }

  return createPortal(
    <div className="pf-pdf-overlay">
      <div className="pf-pdf-toolbar">
        <div>
          <strong>Pré-visualização · Ficha Técnica</strong>
          <small>Texto maior, tabelas organizadas e páginas A4 automáticas.</small>
        </div>
        <div className="pf-pdf-toolbar-actions">
          <button type="button" onClick={onClose}><X size={17}/> Fechar</button>
          <button type="button" className="pf-pdf-print-button" onClick={handlePrint}>
            <Printer size={17}/> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <main className="pf-pdf-paper">
        <header className="pf-pdf-header">
          <div className="pf-pdf-logo">{company?.logoUrl
            ? <img src={company.logoUrl} alt="Logo da empresa"/>
            : <span>PF</span>}</div>
          <div className="pf-pdf-brand">
            <span>ENGENHARIA DE PRODUTO</span>
            <h1>Ficha Técnica</h1>
            <p>{revision.produtoDescricao || 'Especificação técnica do produto'}</p>
          </div>
          <div className="pf-pdf-meta">
            <div><small>REFERÊNCIA</small><strong>{revision.produtoCodigo}</strong></div>
            <div><small>REVISÃO</small><strong>{String(revision.numero).padStart(2,'0')}</strong></div>
            <div><small>STATUS</small><strong className={revision.status === 'padrao' ? 'pf-pdf-approved' : ''}>
              {revision.status === 'padrao' && <CheckCircle2 size={13}/>}
              {statusLabel(revision.status)}
            </strong></div>
            {displayDate(revision.aprovadoEm) && <div><small>APROVAÇÃO</small>
              <strong>{displayDate(revision.aprovadoEm)}</strong></div>}
          </div>
        </header>

        {!hasContent && <div className="pf-pdf-empty">
          <FileText size={30}/>
          <strong>Ficha Técnica sem dados cadastrados.</strong>
          <p>Preencha a ficha para gerar o documento.</p>
        </div>}

        {(photos.length > 0 || identityRows.some(([, value]) => value?.trim())) &&
          <div className={'pf-pdf-hero ' + (photos.length ? '' : 'pf-pdf-no-photos')}>
            {photos.length > 0 && <div className="pf-pdf-photo-grid">
              {photos.map(({label, image}) => <figure key={label}>
                <img src={image!.url} alt={label}/>
                <figcaption>{label}</figcaption>
              </figure>)}
            </div>}
            {identityRows.some(([, value]) => value?.trim()) &&
              <Section title="Identificação"><InfoRows rows={identityRows}/></Section>}
          </div>}

        {revision.construcao?.trim() && <Section title="Construção / processo">
          <p className="pf-pdf-paragraph">{revision.construcao}</p>
        </Section>}

        {(fabricRows.some(([,value]) => value?.trim()) || consumptionRows.length > 0) &&
          <div className="pf-pdf-pair">
            {fabricRows.some(([,value]) => value?.trim()) &&
              <Section title="Dados do tecido"><InfoRows rows={fabricRows}/></Section>}
            {consumptionRows.length > 0 &&
              <Section title="Dados de consumo"><InfoRows rows={consumptionRows}/></Section>}
          </div>}

        {materialLines.length > 0 && <Section title="Materiais do Produto" kind="pf-pdf-wide">
          <table className="pf-pdf-table pf-pdf-materials">
            <colgroup><col style={{width:'16%'}}/><col style={{width:'40%'}}/>
              <col style={{width:'25%'}}/><col style={{width:'19%'}}/></colgroup>
            <thead><tr><th>Código</th><th>Material</th><th>Fornecedor</th><th>Consumo / peça</th></tr></thead>
            {materialLines.map((line) => <tbody key={line.id} className="pf-pdf-material-group">
              <tr><td>{line.codigoSnapshot}</td><td><strong>{line.descricaoSnapshot}</strong></td>
                <td>{line.fornecedorSnapshot || '—'}</td>
                <td>{formatMaterialConsumption(line.consumo,line.unidade)}</td></tr>
              <MaterialDetails line={line}/>
            </tbody>)}
          </table>
        </Section>}

        {measureRows.length > 0 && <Section title="Tabela de medidas" kind="pf-pdf-wide">
          <table className={'pf-pdf-table pf-pdf-measurements '+((revision.tamanhos?.length ?? 0)>7?'pf-pdf-many-sizes':'')}>
            <thead><tr><th>Medida</th><th>Tolerância</th>
              {revision.tamanhos.map((size) => <th key={size}>{size}</th>)}</tr></thead>
            <tbody>{measureRows.map((row) => <tr key={row.id}>
              <td>{row.ponto}</td><td>± {numberBR(row.tolerancia)}</td>
              {revision.tamanhos.map((size) => <td key={size}>
                {row.valores.find((value)=>value.tamanho===size)?.valor ?? '—'}
              </td>)}
            </tr>)}</tbody>
          </table>
        </Section>}

        {drawing?.url && <Section title="Desenho técnico">
          <div className="pf-pdf-drawing">
            <img src={drawing.url} alt="Desenho técnico do produto"/>
          </div>
        </Section>}

        {hasDna && <Section title="DNA do produto">
          <div className="pf-pdf-dna">
            {totalTime !== null && <div><small>Tempo padrão total</small>
              <strong>{numberBR(totalTime)} min</strong></div>}
            {revision.dnaProduto.nivelDificuldade && <div>
              <small>Nível de dificuldade</small>
              <strong>{difficultyLabel(revision.dnaProduto.nivelDificuldade)}</strong>
            </div>}
            {perfectPhoto?.url && <div className="pf-pdf-perfect-photo"><small>Peça perfeita</small>
              <img src={perfectPhoto.url} alt="Imagem de referência de peça perfeita"/></div>}
          </div>
        </Section>}

        {annexes.length > 0 && <Section title="Anexos e referências">
          <ul className="pf-pdf-attachments">{annexes.map((annex) => <li key={annex.id}>
            <FileText size={13}/>
            <a href={annex.url} target="_blank" rel="noreferrer">{annex.nome}</a>
          </li>)}</ul>
        </Section>}


        {orderedOperations.length > 0 && <Section title="Operações de produção" kind="pf-pdf-wide">
          <table className="pf-pdf-table pf-pdf-operations">
            <colgroup><col style={{width:'6%'}}/><col style={{width:'26%'}}/>
              <col style={{width:'20%'}}/><col style={{width:'18%'}}/>
              <col style={{width:'21%'}}/><col style={{width:'9%'}}/></colgroup>
            <thead><tr><th>Nº</th><th>Operação</th><th>Máquina</th>
              <th>Acessório</th><th>Regulagem</th><th>Tempo</th></tr></thead>
            <tbody>{orderedOperations.map((operation) => <tr key={operation.id}>
              <td>{operation.codigo || operation.ordem * 10}</td>
              <td><strong>{operation.nome}</strong></td>
              <td>{operation.maquina || '—'}</td>
              <td>{operation.ferramenta || '—'}</td>
              <td>{operation.regulagem || '—'}</td>
              <td>{operation.tempoPadraoMin === null ? '—' :
                numberBR(operation.tempoPadraoMin) + ' min'}</td>
            </tr>)}</tbody>
            {totalTime !== null && <tfoot><tr>
              <td colSpan={5}>Tempo padrão total da peça</td>
              <td>{numberBR(totalTime)} min</td>
            </tr></tfoot>}
          </table>
        </Section>}

        {orderedOperations.some((item) =>
          Boolean(item.descricao?.trim()) || (item.midias ?? []).some((media) => media.url),
        ) && <Section title="Orientações e fotos das operações">
          <div className="pf-pdf-operations-details">
            {orderedOperations.filter((item) =>
              Boolean(item.descricao?.trim()) || (item.midias ?? []).some((media) => media.url),
            ).map((operation) => <article className="pf-pdf-operation-card" key={operation.id}>
              <div className="pf-pdf-operation-heading">
                <strong>{operation.codigo || operation.ordem * 10} · {operation.nome}</strong>
                {operation.dificuldade && <small>{difficultyLabel(operation.dificuldade)}</small>}
              </div>
              {operation.descricao?.trim() && <p>{operation.descricao}</p>}
              {(operation.midias ?? []).some((media) => media.url) &&
                <div className="pf-pdf-operation-media">
                  {operation.midias.filter((media) => media.url).map((media) =>
                    media.tipo === 'imagem' ? <figure key={media.id}>
                      <img src={media.url} alt={media.legenda || 'Foto da operação'}/>
                      <figcaption>{media.legenda || 'Foto da operação'}</figcaption>
                    </figure> : <div className="pf-pdf-video-link" key={media.id}>
                      <span>Vídeo de referência</span>
                      <a href={media.url} target="_blank" rel="noreferrer">
                        {media.legenda || 'Abrir vídeo'}
                      </a>
                    </div>,
                  )}
                </div>}
            </article>)}
          </div>
        </Section>}

        {revision.agulhasLinhas.length > 0 && <Section title="Agulhas, linhas e fios" kind="pf-pdf-wide">
          <table className="pf-pdf-table pf-pdf-needles">
            <thead><tr><th>Máquina</th><th>Agulha</th><th>Linha</th><th>Fio</th></tr></thead>
            <tbody>{revision.agulhasLinhas.map((item)=> <tr key={item.id}>
              <td>{item.maquina || '—'}</td><td>{item.agulha || '—'}</td>
              <td>{item.linha || '—'}</td><td>{item.fio || '—'}</td>
            </tr>)}</tbody>
          </table>
        </Section>}

        {checklist.length > 0 && <Section title="Checklist técnico" kind="pf-pdf-wide">
          <div className="pf-pdf-checklist">
            {checklist.map((item) => <div key={item.id}>
              <span>{item.descricao}</span>
              {item.obrigatorio && <small>Obrigatório</small>}
            </div>)}
          </div>
        </Section>}

        <footer className="pf-pdf-footer">
          <span>Processo Fácil · Ficha Técnica · {revision.produtoCodigo}</span>
          <strong>{revision.responsavelTecnico || company?.nomeFantasia || 'Documento técnico'}</strong>
        </footer>
      </main>
    </div>,
    document.body,
  )
}

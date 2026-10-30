import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  FileText,
  Play,
  Printer,
  QrCode,
  X,
} from 'lucide-react'
import type {
  Company,
  Material,
  Product,
  TechnicalProductImage,
  TechnicalRevision,
} from '../domain/types'

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
    const timestamp = value as { toDate?: () => Date }
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toLocaleDateString('pt-BR')
  }
  return ''
}

function statusText(status: TechnicalRevision['status']) {
  if (status === 'padrao') return 'APROVADA'
  if (status === 'em_validacao') return 'EM VALIDAÇÃO'
  if (status === 'obsoleta') return 'OBSOLETA'
  return 'RASCUNHO'
}

function difficultyLabel(value: '' | 'facil' | 'medio' | 'dificil') {
  if (value === 'facil') return 'FÁCIL'
  if (value === 'medio') return 'MÉDIO'
  if (value === 'dificil') return 'DIFÍCIL'
  return ''
}

function hasText(...values: Array<string | undefined | null>) {
  return values.some((value) => Boolean(value?.trim()))
}

function getPhoto(images: TechnicalProductImage[], type: TechnicalProductImage['tipo'], legacyIndex: number) {
  return images.find((image) => image.tipo === type) ?? images[legacyIndex]
}

function QrVisual() {
  return <div className="ft-flex-qr" aria-label="QR Code de acesso rápido">
    {Array.from({ length: 81 }).map((_, index) => (
      <i key={index} className={(index * 17 + Math.floor(index / 9) * 7 + index % 5) % 4 !== 0 ? 'on' : ''} />
    ))}
  </div>
}

export default function TechnicalSheetPrintDocument({
  revision,
  product: _product,
  company,
  materials,
  responsibleName,
  onClose,
}: Props) {
  const linkedMaterials = revision.bom.map((line) => ({
    line,
    material: materials.find((item) => item.id === line.materialId),
  }))

  const images = [...revision.imagens].sort((a, b) => a.ordem - b.ordem)
  const photos = [
    { label: 'FRENTE', image: getPhoto(images, 'frente', 0) },
    { label: 'COSTAS', image: getPhoto(images, 'costas', 1) },
    { label: 'DETALHE 1', image: getPhoto(images, 'detalhe_1', 2) },
    { label: 'DETALHE 2', image: getPhoto(images, 'detalhe_2', 3) },
  ].filter((item) => Boolean(item.image?.url))

  const perfectPhoto = getPhoto(images, 'peca_perfeita', 4)

  const machines = Array.from(new Map(
    revision.operacoes
      .filter((operation) => operation.maquina.trim())
      .map((operation) => [operation.maquina.trim(), operation]),
  ).values())

  const machineAccessories = revision.operacoes.filter(
    (operation) => hasText(operation.ferramenta, operation.regulagem),
  )

  const calculatedTime = revision.operacoes.reduce(
    (sum, operation) => sum + Number(operation.tempoPadraoMin ?? 0),
    0,
  )
  const totalTime = revision.dnaProduto.tempoPadraoMin ?? (calculatedTime > 0 ? calculatedTime : null)
  const mainMachine = revision.dnaProduto.maquinaPrincipal || machines[0]?.maquina || ''

  const primaryVideo = revision.operacoes
    .flatMap((operation) => operation.midias.map((media) => ({ operation, media })))
    .find(({ media }) => media.tipo === 'video')

  const technicalDrawing = revision.anexos.find((item) => item.tipo === 'desenho' && item.url)
  const activeAttachments = revision.anexos.filter((item) => item.url)

  const identityRows = [
    ['DESCRIÇÃO', revision.produtoDescricao],
    ['CLIENTE', revision.cliente],
    ['COLEÇÃO', revision.colecao],
    ['FAMÍLIA', revision.familia],
    ['MODELO', revision.modelo],
    ['GRADE', revision.tamanhos.join(' / ')],
    ['RESPONSÁVEL TÉCNICO', revision.responsavelTecnico],
  ].filter(([, value]) => hasText(value))

  const fabricRows = [
    ['TECIDO PRINCIPAL', revision.dadosTecido.tecidoPrincipal],
    ['COMPOSIÇÃO', revision.dadosTecido.composicao],
    ['GRAMATURA', revision.dadosTecido.gramatura],
    ['LARGURA', revision.dadosTecido.largura],
    ['FORNECEDOR', revision.dadosTecido.fornecedor],
    ['COR', revision.dadosTecido.cor],
    ['ENCOLHIMENTO MÁXIMO', revision.dadosTecido.encolhimentoMaximo],
    ['SOLIDEZ DA COR', revision.dadosTecido.solidezCor],
  ].filter(([, value]) => hasText(value))

  const cuttingRows = [
    ['ENCAIXE', revision.processoCorte.encaixe],
    ['CONSUMO DE TECIDO', revision.processoCorte.consumoTecido],
    ['COMPRIMENTO DO RISCO', revision.processoCorte.comprimentoRisco],
    ['ALTURA DO ENFESTO', revision.processoCorte.alturaEnfesto],
    ['Nº DE FOLHAS', revision.processoCorte.numeroFolhas],
    ['PERDAS (%)', revision.processoCorte.perdasPercentual],
  ].filter(([, value]) => hasText(value))

  const hasQuality = revision.controleQualidade.pontosCriticos.length > 0
    || revision.controleQualidade.defeitosNaoAceitos.length > 0

  const hasDna = Boolean(
    perfectPhoto?.url
    || primaryVideo
    || totalTime != null
    || mainMachine
    || revision.dnaProduto.principaisErros.length
    || activeAttachments.find((item) => item.tipo === 'video')
    || revision.dnaProduto.nivelDificuldade,
  )

  const contentBlocks = [
    photos.length > 0,
    identityRows.length > 0,
    fabricRows.length > 0,
    linkedMaterials.length > 0,
    revision.medidas.length > 0,
    Boolean(technicalDrawing?.url),
    revision.operacoes.length > 0,
    revision.agulhasLinhas.length > 0,
    hasQuality,
    cuttingRows.length > 0,
    activeAttachments.length > 0,
    hasDna,
  ].filter(Boolean).length

  const print = () => window.setTimeout(() => window.print(), 60)

  return createPortal(
    <div className="ft-print-preview-overlay">
      <div className="ft-print-preview-toolbar">
        <div>
          <strong>Ficha Técnica · {revision.produtoCodigo}</strong>
          <span>Documento montado somente com dados cadastrados</span>
        </div>
        <div>
          <button onClick={onClose}><X size={17} /> Fechar</button>
          <button className="primary" onClick={print}><Printer size={17} /> Imprimir / Salvar PDF</button>
        </div>
      </div>

      <div className="technical-print-root ft-flex-root">
        <article className="ft-flex-document">
          <header className="ft-flex-header">
            <div className="ft-flex-brand">
              <div className="ft-flex-logo">
                {company?.logoUrl ? <img src={company.logoUrl} alt="" /> : <span>PF</span>}
              </div>
              <div>
                <h1>FICHA TÉCNICA</h1>
                <p>PASSAPORTE DIGITAL DO PRODUTO</p>
              </div>
            </div>
            <div className="ft-flex-meta">
              <Meta label="REFERÊNCIA" value={revision.produtoCodigo} />
              <Meta label="VERSÃO" value={String(revision.numero).padStart(2, '0')} />
              {timestampDate(revision.aprovadoEm) && <Meta label="DATA" value={timestampDate(revision.aprovadoEm)} />}
              <Meta label="STATUS" value={statusText(revision.status)} approved={revision.status === 'padrao'} />
            </div>
          </header>

          {contentBlocks === 0 ? (
            <section className="ft-flex-empty">
              <FileText size={34} />
              <strong>Nenhum dado técnico foi cadastrado ainda.</strong>
              <span>Preencha o cadastro da peça para montar a Ficha Técnica.</span>
            </section>
          ) : <>
            {(photos.length > 0 || identityRows.length > 0) && (
              <section className="ft-flex-hero-grid">
                {photos.length > 0 && <div className="ft-flex-photo-grid">
                  {photos.map(({ label, image }) => <figure key={label}>
                    <figcaption>{label}</figcaption>
                    <img src={image!.url} alt={label} />
                  </figure>)}
                </div>}
                {identityRows.length > 0 && <DynamicBox title="IDENTIFICAÇÃO">
                  <KeyValueRows rows={identityRows} />
                </DynamicBox>}
              </section>
            )}

            {(fabricRows.length > 0 || linkedMaterials.length > 0) && (
              <section className="ft-flex-two">
                {fabricRows.length > 0 && <DynamicBox title="DADOS DO TECIDO">
                  <KeyValueRows rows={fabricRows} />
                </DynamicBox>}
                {linkedMaterials.length > 0 && <DynamicBox title="AVIAMENTOS E MATERIAIS">
                  <table className="ft-flex-table">
                    <thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO</th><th>FORNECEDOR</th><th>CONSUMO / PEÇA</th></tr></thead>
                    <tbody>{linkedMaterials.map(({ line }) => <tr key={line.id}>
                      <td>{line.codigoSnapshot}</td>
                      <td>{line.descricaoSnapshot}</td>
                      <td>{line.fornecedorSnapshot || ''}</td>
                      <td>{formatNumber(line.consumo)} {line.unidade}</td>
                    </tr>)}</tbody>
                  </table>
                </DynamicBox>}
              </section>
            )}

            {(revision.medidas.length > 0 || technicalDrawing?.url) && (
              <section className="ft-flex-two">
                {revision.medidas.length > 0 && <DynamicBox title="TABELA DE MEDIDAS">
                  <div className="ft-flex-table-scroll">
                    <table className="ft-flex-table centered">
                      <thead><tr><th>MEDIDA</th><th>TOL.</th>{revision.tamanhos.map((size) => <th key={size}>{size}</th>)}</tr></thead>
                      <tbody>{revision.medidas.map((row) => <tr key={row.id}>
                        <td>{row.ponto}</td>
                        <td>± {formatNumber(row.tolerancia)}</td>
                        {revision.tamanhos.map((size) => <td key={size}>{row.valores.find((value) => value.tamanho === size)?.valor ?? ''}</td>)}
                      </tr>)}</tbody>
                    </table>
                  </div>
                </DynamicBox>}
                {technicalDrawing?.url && <DynamicBox title="DESENHO TÉCNICO">
                  <div className="ft-flex-drawing"><img src={technicalDrawing.url} alt="Desenho técnico" /></div>
                </DynamicBox>}
              </section>
            )}

            {revision.operacoes.length > 0 && <>
              <DynamicBox title="SEQUÊNCIA OPERACIONAL">
                <table className="ft-flex-table">
                  <thead><tr><th>Nº</th><th>OPERAÇÃO</th><th>MÁQUINA</th><th>ACESSÓRIO</th><th>REGULAGEM</th><th>TEMPO</th></tr></thead>
                  <tbody>{revision.operacoes.map((operation) => <tr key={operation.id}>
                    <td>{operation.codigo || operation.ordem * 10}</td>
                    <td>{operation.nome}</td>
                    <td>{operation.maquina}</td>
                    <td>{operation.ferramenta}</td>
                    <td>{operation.regulagem}</td>
                    <td>{operation.tempoPadraoMin == null ? '' : `${formatNumber(operation.tempoPadraoMin)} min`}</td>
                  </tr>)}</tbody>
                  {totalTime != null && <tfoot><tr><td colSpan={5}>TEMPO TOTAL DA PEÇA</td><td>{formatNumber(totalTime)} min</td></tr></tfoot>}
                </table>
              </DynamicBox>

              <section className="ft-flex-two">
                {machines.length > 0 && <DynamicBox title="MÁQUINAS NECESSÁRIAS">
                  <table className="ft-flex-table"><thead><tr><th>OPERAÇÃO</th><th>MÁQUINA</th></tr></thead><tbody>
                    {machines.map((operation) => <tr key={operation.id}><td>{operation.nome}</td><td>{operation.maquina}</td></tr>)}
                  </tbody></table>
                </DynamicBox>}
                {machineAccessories.length > 0 && <DynamicBox title="ACESSÓRIOS / REGULAGENS">
                  <table className="ft-flex-table"><thead><tr><th>MÁQUINA</th><th>ACESSÓRIO</th><th>REGULAGEM</th></tr></thead><tbody>
                    {machineAccessories.map((operation) => <tr key={operation.id}><td>{operation.maquina}</td><td>{operation.ferramenta}</td><td>{operation.regulagem}</td></tr>)}
                  </tbody></table>
                </DynamicBox>}
              </section>
            </>}

            {revision.agulhasLinhas.length > 0 && <DynamicBox title="AGULHAS E LINHAS">
              <table className="ft-flex-table"><thead><tr><th>MÁQUINA</th><th>AGULHA</th><th>LINHA</th></tr></thead><tbody>
                {revision.agulhasLinhas.map((item) => <tr key={item.id}><td>{item.maquina}</td><td>{item.agulha}</td><td>{item.linha}</td></tr>)}
              </tbody></table>
            </DynamicBox>}

            {(hasQuality || cuttingRows.length > 0) && <section className="ft-flex-two">
              {hasQuality && <DynamicBox title="CONTROLE DE QUALIDADE">
                <div className="ft-flex-quality">
                  {revision.controleQualidade.pontosCriticos.length > 0 && <div>
                    <strong>PONTOS CRÍTICOS DE CONTROLE</strong>
                    {revision.controleQualidade.pontosCriticos.map((item) => <span className="ok" key={item}>✓ {item}</span>)}
                  </div>}
                  {revision.controleQualidade.defeitosNaoAceitos.length > 0 && <div>
                    <strong>DEFEITOS NÃO ACEITOS</strong>
                    {revision.controleQualidade.defeitosNaoAceitos.map((item) => <span className="bad" key={item}>✕ {item}</span>)}
                  </div>}
                </div>
              </DynamicBox>}
              {cuttingRows.length > 0 && <DynamicBox title="PROCESSO DE CORTE">
                <KeyValueRows rows={cuttingRows} />
              </DynamicBox>}
            </section>}

            <section className="ft-flex-two">
              <DynamicBox title="ACESSO RÁPIDO">
                <div className="ft-flex-quick"><QrCode size={20} /><p>QR de acesso ao Passaporte Digital.</p><QrVisual /></div>
              </DynamicBox>
              {activeAttachments.length > 0 && <DynamicBox title="ANEXOS">
                <div className="ft-flex-attachments">
                  {activeAttachments.map((attachment) => <div key={attachment.id}>
                    <FileText size={18} />
                    <strong>{attachment.nome}</strong>
                  </div>)}
                </div>
              </DynamicBox>}
            </section>

            {hasDna && <section className="ft-flex-dna">
              <div className="ft-flex-section-title">DNA DO PRODUTO <small>INFORMAÇÃO QUE GERA QUALIDADE E PRODUTIVIDADE</small></div>
              <div className="ft-flex-dna-grid">
                {perfectPhoto?.url && <div><strong>PEÇA PERFEITA</strong><img src={perfectPhoto.url} alt="Peça perfeita" /></div>}
                {revision.dnaProduto.principaisErros.length > 0 && <div className="errors"><strong>PRINCIPAIS ERROS</strong>{revision.dnaProduto.principaisErros.map((item) => <span key={item}>✕ {item}</span>)}</div>}
                {primaryVideo && <div><strong>VÍDEO DE MONTAGEM</strong><div className="ft-flex-video"><Play size={22} /><span>{primaryVideo.operation.nome}</span></div></div>}
                {(totalTime != null || mainMachine) && <div className="stats">
                  {totalTime != null && <p><span>TEMPO PADRÃO</span><b>{formatNumber(totalTime)} min</b></p>}
                  {mainMachine && <p><span>MÁQUINA PRINCIPAL</span><b>{mainMachine}</b></p>}
                </div>}
                {revision.dnaProduto.nivelDificuldade && <div className="difficulty">
                  <strong>NÍVEL DE DIFICULDADE</strong>
                  <b>{difficultyLabel(revision.dnaProduto.nivelDificuldade)}</b>
                </div>}
              </div>
            </section>}
          </>}

          <footer className="ft-flex-footer">
            <span>Documento mestre do Processo Fácil.</span>
            <strong>{revision.responsavelTecnico || company?.nomeFantasia || 'Processo Fácil'}</strong>
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  )
}

function Meta({ label, value, approved = false }: { label: string; value: string; approved?: boolean }) {
  return <div><span>{label}</span><strong className={approved ? 'approved' : ''}>{approved && <CheckCircle2 size={10} />} {value}</strong></div>
}

function DynamicBox({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="ft-flex-box">
    <div className="ft-flex-section-title">{title}</div>
    <div className="ft-flex-box-body">{children}</div>
  </section>
}

function KeyValueRows({ rows }: { rows: string[][] }) {
  return <div className="ft-flex-kv">
    {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
  </div>
}

function formatNumber(value: number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

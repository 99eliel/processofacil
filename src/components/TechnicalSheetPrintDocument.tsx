import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  FileText,
  Play,
  Printer,
  X,
} from 'lucide-react'
import type {
  Company,
  Material,
  Product,
  TechnicalProductImage,
  TechnicalRevision,
} from '../domain/types'
import { buildConsumptionPrintRows, buildMaterialPrintDetails } from '../domain/technicalPrintModel'

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

export default function TechnicalSheetPrintDocument({
  revision,
  product: _product,
  company,
  materials,
  responsibleName,
  onClose,
}: Props) {
  const linkedMaterials = (revision.blocos.bom ? revision.bom : []).map((line) => ({
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

  const orderedOperations = [...revision.operacoes].sort((a,b)=>a.ordem-b.ordem)
  const machines = orderedOperations.filter((operation) => operation.maquina.trim())
  const machineAccessories = orderedOperations.filter(
    (operation) => hasText(operation.ferramenta, operation.regulagem),
  )

  const calculatedTime = orderedOperations.reduce(
    (sum, operation) => sum + Number(operation.tempoPadraoMin ?? 0),
    0,
  )
  const totalTime = revision.dnaProduto.tempoPadraoMin ?? (calculatedTime > 0 ? calculatedTime : null)

  const primaryVideo = orderedOperations
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
    ['RENDIMENTO', revision.dadosTecido.rendimento],
    ['FORNECEDOR', revision.dadosTecido.fornecedor],
    ['COR', revision.dadosTecido.cor],
    ['ENCOLHIMENTO MÁXIMO', revision.dadosTecido.encolhimentoMaximo],
    ['SOLIDEZ DA COR', revision.dadosTecido.solidezCor],
  ].filter(([, value]) => hasText(value))

  const cuttingRows = buildConsumptionPrintRows(revision.processoCorte)
  const printChecklist = revision.blocos.checklist ? revision.checklist : []
  const operationDetails = orderedOperations.filter((operation) =>
    Boolean(operation.descricao?.trim()) || (operation.midias ?? []).some((media)=>Boolean(media.url)) || Boolean(operation.dificuldade),
  )

  const hasDna = Boolean(
    perfectPhoto?.url
    || primaryVideo
    || totalTime != null
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
    Boolean(revision.construcao?.trim()),
    printChecklist.length > 0,
    cuttingRows.length > 0,
    activeAttachments.length > 0,
    hasDna,
  ].filter(Boolean).length

  const hasSecondPage = Boolean(
    revision.operacoes.length > 0
    || revision.agulhasLinhas.length > 0
    || printChecklist.length > 0
    || cuttingRows.length > 0
    || activeAttachments.length > 0
    || hasDna,
  )

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
          <div className={`ft-print-page ft-print-page-one ${hasSecondPage ? 'has-next' : ''}`}>
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

              {revision.construcao?.trim() && <DynamicBox title="CONSTRUÇÃO / PROCESSO" allowSplit>
                <p className="ft-flex-long-text">{revision.construcao}</p>
              </DynamicBox>}

              {(fabricRows.length > 0 || linkedMaterials.length > 0) && (
                <section className="ft-flex-two">
                  {fabricRows.length > 0 && <DynamicBox title="DADOS DO TECIDO">
                    <KeyValueRows rows={fabricRows} />
                  </DynamicBox>}
                  {linkedMaterials.length > 0 && <DynamicBox title="MATERIAIS DO PRODUTO" allowSplit>
                    <table className="ft-flex-table ft-materials-table">
                      <thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO</th><th>FORNECEDOR</th><th>CONSUMO / PEÇA</th></tr></thead>
                      <tbody>{linkedMaterials.map(({line}) => <Fragment key={line.id}>
                        <tr>
                          <td>{line.codigoSnapshot}</td>
                          <td>{line.descricaoSnapshot}</td>
                          <td>{line.fornecedorSnapshot || '—'}</td>
                          <td>{formatNumber(line.consumo)} {line.unidade}</td>
                        </tr>
                        <tr className="ft-material-details-row"><td colSpan={4}>
                          <div className="ft-material-details">
                            {buildMaterialPrintDetails(line).map((detail)=><span key={detail.label}>
                              <b>{detail.label}</b> {detail.value}
                            </span>)}
                          </div>
                        </td></tr>
                      </Fragment>)}</tbody>
                    </table>
                  </DynamicBox>}
                </section>
              )}

              {(revision.medidas.length > 0 || technicalDrawing?.url) && (
                <section className="ft-flex-two ft-print-page-one-bottom">
                  {revision.medidas.length > 0 && <DynamicBox title="TABELA DE MEDIDAS">
                    <div className="ft-flex-table-scroll">
                      <table className="ft-flex-table ft-measures-table centered">
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
            </>}

            {!hasSecondPage && <footer className="ft-flex-footer">
              <span>Documento mestre do Processo Fácil.</span>
              <strong>{revision.responsavelTecnico || company?.nomeFantasia || 'Processo Fácil'}</strong>
            </footer>}
          </div>

          {hasSecondPage && <div className="ft-print-page ft-print-page-two">
            <div className="ft-print-continuation-header">
              <div>
                <strong>FICHA TÉCNICA · CONTINUAÇÃO</strong>
                <span>{revision.produtoDescricao}</span>
              </div>
              <div>
                <span>REFERÊNCIA</span><strong>{revision.produtoCodigo}</strong>
                <span>REV.</span><strong>{String(revision.numero).padStart(2, '0')}</strong>
              </div>
            </div>

            {orderedOperations.length > 0 && <>
              <DynamicBox title="SEQUÊNCIA OPERACIONAL">
                <table className="ft-flex-table ft-operations-table">
                  <thead><tr><th>Nº</th><th>OPERAÇÃO</th><th>MÁQUINA</th><th>ACESSÓRIO</th><th>REGULAGEM</th><th>TEMPO</th></tr></thead>
                  <tbody>{orderedOperations.map((operation) => <tr key={operation.id}>
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

              {operationDetails.length > 0 && <DynamicBox title="INSTRUÇÕES DAS OPERAÇÕES" allowSplit>
                <div className="ft-flex-operation-instructions">
                  {operationDetails.map((operation) => <div className="ft-flex-instruction-item" key={operation.id}>
                    <div className="ft-flex-instruction-title">
                      <strong>{operation.codigo || operation.ordem * 10} · {operation.nome}</strong>
                      {operation.dificuldade && <span>Dificuldade: {difficultyLabel(operation.dificuldade)}</span>}
                    </div>
                    {operation.descricao?.trim() && <p>{operation.descricao}</p>}
                    {(operation.midias ?? []).some((media) => media.url) && <div className="ft-flex-operation-media">
                      {operation.midias.filter((media) => media.url).map((media) =>
                        media.tipo === 'imagem'
                          ? <figure key={media.id}>
                              <img src={media.url} alt={media.legenda || 'Foto da operação'}/>
                              <figcaption>{media.legenda || 'Foto de referência'}</figcaption>
                            </figure>
                          : <a key={media.id} href={media.url} target="_blank" rel="noreferrer">
                              Vídeo: {media.legenda || 'Abrir referência da operação'}</a>,
                      )}
                    </div>}
                  </div>)}
                </div>
              </DynamicBox>

              <section className="ft-flex-two">
                {machines.length > 0 && <DynamicBox title="MÁQUINAS POR OPERAÇÃO">
                  <table className="ft-flex-table ft-machines-table"><thead><tr><th>OPERAÇÃO</th><th>MÁQUINA</th></tr></thead><tbody>
                    {machines.map((operation) => <tr key={operation.id}><td>{operation.nome}</td><td>{operation.maquina}</td></tr>)}
                  </tbody></table>
                </DynamicBox>}
                {machineAccessories.length > 0 && <DynamicBox title="ACESSÓRIOS / REGULAGENS">
                  <table className="ft-flex-table ft-accessories-table"><thead><tr><th>MÁQUINA</th><th>ACESSÓRIO</th><th>REGULAGEM</th></tr></thead><tbody>
                    {machineAccessories.map((operation) => <tr key={operation.id}><td>{operation.maquina}</td><td>{operation.ferramenta}</td><td>{operation.regulagem}</td></tr>)}
                  </tbody></table>
                </DynamicBox>}
              </section>
            </>}

            {revision.agulhasLinhas.length > 0 && <DynamicBox title="AGULHAS, LINHAS E FIOS">
              <table className="ft-flex-table ft-needles-table"><thead><tr><th>MÁQUINA</th><th>AGULHA</th><th>LINHA</th><th>FIO</th></tr></thead><tbody>
                {revision.agulhasLinhas.map((item) => <tr key={item.id}><td>{item.maquina}</td><td>{item.agulha}</td><td>{item.linha}</td><td>{item.fio ?? ''}</td></tr>)}
              </tbody></table>
            </DynamicBox>}

            {cuttingRows.length > 0 && <section className="ft-flex-two">
              <DynamicBox title="DADOS DE CONSUMO">
                <KeyValueRows rows={cuttingRows} />
              </DynamicBox>
            </section>}

            {printChecklist.length > 0 && <DynamicBox title="CHECKLIST TÉCNICO" allowSplit>
              <div className="ft-flex-checklist">
                {printChecklist.map((item) => <div key={item.id}>
                  <span>{item.descricao}</span>{item.obrigatorio && <small>Obrigatório</small>}
                </div>)}
              </div>
            </DynamicBox>}

            {activeAttachments.length > 0 && <DynamicBox title="ANEXOS" allowSplit>
              <div className="ft-flex-attachments">
                {activeAttachments.map((attachment) => <div key={attachment.id}>
                  <FileText size={18}/>
                  {attachment.url ? <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.nome}</a>
                    : <strong>{attachment.nome}</strong>}
                </div>)}
              </div>
            </DynamicBox>

            {hasDna && <section className="ft-flex-dna">
              <div className="ft-flex-section-title">DNA DO PRODUTO <small>INFORMAÇÃO QUE GERA QUALIDADE E PRODUTIVIDADE</small></div>
              <div className="ft-flex-dna-grid">
                {perfectPhoto?.url && <div><strong>PEÇA PERFEITA</strong><img src={perfectPhoto.url} alt="Peça perfeita" /></div>}
                {primaryVideo && <div><strong>VÍDEO DE MONTAGEM</strong><div className="ft-flex-video"><Play size={22}/><span>{primaryVideo.operation.nome}</span><a href={primaryVideo.media.url} target="_blank" rel="noreferrer">Abrir vídeo original</a></div></div>}
                {totalTime != null && <div className="stats">
                  <p><span>TEMPO PADRÃO</span><b>{formatNumber(totalTime)} min</b></p>
                </div>}
                {revision.dnaProduto.nivelDificuldade && <div className="difficulty">
                  <strong>NÍVEL DE DIFICULDADE</strong>
                  <b>{difficultyLabel(revision.dnaProduto.nivelDificuldade)}</b>
                </div>}
              </div>
            </section>}

            <footer className="ft-flex-footer">
              <span>Documento mestre do Processo Fácil.</span>
              <strong>{revision.responsavelTecnico || company?.nomeFantasia || 'Processo Fácil'}</strong>
            </footer>
          </div>}
        </article>
      </div>
    </div>,
    document.body,
  )
}

function Meta({ label, value, approved = false }: { label: string; value: string; approved?: boolean }) {
  return <div><span>{label}</span><strong className={approved ? 'approved' : ''}>{approved && <CheckCircle2 size={10} />} {value}</strong></div>
}

function DynamicBox({ title, children, allowSplit = false }: {
  title: string; children: React.ReactNode; allowSplit?: boolean
}) {
  return <section className={`ft-flex-box${allowSplit ? ' ft-flex-allow-split' : ''}`}>
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

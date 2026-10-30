import { useMemo, useState } from 'react'
import {
  Boxes,
  CheckCircle2,
  Factory,
  FileText,
  ImagePlus,
  Loader2,
  Paperclip,
  Scissors,
  Wrench,
  MonitorPlay,
  PackageCheck,
  Plus,
  Ruler,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { createMaterial } from '../firebase/catalogRepository'
import { createProduct } from '../firebase/productRepository'
import {
  openOrCreateTechnicalDraft,
  publishTechnicalRevision,
  saveTechnicalDraft,
  submitTechnicalRevision,
} from '../firebase/technicalSheetRepository'
import {
  createProductionOrder,
  releaseProductionOrder,
} from '../firebase/productionOrderRepository'
import {
  uploadOperationMedia,
  uploadTechnicalAttachment,
  uploadTechnicalSheetImage,
} from '../firebase/storageRepository'
import type {
  BomLine,
  Material,
  MeasurementRow,
  Product,
  ProductionVariant,
  TechnicalChecklistItem,
  TechnicalOperation,
  TechnicalRevision,
} from '../domain/types'

type Props = {
  notify: (message: string) => void
  openOperator: () => void
  openPassport: () => void
}

type MaterialDraft = {
  id: string
  origem: 'existente' | 'novo'
  materialId: string
  codigo: string
  descricao: string
  unidade: string
  consumo: number
  perdaPercentual: number
}

type MeasurementDraft = {
  id: string
  ponto: string
  tolerancia: number
  valores: Record<string, number | ''>
}

type AttachmentDraft = {
  tipo: 'molde' | 'encaixe' | 'desenho' | 'pop' | 'video' | 'relatorio_medidas' | 'aprovacao_cliente'
  nome: string
  file: File | null
}

type NeedleThreadDraft = {
  id: string
  maquina: string
  agulha: string
  linha: string
}

type OperationDraft = {
  id: string
  codigo: string
  nome: string
  descricao: string
  maquina: string
  tempoPadraoMin: number | ''
  ferramenta: string
  regulagem: string
  dificuldade: 'facil' | 'medio' | 'dificil'
  pontosCriticos: string
  instrucoes: string
  mediaFile: File | null
}

function parseSizes(value: string) {
  return Array.from(new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  ))
}

function createEmptyMaterial(): MaterialDraft {
  return {
    id: crypto.randomUUID(),
    origem: 'novo',
    materialId: '',
    codigo: '',
    descricao: '',
    unidade: 'un',
    consumo: 1,
    perdaPercentual: 0,
  }
}

function createEmptyMeasurement(sizes: string[]): MeasurementDraft {
  return {
    id: crypto.randomUUID(),
    ponto: '',
    tolerancia: 0.5,
    valores: Object.fromEntries(sizes.map((size) => [size, ''])),
  }
}

function createEmptyOperation(order: number): OperationDraft {
  return {
    id: crypto.randomUUID(),
    codigo: String(order * 10),
    nome: '',
    descricao: '',
    maquina: '',
    tempoPadraoMin: '',
    ferramenta: '',
    regulagem: '',
    dificuldade: 'medio',
    pontosCriticos: '',
    instrucoes: '',
    mediaFile: null,
  }
}

function exampleOperations(): OperationDraft[] {
  return [
    {
      ...createEmptyOperation(1),
      codigo: '10',
      nome: 'Preparar peça',
      descricao: 'Separar componentes e conferir referências antes da montagem.',
      maquina: 'Bancada',
      tempoPadraoMin: 0.3,
      dificuldade: 'facil',
      instrucoes: 'Separar todos os componentes\nConferir orientação e marcações\nLiberar para montagem',
      pontosCriticos: 'Componentes corretos\nOrientação correta',
    },
    {
      ...createEmptyOperation(2),
      codigo: '20',
      nome: 'Montagem principal',
      descricao: 'Executar a montagem principal mantendo alinhamento e padrão visual.',
      maquina: 'Máquina principal',
      tempoPadraoMin: 0.7,
      dificuldade: 'medio',
      instrucoes: 'Posicionar componentes\nExecutar montagem\nConferir uniformidade',
      pontosCriticos: 'Alinhamento\nAcabamento uniforme',
    },
    {
      ...createEmptyOperation(3),
      codigo: '30',
      nome: 'Acabamento',
      descricao: 'Realizar acabamento final e eliminar imperfeições.',
      maquina: 'Estação de acabamento',
      tempoPadraoMin: 0.5,
      dificuldade: 'medio',
      instrucoes: 'Finalizar bordas\nRemover excessos\nComparar com referência',
      pontosCriticos: 'Sem resíduos\nAcabamento regular',
    },
    {
      ...createEmptyOperation(4),
      codigo: '40',
      nome: 'Conferência final',
      descricao: 'Conferir visualmente a peça antes de liberar.',
      maquina: 'Bancada de inspeção',
      tempoPadraoMin: 0.25,
      dificuldade: 'facil',
      instrucoes: 'Conferir aparência geral\nValidar pontos críticos\nLiberar se conforme',
      pontosCriticos: 'Sem defeitos aparentes\nProduto conforme padrão',
    },
  ]
}

export default function GuidedPieceFlowPage({
  notify,
  openOperator,
  openPassport,
}: Props) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: existingMaterials } = useTenantCollection<Material>(
    empresaId,
    'materiais',
    'descricao',
  )

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ codigo: string; numeroOp?: string } | null>(null)

  const [piece, setPiece] = useState({
    descricao: '',
    codigo: '',
    cliente: '',
    colecao: '',
    familia: '',
    modelo: '',
    cor: '',
    responsavelTecnico: '',
    tamanhos: 'P, M, G, GG',
    construcao: '',
  })

  const sizes = useMemo(() => parseSizes(piece.tamanhos), [piece.tamanhos])

  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [fabric, setFabric] = useState({
    tecidoPrincipal: '',
    composicao: '',
    gramatura: '',
    largura: '',
    fornecedor: '',
    cor: '',
    encolhimentoMaximo: '',
    solidezCor: '',
  })
  const [cutting, setCutting] = useState({
    encaixe: '',
    consumoTecido: '',
    comprimentoRisco: '',
    alturaEnfesto: '',
    numeroFolhas: '',
    perdasPercentual: '',
  })
  const [needleThreads, setNeedleThreads] = useState<NeedleThreadDraft[]>([
    { id: crypto.randomUUID(), maquina: '', agulha: '', linha: '' },
  ])
  const [qualityCritical, setQualityCritical] = useState<string[]>([''])
  const [qualityDefects, setQualityDefects] = useState<string[]>([''])
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([
    { tipo: 'molde', nome: 'Molde PDF', file: null },
    { tipo: 'encaixe', nome: 'Encaixe Audaces', file: null },
    { tipo: 'desenho', nome: 'Desenho Técnico', file: null },
    { tipo: 'pop', nome: 'Procedimento Operacional (POP)', file: null },
    { tipo: 'video', nome: 'Vídeo Operacional', file: null },
    { tipo: 'relatorio_medidas', nome: 'Relatório de Medidas', file: null },
    { tipo: 'aprovacao_cliente', nome: 'Aprovação do Cliente', file: null },
  ])
  const [dna, setDna] = useState({
    tempoPadraoMin: '',
    maquinaPrincipal: '',
    nivelDificuldade: 'medio' as 'facil' | 'medio' | 'dificil',
    principaisErros: '',
  })
  const [materials, setMaterials] = useState<MaterialDraft[]>([createEmptyMaterial()])
  const [measurements, setMeasurements] = useState<MeasurementDraft[]>([])
  const [operations, setOperations] = useState<OperationDraft[]>([createEmptyOperation(1)])
  const [qualityItems, setQualityItems] = useState<string[]>([''])
  const [production, setProduction] = useState({
    criarOp: true,
    cor: '',
    prazo: '',
  })
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const totalPieces = sizes.reduce((sum, size) => sum + Number(quantities[size] ?? 0), 0)
  const completedSections = [
    Boolean(piece.descricao.trim() && sizes.length > 0 && piece.construcao.trim()),
    imageFiles.length > 0,
    Boolean(fabric.tecidoPrincipal.trim()),
    materials.some((item) => item.origem === 'existente' ? item.materialId : item.descricao.trim()),
    measurements.length > 0,
    operations.some((item) => item.nome.trim() && item.descricao.trim()),
    needleThreads.some((item) => item.maquina.trim() || item.agulha.trim() || item.linha.trim()),
    qualityCritical.some((item) => item.trim()) || qualityDefects.some((item) => item.trim()),
    Boolean(cutting.encaixe.trim() || cutting.consumoTecido.trim()),
    attachments.some((item) => item.file),
    Boolean(dna.maquinaPrincipal.trim() || dna.tempoPadraoMin || dna.principaisErros.trim()),
    !production.criarOp || totalPieces > 0,
  ].filter(Boolean).length

  const ensureMeasurementSizes = (nextSizes: string[]) => {
    setMeasurements((current) => current.map((row) => ({
      ...row,
      valores: Object.fromEntries(
        nextSizes.map((size) => [size, row.valores[size] ?? '']),
      ),
    })))
    setQuantities((current) => Object.fromEntries(
      nextSizes.map((size) => [size, current[size] ?? 0]),
    ))
  }

  const updateSizes = (value: string) => {
    setPiece((current) => ({ ...current, tamanhos: value }))
    ensureMeasurementSizes(parseSizes(value))
  }

  const addMaterial = () => setMaterials((current) => [...current, createEmptyMaterial()])
  const addMeasurement = () => setMeasurements((current) => [...current, createEmptyMeasurement(sizes)])
  const addOperation = () => setOperations((current) => [...current, createEmptyOperation(current.length + 1)])

  const validate = () => {
    if (!piece.descricao.trim()) return 'Informe o nome da peça.'
    if (sizes.length === 0) return 'Informe ao menos um tamanho ou variante.'
    if (!piece.construcao.trim()) return 'Descreva como a peça é construída.'
    if (!operations.some((item) => item.nome.trim() && item.descricao.trim())) {
      return 'Cadastre ao menos uma operação com nome e instrução.'
    }
    if (materials.some((item) => {
      if (item.origem === 'existente') return !item.materialId
      return Boolean(item.descricao.trim()) && (!item.unidade.trim() || Number(item.consumo) <= 0)
    })) {
      return 'Revise os materiais: consumo deve ser maior que zero e a unidade precisa estar preenchida.'
    }
    if (measurements.some((row) => !row.ponto.trim())) {
      return 'Preencha o nome de todos os pontos de medida.'
    }
    if (production.criarOp && totalPieces <= 0) {
      return 'Informe a quantidade da primeira Ordem de Produção ou desmarque a criação automática da OP.'
    }
    return ''
  }

  const submit = async () => {
    if (!empresaId || !user) return
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    setBusy(true)
    setError('')
    setSuccess(null)

    try {
      const generatedCode = piece.codigo.trim().toUpperCase()
        || `PEC-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(Date.now()).slice(-3)}`

      await createProduct(empresaId, user.uid, {
        codigo: generatedCode,
        descricao: piece.descricao,
        classificacoes: {
          cliente: piece.cliente.trim(),
          colecao: piece.colecao.trim(),
          familia: piece.familia.trim(),
          modelo: piece.modelo.trim(),
          cor: piece.cor.trim(),
          tamanhos: sizes.join(', '),
        },
      })

      const product: Product = {
        id: generatedCode,
        codigo: generatedCode,
        descricao: piece.descricao.trim(),
        classificacoes: {
          cliente: piece.cliente.trim(),
          colecao: piece.colecao.trim(),
          familia: piece.familia.trim(),
          modelo: piece.modelo.trim(),
          cor: piece.cor.trim(),
          tamanhos: sizes.join(', '),
        },
        status: 'ativo',
      }

      const revision = await openOrCreateTechnicalDraft(empresaId, user.uid, product)

      const bom: BomLine[] = []
      for (let index = 0; index < materials.length; index += 1) {
        const row = materials[index]
        if (row.origem === 'existente') {
          if (!row.materialId) continue
          const material = existingMaterials.find((item) => item.id === row.materialId)
          if (!material) continue
          bom.push({
            id: crypto.randomUUID(),
            materialId: material.id,
            codigoSnapshot: material.codigo,
            descricaoSnapshot: material.descricao,
            fornecedorSnapshot: '',
            corRegra: 'nao_aplica',
            consumo: Number(row.consumo || 1),
            consumoPorTamanho: {},
            unidade: material.unidade,
            perdaPercentual: Number(row.perdaPercentual || 0),
            observacao: '',
          })
          continue
        }

        if (!row.descricao.trim()) continue
        const materialCode = row.codigo.trim().toUpperCase()
          || `${generatedCode}-MAT-${String(index + 1).padStart(2, '0')}`
        const materialId = await createMaterial(empresaId, user.uid, {
          codigo: materialCode,
          codigoLegado: '',
          descricao: row.descricao,
          categoriaId: '',
          categoria: 'Material da peça',
          unidade: row.unidade || 'un',
          fornecedores: [],
          custoUnitario: null,
          leadTimeDias: null,
          loteMinimo: null,
          observacao: `Criado durante o cadastro da peça ${generatedCode}`,
        })
        bom.push({
          id: crypto.randomUUID(),
          materialId,
          codigoSnapshot: materialCode,
          descricaoSnapshot: row.descricao.trim(),
          fornecedorSnapshot: '',
          corRegra: 'nao_aplica',
          consumo: Number(row.consumo || 1),
          consumoPorTamanho: {},
          unidade: row.unidade || 'un',
          perdaPercentual: Number(row.perdaPercentual || 0),
          observacao: '',
        })
      }

      const measurementRows: MeasurementRow[] = measurements.map((row) => ({
        id: row.id,
        ponto: row.ponto.trim(),
        tolerancia: Number(row.tolerancia || 0),
        valores: sizes.map((size) => ({
          tamanho: size,
          valor: row.valores[size] === '' ? null : Number(row.valores[size]),
        })),
      }))

      const checklist: TechnicalChecklistItem[] = qualityCritical
        .map((item) => item.trim())
        .filter(Boolean)
        .map((descricao) => ({
          id: crypto.randomUUID(),
          descricao,
          obrigatorio: true,
        }))

      const technicalOperations: TechnicalOperation[] = operations
        .filter((item) => item.nome.trim() && item.descricao.trim())
        .map((item, index) => ({
          id: item.id,
          ordem: index + 1,
          codigo: item.codigo.trim() || String((index + 1) * 10),
          nome: item.nome.trim(),
          descricao: item.descricao.trim(),
          maquina: item.maquina.trim(),
          regulagem: item.regulagem.trim(),
          ferramenta: item.ferramenta.trim(),
          tempoPadraoMin: item.tempoPadraoMin === '' ? null : Number(item.tempoPadraoMin),
          dificuldade: item.dificuldade,
          pontosCriticos: item.pontosCriticos
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
          instrucoes: item.instrucoes
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
          midias: [],
        }))

      let draft: TechnicalRevision = {
        ...revision,
        construcao: piece.construcao.trim(),
        cliente: piece.cliente.trim(),
        colecao: piece.colecao.trim(),
        familia: piece.familia.trim(),
        modelo: piece.modelo.trim(),
        responsavelTecnico: piece.responsavelTecnico.trim(),
        dadosTecido: { ...fabric, cor: fabric.cor.trim() || piece.cor.trim() },
        processoCorte: cutting,
        agulhasLinhas: needleThreads
          .filter((item) => item.maquina.trim() || item.agulha.trim() || item.linha.trim())
          .map((item) => ({ ...item })),
        controleQualidade: {
          pontosCriticos: qualityCritical.map((item) => item.trim()).filter(Boolean),
          defeitosNaoAceitos: qualityDefects.map((item) => item.trim()).filter(Boolean),
        },
        anexos: [],
        dnaProduto: {
          tempoPadraoMin: dna.tempoPadraoMin === '' ? null : Number(dna.tempoPadraoMin),
          maquinaPrincipal: dna.maquinaPrincipal.trim(),
          nivelDificuldade: dna.nivelDificuldade,
          principaisErros: dna.principaisErros.split('\n').map((item) => item.trim()).filter(Boolean),
        },
        tamanhos: sizes,
        blocos: {
          bom: bom.length > 0,
          medidas: measurementRows.length > 0,
          checklist: checklist.length > 0,
        },
        bom,
        medidas: measurementRows,
        checklist,
        operacoes: technicalOperations,
      }

      for (let index = 0; index < imageFiles.slice(0, 6).length; index += 1) {
        const file = imageFiles[index]
        const uploaded = await uploadTechnicalSheetImage(
          empresaId,
          generatedCode,
          draft.numero,
          file,
        )
        draft = {
          ...draft,
          imagens: [
            ...draft.imagens,
            {
              url: uploaded.url,
              path: uploaded.path,
              legenda: index === 0 ? 'Imagem principal da peça' : `Referência ${index + 1}`,
              ordem: draft.imagens.length + 1,
            },
          ],
        }
      }

      const operationsWithMedia: TechnicalOperation[] = []
      for (const operation of draft.operacoes) {
        const source = operations.find((item) => item.id === operation.id)
        if (!source?.mediaFile) {
          operationsWithMedia.push(operation)
          continue
        }
        const uploaded = await uploadOperationMedia(
          empresaId,
          generatedCode,
          draft.numero,
          operation.id,
          source.mediaFile,
        )
        operationsWithMedia.push({
          ...operation,
          midias: [{
            id: crypto.randomUUID(),
            tipo: uploaded.tipo,
            url: uploaded.url,
            path: uploaded.path,
            legenda: uploaded.tipo === 'video' ? 'Vídeo demonstrativo' : 'Referência da operação',
            ordem: 1,
          }],
        })
      }

      draft = { ...draft, operacoes: operationsWithMedia }

      const uploadedAttachments = []
      for (const attachment of attachments) {
        if (!attachment.file) continue
        const uploaded = await uploadTechnicalAttachment(
          empresaId,
          generatedCode,
          draft.numero,
          attachment.tipo,
          attachment.file,
        )
        uploadedAttachments.push({
          id: crypto.randomUUID(),
          tipo: attachment.tipo,
          nome: attachment.nome,
          url: uploaded.url,
          path: uploaded.path,
        })
      }
      draft = { ...draft, anexos: uploadedAttachments }

      await saveTechnicalDraft(empresaId, user.uid, draft)
      await submitTechnicalRevision(empresaId, user.uid, draft)
      await publishTechnicalRevision(empresaId, user.uid, {
        ...draft,
        status: 'em_validacao',
      })

      let orderNumber: string | undefined
      if (production.criarOp) {
        const variants: ProductionVariant[] = sizes
          .map((size) => ({
            id: crypto.randomUUID(),
            nome: size,
            quantidade: Number(quantities[size] ?? 0),
          }))
          .filter((item) => item.quantidade > 0)

        const created = await createProductionOrder(empresaId, user.uid, {
          prazo: production.prazo,
          itens: [{
            produtoCodigo: generatedCode,
            produtoDescricao: piece.descricao.trim(),
            cor: production.cor.trim() || piece.cor.trim(),
            variantes: variants,
          }],
        })
        await releaseProductionOrder(empresaId, user.uid, created.id, null)
        orderNumber = created.numero
      }

      setSuccess({ codigo: generatedCode, numeroOp: orderNumber })
      notify(orderNumber
        ? `${generatedCode} cadastrada e ${orderNumber} liberada para produção.`
        : `${generatedCode} cadastrada e liberada para produção.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o cadastro da peça.')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return <section className="piece-complete-success">
      <span className="piece-complete-success-icon"><CheckCircle2 size={40} /></span>
      <span className="section-kicker">Cadastro concluído</span>
      <h2>{success.codigo} está pronta</h2>
      <p>
        O produto, Passaporte Digital e operações foram criados.
        {success.numeroOp ? ` A ${success.numeroOp} também já foi liberada para o chão de fábrica.` : ''}
      </p>
      <div className="piece-complete-success-actions">
        {success.numeroOp && <button className="guided-primary-button" onClick={openOperator}>
          <MonitorPlay size={18} /> Abrir Modo Operador
        </button>}
        <button className="guided-secondary-button" onClick={openPassport}>
          <FileText size={18} /> Ver Passaporte
        </button>
        <button className="guided-secondary-button" onClick={() => window.location.reload()}>
          <Plus size={18} /> Cadastrar outra peça
        </button>
      </div>
    </section>
  }

  return <div className="piece-complete-page">
    <section className="piece-complete-head">
      <div>
        <span className="guided-flow-kicker"><Sparkles size={14} /> Cadastro completo</span>
        <h2>Nova peça</h2>
        <p>Preencha tudo em uma única tela. O sistema cria o produto, publica o Passaporte e, se quiser, já libera a primeira OP.</p>
      </div>
      <div className="piece-complete-score">
        <strong>{completedSections}/12</strong>
        <span>blocos preenchidos</span>
      </div>
    </section>

    {error && <div className="form-error page-message">{error}</div>}

    <div className="piece-complete-layout">
      <main className="piece-complete-form">
        <FormSection number="1" icon={PackageCheck} title="Identificação da peça" text="Os dados que todo mundo precisa reconhecer rapidamente.">
          <div className="guided-form-grid">
            <label className="guided-field wide"><span>Nome da peça *</span><input value={piece.descricao} onChange={(e) => setPiece({ ...piece, descricao: e.target.value })} placeholder="Ex.: Polo Masculina Corporativa" autoFocus /></label>
            <label className="guided-field"><span>Referência / código</span><input value={piece.codigo} onChange={(e) => setPiece({ ...piece, codigo: e.target.value.toUpperCase() })} placeholder="Opcional · gerado automaticamente" /></label>
            <label className="guided-field"><span>Cliente</span><input value={piece.cliente} onChange={(e) => setPiece({ ...piece, cliente: e.target.value })} placeholder="Ex.: Empresa XYZ" /></label>
            <label className="guided-field"><span>Coleção / projeto</span><input value={piece.colecao} onChange={(e) => setPiece({ ...piece, colecao: e.target.value })} placeholder="Ex.: Corporativo 2027" /></label>
            <label className="guided-field"><span>Família / linha</span><input value={piece.familia} onChange={(e) => setPiece({ ...piece, familia: e.target.value })} placeholder="Ex.: Uniformes" /></label>
            <label className="guided-field"><span>Modelo</span><input value={piece.modelo} onChange={(e) => setPiece({ ...piece, modelo: e.target.value })} placeholder="Ex.: Polo masculina" /></label>
            <label className="guided-field"><span>Responsável técnico</span><input value={piece.responsavelTecnico} onChange={(e) => setPiece({ ...piece, responsavelTecnico: e.target.value })} placeholder="Ex.: Márcia Pedro" /></label>
            <label className="guided-field"><span>Cor principal</span><input value={piece.cor} onChange={(e) => { setPiece({ ...piece, cor: e.target.value }); setProduction((p) => ({ ...p, cor: e.target.value })) }} placeholder="Ex.: Azul Marinho" /></label>
            <label className="guided-field wide"><span>Tamanhos / variantes *</span><input value={piece.tamanhos} onChange={(e) => updateSizes(e.target.value)} placeholder="P, M, G, GG" /><small>Separe por vírgula.</small></label>
            <label className="guided-field wide"><span>Como a peça é construída? *</span><textarea rows={5} value={piece.construcao} onChange={(e) => setPiece({ ...piece, construcao: e.target.value })} placeholder="Descreva material, formato, montagem e acabamento de forma simples." /></label>
          </div>
        </FormSection>

        <FormSection number="2" icon={ImagePlus} title="Referências visuais" text="Fotos da peça, frente, costas e detalhes.">
          <label className="piece-complete-upload">
            <Upload size={24} />
            <strong>Adicionar fotos da peça</strong>
            <span>Até 6 imagens. Você pode selecionar várias de uma vez.</span>
            <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files ?? []).slice(0, 6))} />
          </label>
          {imageFiles.length > 0 && <div className="piece-file-chips">{imageFiles.map((file) => <span key={file.name}>{file.name}</span>)}</div>}
        </FormSection>

        <FormSection number="3" icon={FileText} title="Dados do tecido" text="Este bloco preenche diretamente o quadro DADOS DO TECIDO da Ficha Técnica.">
          <div className="guided-form-grid">
            <label className="guided-field"><span>Tecido principal</span><input value={fabric.tecidoPrincipal} onChange={(e) => setFabric({ ...fabric, tecidoPrincipal: e.target.value })} placeholder="Ex.: Malha Piquet" /></label>
            <label className="guided-field"><span>Composição</span><input value={fabric.composicao} onChange={(e) => setFabric({ ...fabric, composicao: e.target.value })} placeholder="Ex.: 50% algodão / 50% poliéster" /></label>
            <label className="guided-field"><span>Gramatura</span><input value={fabric.gramatura} onChange={(e) => setFabric({ ...fabric, gramatura: e.target.value })} placeholder="Ex.: 180 g/m²" /></label>
            <label className="guided-field"><span>Largura</span><input value={fabric.largura} onChange={(e) => setFabric({ ...fabric, largura: e.target.value })} placeholder="Ex.: 1,75 m" /></label>
            <label className="guided-field"><span>Fornecedor</span><input value={fabric.fornecedor} onChange={(e) => setFabric({ ...fabric, fornecedor: e.target.value })} placeholder="Ex.: Malhas Brasil" /></label>
            <label className="guided-field"><span>Cor do tecido</span><input value={fabric.cor} onChange={(e) => setFabric({ ...fabric, cor: e.target.value })} placeholder={piece.cor || 'Ex.: Azul Marinho'} /></label>
            <label className="guided-field"><span>Encolhimento máximo</span><input value={fabric.encolhimentoMaximo} onChange={(e) => setFabric({ ...fabric, encolhimentoMaximo: e.target.value })} placeholder="Ex.: 3%" /></label>
            <label className="guided-field"><span>Solidez da cor</span><input value={fabric.solidezCor} onChange={(e) => setFabric({ ...fabric, solidezCor: e.target.value })} placeholder="Ex.: Grau 4" /></label>
          </div>
        </FormSection>

        <FormSection number="4" icon={Boxes} title="Aviamentos e materiais" text="Itens que aparecem na tabela de aviamentos, com consumo por peça.">
          <div className="piece-material-list">
            {materials.map((row, index) => <article className="piece-material-row" key={row.id}>
              <div className="piece-row-number">{index + 1}</div>
              <div className="piece-material-fields">
                <label><span>Origem</span><select value={row.origem} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, origem: e.target.value as MaterialDraft['origem'], materialId: '', descricao: '', codigo: '' } : item))}><option value="novo">Cadastrar novo</option><option value="existente">Usar existente</option></select></label>
                {row.origem === 'existente' ? <label className="wide"><span>Material</span><select value={row.materialId} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, materialId: e.target.value } : item))}><option value="">Selecione...</option>{existingMaterials.filter((item) => item.ativo).map((item) => <option value={item.id} key={item.id}>{item.codigo} · {item.descricao}</option>)}</select></label> : <>
                  <label><span>Código</span><input value={row.codigo} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, codigo: e.target.value } : item))} placeholder="Opcional" /></label>
                  <label className="wide"><span>Descrição</span><input value={row.descricao} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, descricao: e.target.value } : item))} placeholder="Ex.: Malha Piquet Azul Marinho" /></label>
                  <label><span>Unidade</span><input value={row.unidade} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, unidade: e.target.value } : item))} placeholder="un, kg, m..." /></label>
                </>}
                <label><span>Consumo / peça</span><input type="number" min="0" step="0.001" value={row.consumo} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, consumo: Number(e.target.value) } : item))} /></label>
                <label><span>Perda %</span><input type="number" min="0" step="0.1" value={row.perdaPercentual} onChange={(e) => setMaterials(materials.map((item) => item.id === row.id ? { ...item, perdaPercentual: Number(e.target.value) } : item))} /></label>
              </div>
              <button className="piece-row-remove" onClick={() => setMaterials(materials.filter((item) => item.id !== row.id))}><Trash2 size={16} /></button>
            </article>)}
          </div>
          <button className="guided-secondary-button piece-add-button" onClick={addMaterial}><Plus size={16} /> Adicionar material</button>
        </FormSection>

        <FormSection number="5" icon={Ruler} title="Tabela de medidas" text="Opcional, mas muito útil para padronização e qualidade.">
          <div className="piece-measure-table-wrap">
            {measurements.length > 0 && <table className="piece-measure-table"><thead><tr><th>Ponto</th><th>Tolerância</th>{sizes.map((size) => <th key={size}>{size}</th>)}<th /></tr></thead><tbody>{measurements.map((row) => <tr key={row.id}><td><input value={row.ponto} onChange={(e) => setMeasurements(measurements.map((item) => item.id === row.id ? { ...item, ponto: e.target.value } : item))} placeholder="Ex.: Peito" /></td><td><input type="number" step="0.1" value={row.tolerancia} onChange={(e) => setMeasurements(measurements.map((item) => item.id === row.id ? { ...item, tolerancia: Number(e.target.value) } : item))} /></td>{sizes.map((size) => <td key={size}><input type="number" step="0.1" value={row.valores[size] ?? ''} onChange={(e) => setMeasurements(measurements.map((item) => item.id === row.id ? { ...item, valores: { ...item.valores, [size]: e.target.value === '' ? '' : Number(e.target.value) } } : item))} /></td>)}<td><button className="piece-row-remove" onClick={() => setMeasurements(measurements.filter((item) => item.id !== row.id))}><Trash2 size={15} /></button></td></tr>)}</tbody></table>}
          </div>
          <button className="guided-secondary-button piece-add-button" onClick={addMeasurement}><Plus size={16} /> Adicionar medida</button>
        </FormSection>

        <FormSection number="6" icon={Factory} title="Sequência operacional, máquinas e POP" text="É aqui que você explica como a peça será produzida no chão de fábrica.">
          <div className="piece-section-toolbar"><button className="guided-example-button" onClick={() => setOperations(exampleOperations())}><Sparkles size={16} /> Preencher exemplo</button><button className="guided-secondary-button" onClick={addOperation}><Plus size={16} /> Nova operação</button></div>
          <div className="piece-operation-list">
            {operations.map((row, index) => <article className="piece-operation-row" key={row.id}>
              <div className="piece-operation-head"><span>{row.codigo || String((index + 1) * 10)}</span><strong>Operação {index + 1}</strong><button onClick={() => setOperations(operations.filter((item) => item.id !== row.id))}><Trash2 size={16} /></button></div>
              <div className="guided-form-grid">
                <label className="guided-field"><span>Nome *</span><input value={row.nome} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, nome: e.target.value } : item))} placeholder="Ex.: Pregar manga" /></label>
                <label className="guided-field"><span>Máquina</span><input value={row.maquina} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, maquina: e.target.value } : item))} placeholder="Ex.: Overloque 5 fios" /></label>
                <label className="guided-field"><span>Acessório / aparelho</span><input value={row.ferramenta} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, ferramenta: e.target.value } : item))} placeholder="Ex.: Calcador guia" /></label>
                <label className="guided-field"><span>Regulagem</span><input value={row.regulagem} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, regulagem: e.target.value } : item))} placeholder="Ex.: Ponto 3,5 mm" /></label>
                <label className="guided-field"><span>Tempo padrão (min)</span><input type="number" min="0" step="0.01" value={row.tempoPadraoMin} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, tempoPadraoMin: e.target.value === '' ? '' : Number(e.target.value) } : item))} /></label>
                <label className="guided-field"><span>Dificuldade</span><select value={row.dificuldade} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, dificuldade: e.target.value as OperationDraft['dificuldade'] } : item))}><option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option></select></label>
                <label className="guided-field wide"><span>Instrução principal *</span><textarea rows={3} value={row.descricao} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, descricao: e.target.value } : item))} placeholder="Explique o que deve ser feito nesta operação." /></label>
                <label className="guided-field wide"><span>Passo a passo</span><textarea rows={4} value={row.instrucoes} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, instrucoes: e.target.value } : item))} placeholder={"Um passo por linha\nEx.: Posicionar a peça\nAlinhar marcações\nCosturar"} /></label>
                <label className="guided-field wide"><span>Pontos críticos</span><textarea rows={3} value={row.pontosCriticos} onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, pontosCriticos: e.target.value } : item))} placeholder={"Um ponto por linha\nEx.: Sem franzimento\nMargem uniforme"} /></label>
                <label className="piece-operation-media"><Video size={18} /><span>{row.mediaFile ? row.mediaFile.name : 'Adicionar foto ou vídeo da operação'}</span><input type="file" accept="image/*,video/*" onChange={(e) => setOperations(operations.map((item) => item.id === row.id ? { ...item, mediaFile: e.target.files?.[0] ?? null } : item))} /></label>
              </div>
            </article>)}
          </div>
        </FormSection>

        <FormSection number="7" icon={Wrench} title="Agulhas e linhas" text="Preenche o quadro AGULHAS E LINHAS da Ficha Técnica.">
          <div className="piece-quality-list">
            {needleThreads.map((row) => <div key={row.id} className="piece-triple-row">
              <input value={row.maquina} onChange={(e) => setNeedleThreads(needleThreads.map((item) => item.id === row.id ? { ...item, maquina: e.target.value } : item))} placeholder="Máquina" />
              <input value={row.agulha} onChange={(e) => setNeedleThreads(needleThreads.map((item) => item.id === row.id ? { ...item, agulha: e.target.value } : item))} placeholder="Agulha · Ex.: DBx1 nº 11" />
              <input value={row.linha} onChange={(e) => setNeedleThreads(needleThreads.map((item) => item.id === row.id ? { ...item, linha: e.target.value } : item))} placeholder="Linha · Ex.: 120 Poliéster" />
              <button onClick={() => setNeedleThreads(needleThreads.filter((item) => item.id !== row.id))}><Trash2 size={15} /></button>
            </div>)}
          </div>
          <button className="guided-secondary-button piece-add-button" onClick={() => setNeedleThreads([...needleThreads, { id: crypto.randomUUID(), maquina: '', agulha: '', linha: '' }])}><Plus size={16} /> Adicionar máquina / agulha / linha</button>
        </FormSection>

        <FormSection number="8" icon={ShieldCheck} title="Controle de qualidade" text="Cadastre exatamente as duas colunas do quadro CONTROLE DE QUALIDADE.">
          <div className="piece-two-list-grid">
            <div>
              <strong>Pontos críticos de controle</strong>
              <div className="piece-quality-list">{qualityCritical.map((item, index) => <div key={index}><CheckCircle2 size={17} /><input value={item} onChange={(e) => setQualityCritical(qualityCritical.map((value, itemIndex) => itemIndex === index ? e.target.value : value))} placeholder="Ex.: Ombros alinhados" /><button onClick={() => setQualityCritical(qualityCritical.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div>)}</div>
              <button className="guided-secondary-button piece-add-button" onClick={() => setQualityCritical([...qualityCritical, ''])}><Plus size={16} /> Adicionar controle</button>
            </div>
            <div>
              <strong>Defeitos não aceitos</strong>
              <div className="piece-quality-list">{qualityDefects.map((item, index) => <div key={index}><span className="piece-defect-mark">×</span><input value={item} onChange={(e) => setQualityDefects(qualityDefects.map((value, itemIndex) => itemIndex === index ? e.target.value : value))} placeholder="Ex.: Gola torta" /><button onClick={() => setQualityDefects(qualityDefects.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div>)}</div>
              <button className="guided-secondary-button piece-add-button" onClick={() => setQualityDefects([...qualityDefects, ''])}><Plus size={16} /> Adicionar defeito</button>
            </div>
          </div>
        </FormSection>

        <FormSection number="9" icon={Scissors} title="Processo de corte" text="Preenche diretamente o quadro PROCESSO DE CORTE.">
          <div className="guided-form-grid">
            <label className="guided-field"><span>Encaixe</span><input value={cutting.encaixe} onChange={(e) => setCutting({ ...cutting, encaixe: e.target.value })} placeholder="Ex.: Corpo Polo 01" /></label>
            <label className="guided-field"><span>Consumo de tecido</span><input value={cutting.consumoTecido} onChange={(e) => setCutting({ ...cutting, consumoTecido: e.target.value })} placeholder="Ex.: 155 m/peça" /></label>
            <label className="guided-field"><span>Comprimento do risco</span><input value={cutting.comprimentoRisco} onChange={(e) => setCutting({ ...cutting, comprimentoRisco: e.target.value })} placeholder="Ex.: 6 m" /></label>
            <label className="guided-field"><span>Altura do enfesto</span><input value={cutting.alturaEnfesto} onChange={(e) => setCutting({ ...cutting, alturaEnfesto: e.target.value })} placeholder="Ex.: 98 cm" /></label>
            <label className="guided-field"><span>Nº de folhas</span><input value={cutting.numeroFolhas} onChange={(e) => setCutting({ ...cutting, numeroFolhas: e.target.value })} placeholder="Ex.: 10" /></label>
            <label className="guided-field"><span>Perdas (%)</span><input value={cutting.perdasPercentual} onChange={(e) => setCutting({ ...cutting, perdasPercentual: e.target.value })} placeholder="Ex.: 8%" /></label>
          </div>
        </FormSection>

        <FormSection number="10" icon={Paperclip} title="Anexos" text="Os mesmos anexos exibidos na faixa inferior da Ficha Técnica.">
          <div className="piece-attachment-grid">
            {attachments.map((attachment) => <label key={attachment.tipo} className={`piece-attachment-upload ${attachment.file ? 'filled' : ''}`}>
              <Paperclip size={17} />
              <strong>{attachment.nome}</strong>
              <span>{attachment.file?.name || 'Selecionar arquivo'}</span>
              <input type="file" onChange={(e) => setAttachments(attachments.map((item) => item.tipo === attachment.tipo ? { ...item, file: e.target.files?.[0] ?? null } : item))} />
            </label>)}
          </div>
        </FormSection>

        <FormSection number="11" icon={Sparkles} title="DNA do produto" text="Campos finais que aparecem no rodapé visual da Ficha Técnica.">
          <div className="guided-form-grid">
            <label className="guided-field"><span>Tempo padrão total (min)</span><input type="number" step="0.01" value={dna.tempoPadraoMin} onChange={(e) => setDna({ ...dna, tempoPadraoMin: e.target.value })} placeholder="Ex.: 2,85" /></label>
            <label className="guided-field"><span>Máquina principal</span><input value={dna.maquinaPrincipal} onChange={(e) => setDna({ ...dna, maquinaPrincipal: e.target.value })} placeholder="Ex.: Overloque 5 fios" /></label>
            <label className="guided-field"><span>Nível de dificuldade</span><select value={dna.nivelDificuldade} onChange={(e) => setDna({ ...dna, nivelDificuldade: e.target.value as typeof dna.nivelDificuldade })}><option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option></select></label>
            <label className="guided-field wide"><span>Principais erros encontrados</span><textarea rows={5} value={dna.principaisErros} onChange={(e) => setDna({ ...dna, principaisErros: e.target.value })} placeholder={"Um por linha\nEx.: Gola torta\nBainha ondulada\nEtiqueta desalinhada"} /></label>
          </div>
        </FormSection>

        <FormSection number="12" icon={MonitorPlay} title="Primeira produção" text="Se quiser, o cadastro já termina com a primeira OP liberada.">
          <label className="piece-production-toggle"><input type="checkbox" checked={production.criarOp} onChange={(e) => setProduction({ ...production, criarOp: e.target.checked })} /><span><strong>Criar e liberar a primeira OP agora</strong><small>Desmarque se quiser apenas cadastrar e publicar a peça.</small></span></label>
          {production.criarOp && <div className="piece-production-box">
            <div className="guided-form-grid"><label className="guided-field"><span>Cor / variante</span><input value={production.cor} onChange={(e) => setProduction({ ...production, cor: e.target.value })} /></label><label className="guided-field"><span>Prazo</span><input type="date" value={production.prazo} onChange={(e) => setProduction({ ...production, prazo: e.target.value })} /></label></div>
            <div className="guided-size-grid">{sizes.map((size) => <label className="guided-size-field" key={size}><span>{size}</span><input type="number" min="0" value={quantities[size] ?? 0} onChange={(e) => setQuantities({ ...quantities, [size]: Number(e.target.value) })} /></label>)}</div>
            <div className="piece-production-total">Total da OP: <strong>{totalPieces} peças</strong></div>
          </div>}
        </FormSection>

        <section className="piece-submit-bar">
          <div><strong>Pronto para salvar?</strong><span>O sistema cria produto + Passaporte + revisão publicada {production.criarOp ? '+ OP liberada.' : '.'}</span></div>
          <button className="piece-submit-button" disabled={busy} onClick={submit}>{busy ? <Loader2 className="spin" size={19} /> : <Sparkles size={19} />} {busy ? 'Criando peça...' : production.criarOp ? 'Salvar e mandar produzir' : 'Salvar peça completa'}</button>
        </section>
      </main>

      <aside className="piece-complete-summary">
        <span className="section-kicker">Resumo</span>
        <h3>{piece.descricao || 'Nova peça'}</h3>
        <p>{piece.codigo || 'Código automático'}</p>
        <div className="piece-summary-progress"><i style={{ width: `${Math.round(completedSections / 12 * 100)}%` }} /></div>
        <strong>{completedSections}/12 blocos</strong>
        <ul>
          <li className={piece.descricao && piece.construcao ? 'done' : ''}>Identificação</li>
          <li className={imageFiles.length ? 'done' : ''}>Fotos</li>
          <li className={fabric.tecidoPrincipal ? 'done' : ''}>Tecido</li>
          <li className={materials.some((item) => item.materialId || item.descricao) ? 'done' : ''}>Aviamentos</li>
          <li className={measurements.length ? 'done' : ''}>Medidas</li>
          <li className={operations.some((item) => item.nome && item.descricao) ? 'done' : ''}>Operações</li>
          <li className={needleThreads.some((item) => item.maquina || item.agulha || item.linha) ? 'done' : ''}>Agulhas / linhas</li>
          <li className={qualityCritical.some(Boolean) || qualityDefects.some(Boolean) ? 'done' : ''}>Qualidade</li>
          <li className={cutting.encaixe || cutting.consumoTecido ? 'done' : ''}>Corte</li>
          <li className={attachments.some((item) => item.file) ? 'done' : ''}>Anexos</li>
          <li className={dna.maquinaPrincipal || dna.tempoPadraoMin || dna.principaisErros ? 'done' : ''}>DNA</li>
          <li className={!production.criarOp || totalPieces > 0 ? 'done' : ''}>Produção</li>
        </ul>
        <div className="piece-summary-note"><Sparkles size={16} /><span>Você pode cadastrar tudo aqui e depois editar detalhes no Passaporte completo.</span></div>
      </aside>
    </div>
  </div>
}

function FormSection({
  number,
  icon: Icon,
  title,
  text,
  children,
}: {
  number: string
  icon: typeof PackageCheck
  title: string
  text: string
  children: React.ReactNode
}) {
  return <section className="piece-form-section">
    <div className="piece-form-section-head">
      <span className="piece-form-section-number">{number}</span>
      <span className="piece-form-section-icon"><Icon size={20} /></span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </div>
    <div className="piece-form-section-body">{children}</div>
  </section>
}

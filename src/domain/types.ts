export type ModuleKey =
  | 'materiais'
  | 'produtos'
  | 'fichas'
  | 'workflow'
  | 'ordens'
  | 'qualidade'

export type CompanyBranch = {
  id: string
  nome: string
  ativo?: boolean
}

export type Company = {
  id: string
  nome: string
  nomeFantasia: string
  documento: string
  logoUrl?: string
  ownerUid?: string
  modulos: Record<ModuleKey, boolean>
  filiais: CompanyBranch[]
  ativo?: boolean
}

export type CompanyMembership = {
  empresaId: string
  nomeFantasia: string
  perfis: string[]
  ativo: boolean
}

export type Supplier = {
  id: string
  nome: string
  contato?: string
  telefone?: string
  email?: string
  observacao?: string
  ativo: boolean
}

export type Category = {
  id: string
  nome: string
  parentId: string | null
  nivel: number
  prefixo?: string
  ativo: boolean
}

export type UnitDefinition = {
  id: string
  simbolo: string
  nome: string
  ativo: boolean
}

export type MaterialSupplier = {
  fornecedorId: string
  nomeSnapshot: string
  principal: boolean
  referenciaFornecedor?: string
}

export type Material = {
  id: string
  codigo: string
  codigoLegado?: string
  descricao: string
  buscaNormalizada?: string
  categoriaId?: string
  categoria: string
  unidade: string
  fornecedores: MaterialSupplier[] | string[]
  custoUnitario?: number | null
  leadTimeDias?: number | null
  loteMinimo?: number | null
  observacao?: string
  ativo: boolean
}

export type CodeSegment = {
  id: string
  nome: string
  tamanho: number
  obrigatorio: boolean
  ordem: number
}

export type Product = {
  id: string
  codigo: string
  descricao: string
  classificacoes: Record<string, string>
  revisaoVigente?: number
  status: 'ativo' | 'inativo'
}

export type TechnicalSheet = {
  id: string
  produtoCodigo: string
  produtoDescricao: string
  revisao: number
  status: string
  blocos: string[]
  atualizadoEm: string
}

export type WorkflowStage = {
  id: string
  nome: string
  perfil: string
  ordem: number
  obrigatoria: boolean
}

export type ProductionOrder = {
  id: string
  numero: string
  itens: number
  variantes: number
  status: string
  prazo: string
  progresso: number
}

export type CompanySettings = {
  unidades: UnitDefinition[]
  estrategiaCodigo: {
    tipo: 'manual' | 'sequencial' | 'segmentado' | 'externo'
    prefixo?: string
    digitos?: number
    segmentos?: CodeSegment[]
  }
  modulos: Record<ModuleKey, boolean>
}


export type BomLine = {
  id: string
  materialId: string
  codigoSnapshot: string
  descricaoSnapshot: string
  fornecedorId?: string
  fornecedorSnapshot?: string
  referenciaFornecedorSnapshot?: string
  corRegra: 'produto' | 'fixa' | 'nao_aplica'
  corFixa?: string
  consumo: number
  consumoPorTamanho?: Record<string, number>
  unidade: string
  perdaPercentual: number
  observacao?: string
}

export type MeasurementValue = {
  tamanho: string
  valor: number | null
}

export type MeasurementRow = {
  id: string
  ponto: string
  tolerancia: number
  valores: MeasurementValue[]
}

export type TechnicalChecklistItem = {
  id: string
  descricao: string
  obrigatorio: boolean
}

export type TechnicalMedia = {
  id: string
  tipo: 'imagem' | 'video'
  url: string
  path?: string
  legenda: string
  ordem: number
}

export type TechnicalOperation = {
  id: string
  ordem: number
  codigo: string
  nome: string
  descricao: string
  maquina: string
  regulagem: string
  ferramenta: string
  tempoPadraoMin: number | null
  dificuldade: 'facil' | 'medio' | 'dificil'
  pontosCriticos: string[]
  instrucoes: string[]
  midias: TechnicalMedia[]
}

export type TechnicalRevision = {
  id: string
  numero: number
  status: 'rascunho' | 'em_validacao' | 'padrao' | 'obsoleta'
  produtoCodigo: string
  produtoDescricao: string
  motivoRevisao?: string
  construcao: string
  blocos: {
    bom: boolean
    medidas: boolean
    checklist: boolean
  }
  bom: BomLine[]
  tamanhos: string[]
  medidas: MeasurementRow[]
  checklist: TechnicalChecklistItem[]
  operacoes: TechnicalOperation[]
  imagens: Array<{ url: string; path?: string; legenda: string; ordem: number }>
  aprovadoPor?: string
  aprovadoEm?: unknown
}

export type TechnicalSheetSummary = {
  id: string
  produtoCodigo: string
  produtoDescricao: string
  revisaoVigente?: number | null
  revisaoRascunho?: number | null
  status: 'sem_ficha' | 'rascunho' | 'em_validacao' | 'padrao'
  alteradoEm?: unknown
}


export type ProductionVariant = {
  id: string
  nome: string
  quantidade: number
}

export type ProductionOrderItemRecord = {
  id: string
  produtoCodigo: string
  produtoDescricao: string
  revisao: number | null
  cor?: string
  variantes: ProductionVariant[]
  quantidadeTotal: number
}

export type FrozenKitLine = {
  id: string
  materialId: string
  codigoSnapshot: string
  descricaoSnapshot: string
  fornecedorSnapshot?: string
  unidade: string
  quantidadeNecessaria: number
  corRegra: string
  corFixa?: string
}

export type OrderHistoryEntry = {
  id: string
  acao: string
  etapaId?: string | null
  uid: string
  em: unknown
  observacao?: string
}

export type ProductionOperationTask = {
  id: string
  itemId: string
  produtoCodigo: string
  produtoDescricao: string
  revisao: number
  cor?: string
  operacao: TechnicalOperation
  status: 'pendente' | 'em_execucao' | 'concluida' | 'bloqueada'
  iniciadoEm?: unknown
  concluidoEm?: unknown
  operadorUid?: string
  observacao?: string
}

export type ProductionOrderRecord = {
  id: string
  numero: string
  prazo?: string
  status: 'rascunho' | 'liberada' | 'em_fluxo' | 'concluida' | 'cancelada' | 'reprovada'
  workflowStageId?: string | null
  reprovadaNaEtapaId?: string | null
  itens: ProductionOrderItemRecord[]
  kit: FrozenKitLine[]
  operacoes: ProductionOperationTask[]
  historico: OrderHistoryEntry[]
  alteradoEm?: unknown
}


export type QualityCriterion = {
  id: string
  nome: string
  tipo: 'numerico' | 'checklist'
  nominal?: number
  tolerancia?: number
  severidade: 'critico' | 'maior' | 'menor'
}

export type QualityResult = {
  criterioId: string
  criterioNome: string
  tipo: 'numerico' | 'checklist'
  valor?: number
  conforme: boolean
  nominal?: number
  tolerancia?: number
  severidade: 'critico' | 'maior' | 'menor'
}

export type QualitySample = {
  numero: number
  resultados: QualityResult[]
  aprovada: boolean
}

export type QualityInspection = {
  id: string
  opId: string
  opNumero: string
  criterios: QualityCriterion[]
  amostras: QualitySample[]
  resultadoGeral: 'aprovada' | 'reprovada'
  observacao?: string
  inspetorUid: string
  criadoEm?: unknown
}

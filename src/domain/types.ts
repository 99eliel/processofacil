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
  medidas: MeasurementRow[]
  imagens: Array<{ url: string; legenda: string; ordem: number }>
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

export type ProductionOrderRecord = {
  id: string
  numero: string
  prazo?: string
  status: 'rascunho' | 'liberada' | 'em_fluxo' | 'concluida' | 'cancelada' | 'reprovada'
  workflowStageId?: string | null
  itens: ProductionOrderItemRecord[]
  kit: FrozenKitLine[]
  historico: OrderHistoryEntry[]
  alteradoEm?: unknown
}

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

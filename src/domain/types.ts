export type ModuleKey =
  | 'materiais'
  | 'produtos'
  | 'fichas'
  | 'workflow'
  | 'ordens'
  | 'qualidade'

export type Company = {
  id: string
  nome: string
  nomeFantasia: string
  documento: string
  logoUrl?: string
  modulos: Record<ModuleKey, boolean>
  filiais: { id: string; nome: string }[]
}

export type CodeSegment = {
  id: string
  nome: string
  tamanho: number
  obrigatorio: boolean
  ordem: number
}

export type Material = {
  id: string
  codigo: string
  descricao: string
  categoria: string
  unidade: string
  fornecedores: string[]
  ativo: boolean
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

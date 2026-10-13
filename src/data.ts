import type { CodeSegment, Company, Material, Product, ProductionOrder, TechnicalSheet, WorkflowStage } from './domain/types'

export const demoCompany: Company = {
  id: 'empresa-demo',
  nome: 'Empresa Demonstração Ltda.',
  nomeFantasia: 'Empresa Demonstração',
  documento: '00.000.000/0001-00',
  modulos: {
    materiais: true,
    produtos: true,
    fichas: true,
    workflow: true,
    ordens: true,
    qualidade: true,
  },
  filiais: [
    { id: 'matriz', nome: 'Matriz' },
    { id: 'unidade-02', nome: 'Unidade 02' },
  ],
}

export const codeSegments: CodeSegment[] = [
  { id: 'familia', nome: 'Família', tamanho: 3, obrigatorio: true, ordem: 1 },
  { id: 'linha', nome: 'Linha', tamanho: 2, obrigatorio: true, ordem: 2 },
  { id: 'modelo', nome: 'Modelo', tamanho: 3, obrigatorio: true, ordem: 3 },
]

export const materials: Material[] = [
  { id: 'm1', codigo: 'ACO-0001', descricao: 'Chapa aço carbono 1,5 mm', categoria: 'Matéria-prima / Metais', unidade: 'kg', fornecedores: ['Fornecedor Alfa', 'Fornecedor Beta'], ativo: true },
  { id: 'm2', codigo: 'PAR-0007', descricao: 'Parafuso sextavado M8', categoria: 'Componentes / Fixadores', unidade: 'pç', fornecedores: ['Fornecedor Gama'], ativo: true },
  { id: 'm3', codigo: 'EMB-0012', descricao: 'Caixa de embalagem tamanho M', categoria: 'Embalagem / Caixa', unidade: 'pç', fornecedores: ['Fornecedor Delta'], ativo: true },
  { id: 'm4', codigo: 'TINT-0004', descricao: 'Tinta acabamento fosco', categoria: 'Insumos / Acabamento', unidade: 'L', fornecedores: ['Fornecedor Épsilon'], ativo: true },
]

export const products: Product[] = [
  { id: 'p1', codigo: '120050001', descricao: 'Conjunto Estrutural A', classificacoes: { Família: 'Estruturas', Linha: 'Industrial', Modelo: 'A' }, revisaoVigente: 3, status: 'ativo' },
  { id: 'p2', codigo: '120050002', descricao: 'Conjunto Estrutural B', classificacoes: { Família: 'Estruturas', Linha: 'Industrial', Modelo: 'B' }, revisaoVigente: 1, status: 'ativo' },
  { id: 'p3', codigo: '210030001', descricao: 'Kit de Reposição Compacto', classificacoes: { Família: 'Reposição', Linha: 'Compacta', Modelo: 'Padrão' }, status: 'ativo' },
]

export const sheets: TechnicalSheet[] = [
  { id: 'ft1', produtoCodigo: '120050001', produtoDescricao: 'Conjunto Estrutural A', revisao: 3, status: 'Padrão', blocos: ['Identificação', 'BOM', 'Operações', 'Qualidade'], atualizadoEm: '10/10/2026' },
  { id: 'ft2', produtoCodigo: '120050002', produtoDescricao: 'Conjunto Estrutural B', revisao: 1, status: 'Em validação', blocos: ['Identificação', 'BOM', 'Instruções'], atualizadoEm: '12/10/2026' },
  { id: 'ft3', produtoCodigo: '210030001', produtoDescricao: 'Kit de Reposição Compacto', revisao: 1, status: 'Rascunho', blocos: ['Identificação', 'Checklist'], atualizadoEm: '13/10/2026' },
]

export const workflow: WorkflowStage[] = [
  { id: 'w1', nome: 'Desenvolvimento', perfil: 'desenvolvimento', ordem: 1, obrigatoria: true },
  { id: 'w2', nome: 'Validação técnica', perfil: 'qualidade', ordem: 2, obrigatoria: true },
  { id: 'w3', nome: 'Liberação', perfil: 'planejamento', ordem: 3, obrigatoria: true },
  { id: 'w4', nome: 'Produção', perfil: 'producao', ordem: 4, obrigatoria: true },
  { id: 'w5', nome: 'Inspeção final', perfil: 'qualidade', ordem: 5, obrigatoria: false },
]

export const orders: ProductionOrder[] = [
  { id: 'op1', numero: 'OP-2026-0041', itens: 3, variantes: 6, status: 'Em produção', prazo: '18/10/2026', progresso: 62 },
  { id: 'op2', numero: 'OP-2026-0042', itens: 2, variantes: 4, status: 'Liberada', prazo: '20/10/2026', progresso: 15 },
  { id: 'op3', numero: 'OP-2026-0038', itens: 1, variantes: 2, status: 'Qualidade', prazo: '14/10/2026', progresso: 92 },
]

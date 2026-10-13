import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import type { Category, CompanySettings, Material, MaterialSupplier, Supplier } from '../domain/types'

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function auditRef(empresaId: string) {
  return doc(collection(db, 'empresas', empresaId, 'auditoria'))
}

function collectionRef(empresaId: string, name: string) {
  return collection(db, 'empresas', empresaId, name)
}

export function subscribeTenantCollection<T extends { id: string }>(
  empresaId: string,
  name: string,
  onData: (items: T[]) => void,
  onError: (error: Error) => void,
  orderField = 'nome',
): Unsubscribe {
  const ref = collectionRef(empresaId, name)
  return onSnapshot(
    query(ref, orderBy(orderField)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T))),
    (error) => onError(error),
  )
}

export async function createSupplier(
  empresaId: string,
  uid: string,
  input: Omit<Supplier, 'id' | 'ativo'>,
) {
  const ref = doc(collectionRef(empresaId, 'fornecedores'))
  const batch = writeBatch(db)
  const now = serverTimestamp()
  const nome = normalizeSearch(input.nome)

  batch.set(ref, {
    ...input,
    nome,
    buscaNormalizada: normalizeSearch([input.nome, input.contato, input.email].filter(Boolean).join(' ')),
    ativo: true,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: 'fornecedor',
    entidadeId: ref.id,
    acao: 'criado',
    resumo: nome,
    uid,
    em: now,
  })
  await batch.commit()
  return ref.id
}

export async function createCategory(
  empresaId: string,
  uid: string,
  input: Omit<Category, 'id' | 'ativo'>,
) {
  const ref = doc(collectionRef(empresaId, 'categorias'))
  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.set(ref, {
    ...input,
    nome: input.nome.trim(),
    prefixo: input.prefixo?.trim().toUpperCase() || '',
    buscaNormalizada: normalizeSearch(input.nome),
    ativo: true,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: 'categoria',
    entidadeId: ref.id,
    acao: 'criada',
    resumo: input.nome.trim(),
    uid,
    em: now,
  })
  await batch.commit()
  return ref.id
}

export async function createMaterial(
  empresaId: string,
  uid: string,
  input: Omit<Material, 'id' | 'ativo' | 'buscaNormalizada'>,
) {
  const ref = doc(collectionRef(empresaId, 'materiais'))
  const batch = writeBatch(db)
  const now = serverTimestamp()
  const fornecedores = (input.fornecedores as MaterialSupplier[]).map((item) => ({
    fornecedorId: item.fornecedorId,
    nomeSnapshot: item.nomeSnapshot,
    principal: item.principal,
    referenciaFornecedor: item.referenciaFornecedor ?? '',
  }))

  batch.set(ref, {
    ...input,
    codigo: input.codigo.trim().toUpperCase(),
    descricao: input.descricao.trim(),
    categoria: input.categoria.trim(),
    unidade: input.unidade.trim(),
    fornecedores,
    buscaNormalizada: normalizeSearch([
      input.codigo,
      input.codigoLegado,
      input.descricao,
      input.categoria,
      ...fornecedores.map((item) => item.nomeSnapshot),
    ].filter(Boolean).join(' ')),
    ativo: true,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: 'material',
    entidadeId: ref.id,
    acao: 'criado',
    resumo: `${input.codigo.trim().toUpperCase()} · ${input.descricao.trim()}`,
    uid,
    em: now,
  })
  await batch.commit()
  return ref.id
}

export async function updateTenantDocument(
  empresaId: string,
  uid: string,
  collectionName: string,
  id: string,
  data: DocumentData,
  auditLabel: string,
) {
  const ref = doc(db, 'empresas', empresaId, collectionName, id)
  const batch = writeBatch(db)
  const now = serverTimestamp()
  batch.update(ref, {
    ...data,
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: collectionName,
    entidadeId: id,
    acao: 'alterado',
    resumo: auditLabel,
    uid,
    em: now,
  })
  await batch.commit()
}

export async function setActiveState(
  empresaId: string,
  uid: string,
  collectionName: string,
  id: string,
  ativo: boolean,
  label: string,
) {
  return updateTenantDocument(
    empresaId,
    uid,
    collectionName,
    id,
    { ativo },
    `${ativo ? 'Reativado' : 'Inativado'}: ${label}`,
  )
}

export async function saveCompanySettings(
  empresaId: string,
  uid: string,
  settings: CompanySettings,
) {
  const settingsRef = doc(db, 'empresas', empresaId, 'configuracoes', 'geral')
  const companyRef = doc(db, 'empresas', empresaId)
  const batch = writeBatch(db)
  const now = serverTimestamp()
  batch.set(settingsRef, {
    ...settings,
    alteradoEm: now,
    alteradoPor: uid,
  }, { merge: true })
  batch.update(companyRef, {
    modulos: settings.modulos,
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: 'configuracoes',
    entidadeId: 'geral',
    acao: 'alterada',
    resumo: 'Configurações gerais atualizadas',
    uid,
    em: now,
  })
  await batch.commit()
}


export async function updateCompanyProfile(
  empresaId: string,
  uid: string,
  data: { nome: string; nomeFantasia: string; documento: string },
) {
  const companyRef = doc(db, 'empresas', empresaId)
  const batch = writeBatch(db)
  const now = serverTimestamp()
  batch.update(companyRef, {
    nome: data.nome.trim(),
    nomeFantasia: data.nomeFantasia.trim() || data.nome.trim(),
    documento: data.documento.trim(),
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: 'empresa',
    entidadeId: empresaId,
    acao: 'alterada',
    resumo: 'Dados institucionais atualizados',
    uid,
    em: now,
  })
  await batch.commit()
}

export async function addCompanyBranch(
  empresaId: string,
  uid: string,
  branches: Array<{ id: string; nome: string; ativo?: boolean }>,
  branchName: string,
) {
  const normalizedName = branchName.trim()
  if (!normalizedName) throw new Error('Informe o nome da filial.')
  const id = normalizeSearch(normalizedName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `filial-${Date.now()}`
  const next = [...branches, { id, nome: normalizedName, ativo: true }]
  const companyRef = doc(db, 'empresas', empresaId)
  const batch = writeBatch(db)
  const now = serverTimestamp()
  batch.update(companyRef, {
    filiais: next,
    alteradoEm: now,
    alteradoPor: uid,
  })
  batch.set(auditRef(empresaId), {
    entidade: 'empresa',
    entidadeId: empresaId,
    acao: 'filial_criada',
    resumo: normalizedName,
    uid,
    em: now,
  })
  await batch.commit()
}

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
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
  const nome = input.nome.trim()
  const nomeNormalizado = normalizeSearch(nome)
  const duplicate = await getDocs(query(
    collectionRef(empresaId, 'fornecedores'),
    where('nomeNormalizado', '==', nomeNormalizado),
    limit(1),
  ))
  if (!duplicate.empty) throw new Error('Já existe um fornecedor com este nome.')

  batch.set(ref, {
    ...input,
    nome,
    nomeNormalizado,
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
  const prefixo = input.prefixo?.trim().toUpperCase() || ''
  const nomeNormalizado = normalizeSearch(input.nome)

  const duplicateName = await getDocs(query(
    collectionRef(empresaId, 'categorias'),
    where('buscaNormalizada', '==', nomeNormalizado),
    limit(1),
  ))
  if (!duplicateName.empty) throw new Error('Já existe uma categoria com este nome.')

  if (prefixo) {
    const duplicatePrefix = await getDocs(query(
      collectionRef(empresaId, 'categorias'),
      where('prefixo', '==', prefixo),
      limit(1),
    ))
    if (!duplicatePrefix.empty) throw new Error('Este prefixo já está sendo usado por outra categoria.')
  }

  batch.set(ref, {
    ...input,
    nome: input.nome.trim(),
    prefixo,
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
  const descricaoNormalizada = normalizeSearch(input.descricao)
  const duplicateDescription = await getDocs(query(
    collectionRef(empresaId, 'materiais'),
    where('descricaoNormalizada', '==', descricaoNormalizada),
    limit(1),
  ))
  if (!duplicateDescription.empty) throw new Error('Já existe um material com esta descrição.')

  const duplicateCode = await getDocs(query(
    collectionRef(empresaId, 'materiais'),
    where('codigo', '==', input.codigo.trim().toUpperCase()),
    limit(1),
  ))
  if (!duplicateCode.empty) throw new Error('Já existe um material com este código.')

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

export async function updateMaterial(
  empresaId: string,
  uid: string,
  materialId: string,
  input: Omit<Material, 'id' | 'ativo' | 'buscaNormalizada'>,
) {
  const codigo = input.codigo.trim().toUpperCase()
  const descricao = input.descricao.trim()
  const descricaoNormalizada = normalizeSearch(descricao)

  const [descriptionMatches, codeMatches] = await Promise.all([
    getDocs(query(
      collectionRef(empresaId, 'materiais'),
      where('descricaoNormalizada', '==', descricaoNormalizada),
      limit(2),
    )),
    getDocs(query(
      collectionRef(empresaId, 'materiais'),
      where('codigo', '==', codigo),
      limit(2),
    )),
  ])

  if (descriptionMatches.docs.some((item) => item.id !== materialId)) {
    throw new Error('Já existe outro material com esta descrição.')
  }

  if (codeMatches.docs.some((item) => item.id !== materialId)) {
    throw new Error('Já existe outro material com este código.')
  }

  const fornecedores = (input.fornecedores as MaterialSupplier[]).map((item) => ({
    fornecedorId: item.fornecedorId,
    nomeSnapshot: item.nomeSnapshot,
    principal: item.principal,
    referenciaFornecedor: item.referenciaFornecedor ?? '',
  }))

  if (fornecedores.filter((item) => item.principal).length > 1) {
    throw new Error('Defina no máximo um fornecedor principal.')
  }

  const ref = doc(db, 'empresas', empresaId, 'materiais', materialId)
  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.update(ref, {
    codigo,
    codigoLegado: input.codigoLegado?.trim() ?? '',
    descricao,
    descricaoNormalizada,
    categoriaId: input.categoriaId ?? '',
    categoria: input.categoria.trim(),
    unidade: input.unidade.trim(),
    fornecedores,
    custoUnitario: input.custoUnitario ?? null,
    leadTimeDias: input.leadTimeDias ?? null,
    loteMinimo: input.loteMinimo ?? null,
    observacao: input.observacao?.trim() ?? '',
    buscaNormalizada: normalizeSearch([
      codigo,
      input.codigoLegado,
      descricao,
      input.categoria,
      ...fornecedores.map((item) => item.nomeSnapshot),
    ].filter(Boolean).join(' ')),
    alteradoEm: now,
    alteradoPor: uid,
  })

  batch.set(auditRef(empresaId), {
    entidade: 'material',
    entidadeId: materialId,
    acao: 'alterado',
    resumo: `${codigo} · ${descricao}`,
    uid,
    em: now,
  })

  await batch.commit()
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


export async function updateSupplier(
  empresaId: string,
  uid: string,
  supplierId: string,
  input: Omit<Supplier, 'id' | 'ativo'>,
) {
  const nome = input.nome.trim()
  const nomeNormalizado = normalizeSearch(nome)
  const duplicate = await getDocs(query(
    collectionRef(empresaId, 'fornecedores'),
    where('nomeNormalizado', '==', nomeNormalizado),
    limit(2),
  ))

  if (duplicate.docs.some((item) => item.id !== supplierId)) {
    throw new Error('Já existe outro fornecedor com este nome.')
  }

  await updateTenantDocument(
    empresaId,
    uid,
    'fornecedores',
    supplierId,
    {
      ...input,
      nome,
      nomeNormalizado,
      buscaNormalizada: normalizeSearch([
        nome,
        input.contato,
        input.email,
        input.telefone,
      ].filter(Boolean).join(' ')),
    },
    nome,
  )
}

export async function setSupplierActive(
  empresaId: string,
  uid: string,
  supplierId: string,
  ativo: boolean,
  label: string,
) {
  await setActiveState(
    empresaId,
    uid,
    'fornecedores',
    supplierId,
    ativo,
    label,
  )
}

export async function updateCategory(
  empresaId: string,
  uid: string,
  categoryId: string,
  input: Omit<Category, 'id' | 'ativo'>,
) {
  if (input.parentId === categoryId) {
    throw new Error('Uma categoria não pode ser filha dela mesma.')
  }

  const nome = input.nome.trim()
  const nomeNormalizado = normalizeSearch(nome)
  const prefixo = input.prefixo?.trim().toUpperCase() || ''

  const [allCategoriesSnap, duplicateName] = await Promise.all([
    getDocs(collectionRef(empresaId, 'categorias')),
    getDocs(query(
      collectionRef(empresaId, 'categorias'),
      where('buscaNormalizada', '==', nomeNormalizado),
      limit(2),
    )),
  ])

  if (duplicateName.docs.some((item) => item.id !== categoryId)) {
    throw new Error('Já existe outra categoria com este nome.')
  }

  if (prefixo) {
    const duplicatePrefix = await getDocs(query(
      collectionRef(empresaId, 'categorias'),
      where('prefixo', '==', prefixo),
      limit(2),
    ))
    if (duplicatePrefix.docs.some((item) => item.id !== categoryId)) {
      throw new Error('Este prefixo já está sendo usado por outra categoria.')
    }
  }

  const categories = new Map(
    allCategoriesSnap.docs.map((item) => [
      item.id,
      { id: item.id, ...item.data() } as Category,
    ]),
  )

  if (!categories.has(categoryId)) {
    throw new Error('Categoria não encontrada.')
  }

  if (input.parentId) {
    const parent = categories.get(input.parentId)
    if (!parent || !parent.ativo) {
      throw new Error('Selecione uma categoria pai ativa.')
    }

    let cursor: string | null = input.parentId
    const visited = new Set<string>()

    while (cursor) {
      if (cursor === categoryId) {
        throw new Error('Essa alteração criaria um ciclo na árvore de categorias.')
      }
      if (visited.has(cursor)) {
        throw new Error('A árvore de categorias atual já possui um ciclo e precisa ser corrigida.')
      }
      visited.add(cursor)
      cursor = categories.get(cursor)?.parentId ?? null
    }
  }

  const parentLevel = input.parentId
    ? Number(categories.get(input.parentId)?.nivel ?? 0)
    : 0
  const nextLevel = parentLevel + 1

  const childrenByParent = new Map<string, string[]>()
  for (const category of categories.values()) {
    if (!category.parentId) continue
    const list = childrenByParent.get(category.parentId) ?? []
    list.push(category.id)
    childrenByParent.set(category.parentId, list)
  }

  const descendantUpdates: Array<{ id: string; nivel: number }> = []
  const queue = (childrenByParent.get(categoryId) ?? []).map((id) => ({
    id,
    nivel: nextLevel + 1,
  }))
  const visitedDescendants = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visitedDescendants.has(current.id)) {
      throw new Error('A árvore possui um ciclo entre categorias descendentes.')
    }
    visitedDescendants.add(current.id)
    descendantUpdates.push(current)

    for (const childId of childrenByParent.get(current.id) ?? []) {
      queue.push({ id: childId, nivel: current.nivel + 1 })
    }
  }

  if (descendantUpdates.length > 450) {
    throw new Error('A categoria possui muitos descendentes para uma única alteração.')
  }

  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.update(
    doc(db, 'empresas', empresaId, 'categorias', categoryId),
    {
      nome,
      parentId: input.parentId,
      nivel: nextLevel,
      prefixo,
      buscaNormalizada: nomeNormalizado,
      alteradoEm: now,
      alteradoPor: uid,
    },
  )

  for (const descendant of descendantUpdates) {
    batch.update(
      doc(db, 'empresas', empresaId, 'categorias', descendant.id),
      {
        nivel: descendant.nivel,
        alteradoEm: now,
        alteradoPor: uid,
      },
    )
  }

  batch.set(auditRef(empresaId), {
    entidade: 'categorias',
    entidadeId: categoryId,
    acao: 'alterado',
    resumo: nome,
    uid,
    em: now,
  })

  await batch.commit()
}

export async function setCategoryActive(
  empresaId: string,
  uid: string,
  categoryId: string,
  ativo: boolean,
  label: string,
) {
  if (!ativo) {
    const used = await getDocs(query(
      collectionRef(empresaId, 'materiais'),
      where('categoriaId', '==', categoryId),
      where('ativo', '==', true),
      limit(1),
    ))
    if (!used.empty) {
      throw new Error('Não é possível inativar uma categoria usada por material ativo.')
    }
  }

  await setActiveState(
    empresaId,
    uid,
    'categorias',
    categoryId,
    ativo,
    label,
  )
}


export async function importMaterialsBatch(
  empresaId: string,
  uid: string,
  rows: Array<Omit<Material, 'id' | 'ativo' | 'buscaNormalizada'>>,
) {
  if (rows.length === 0) return
  if (rows.length > 200) {
    throw new Error('Importe no máximo 200 materiais por arquivo.')
  }

  const batch = writeBatch(db)
  const now = serverTimestamp()

  for (const input of rows) {
    const ref = doc(collectionRef(empresaId, 'materiais'))
    const fornecedores = (input.fornecedores as MaterialSupplier[]).map((item) => ({
      fornecedorId: item.fornecedorId,
      nomeSnapshot: item.nomeSnapshot,
      principal: item.principal,
      referenciaFornecedor: item.referenciaFornecedor ?? '',
    }))
    const codigo = input.codigo.trim().toUpperCase()
    const descricao = input.descricao.trim()

    batch.set(ref, {
      ...input,
      codigo,
      descricao,
      descricaoNormalizada: normalizeSearch(descricao),
      categoria: input.categoria.trim(),
      unidade: input.unidade.trim(),
      fornecedores,
      buscaNormalizada: normalizeSearch([
        codigo,
        input.codigoLegado,
        descricao,
        input.categoria,
        ...fornecedores.map((item) => item.nomeSnapshot),
      ].filter(Boolean).join(' ')),
      ativo: true,
      criadoEm: now,
      criadoPor: uid,
      alteradoEm: now,
      alteradoPor: uid,
    })
  }

  batch.set(auditRef(empresaId), {
    entidade: 'material',
    entidadeId: 'importacao',
    acao: 'importacao_csv',
    resumo: `${rows.length} material(is) importado(s)`,
    uid,
    em: now,
  })

  await batch.commit()
}

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  collection,
} from 'firebase/firestore'
import { db } from './config'
import { generateCode, type CodeStrategy } from '../domain/codeEngine'

export type ProductCodeInput = {
  manual?: string
  external?: string
  segmentValues?: Record<string, string>
}

export async function generateNextProductCode(
  empresaId: string,
  strategy: CodeStrategy,
  input: ProductCodeInput,
) {
  if (strategy.tipo === 'sequencial') {
    const counterRef = doc(db, 'empresas', empresaId, 'contadores', 'produtos')
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef)
      const last = snap.exists() ? Number(snap.data().ultimo ?? 0) : 0
      const next = last + 1
      transaction.set(counterRef, {
        ultimo: next,
        alteradoEm: serverTimestamp(),
      }, { merge: true })
      return generateCode(strategy, { proximoSequencial: next })
    })
  }

  if (strategy.tipo === 'segmentado') {
    return generateCode(strategy, { valores: input.segmentValues ?? {} })
  }

  if (strategy.tipo === 'externo') {
    return generateCode(strategy, { codigoExterno: input.external ?? '' })
  }

  return generateCode(strategy, { codigoManual: input.manual ?? '' })
}

export async function createProduct(
  empresaId: string,
  uid: string,
  data: {
    codigo: string
    descricao: string
    classificacoes: Record<string, string>
  },
) {
  const productRef = doc(db, 'empresas', empresaId, 'produtos', data.codigo)
  const existing = await getDoc(productRef)
  if (existing.exists()) throw new Error('Já existe um produto com este código.')

  const batch = writeBatch(db)
  const now = serverTimestamp()
  batch.set(productRef, {
    codigo: data.codigo,
    descricao: data.descricao.trim(),
    classificacoes: data.classificacoes,
    revisaoVigente: null,
    status: 'ativo',
    ativo: true,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })

  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  batch.set(auditRef, {
    entidade: 'produto',
    entidadeId: data.codigo,
    acao: 'criado',
    resumo: `${data.codigo} · ${data.descricao.trim()}`,
    uid,
    em: now,
  })

  await batch.commit()
}

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './config'

export const tenantPath = (empresaId: string, collectionName: string) =>
  `empresas/${empresaId}/${collectionName}`

export async function listTenantDocs<T>(empresaId: string, collectionName: string, pageSize = 25) {
  const ref = collection(db, tenantPath(empresaId, collectionName))
  const snap = await getDocs(query(ref, orderBy('alteradoEm', 'desc'), limit(pageSize)))
  return snap.docs.map((item) => ({ id: item.id, ...item.data() } as T & { id: string }))
}

export async function createTenantDoc<T extends Record<string, unknown>>(
  empresaId: string,
  collectionName: string,
  payload: T,
  uid: string,
) {
  const ref = collection(db, tenantPath(empresaId, collectionName))
  return addDoc(ref, {
    ...payload,
    empresaId,
    ativo: payload.ativo ?? true,
    criadoEm: serverTimestamp(),
    criadoPor: uid,
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
}

export async function setTenantDoc<T extends Record<string, unknown>>(
  empresaId: string,
  collectionName: string,
  id: string,
  payload: T,
  uid: string,
) {
  const ref = doc(db, tenantPath(empresaId, collectionName), id)
  await setDoc(ref, {
    ...payload,
    empresaId,
    criadoEm: serverTimestamp(),
    criadoPor: uid,
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
  return ref
}

export async function updateTenantDoc<T extends Record<string, unknown>>(
  empresaId: string,
  collectionName: string,
  id: string,
  payload: T,
  uid: string,
) {
  const ref = doc(db, tenantPath(empresaId, collectionName), id)
  await updateDoc(ref, {
    ...payload,
    empresaId,
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
}

export async function getTenantDoc<T>(empresaId: string, collectionName: string, id: string) {
  const ref = doc(db, tenantPath(empresaId, collectionName), id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T & { id: string }
}

export async function inactivateTenantDoc(
  empresaId: string,
  collectionName: string,
  id: string,
  uid: string,
) {
  const ref = doc(db, tenantPath(empresaId, collectionName), id)
  return updateDoc(ref, {
    ativo: false,
    alteradoEm: serverTimestamp(),
    alteradoPor: uid,
  })
}

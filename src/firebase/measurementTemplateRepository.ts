import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import type { TechnicalRevision } from '../domain/types'

export async function createMeasurementTemplate(
  empresaId: string,
  uid: string,
  nome: string,
  revision: TechnicalRevision,
) {
  const cleanName = nome.trim()
  if (!cleanName) throw new Error('Informe um nome para o modelo.')
  if (revision.tamanhos.length === 0) throw new Error('A ficha não possui grade para salvar.')

  const templateRef = doc(collection(db, 'empresas', empresaId, 'modelosMedidas'))
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  const now = serverTimestamp()
  const batch = writeBatch(db)

  batch.set(templateRef, {
    nome: cleanName,
    tamanhos: [...revision.tamanhos],
    pontos: revision.medidas.map((row) => ({
      ponto: row.ponto,
      tolerancia: Number(row.tolerancia || 0),
    })),
    ativo: true,
    criadoEm: now,
    criadoPor: uid,
    alteradoEm: now,
    alteradoPor: uid,
  })

  batch.set(auditRef, {
    entidade: 'modelo_medidas',
    entidadeId: templateRef.id,
    acao: 'criado',
    resumo: cleanName,
    uid,
    em: now,
  })

  await batch.commit()
  return templateRef.id
}

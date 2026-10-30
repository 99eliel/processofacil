import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { storage } from './config'

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function uploadTechnicalSheetImage(
  empresaId: string,
  produtoCodigo: string,
  revisao: number,
  file: File,
) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.')
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 8 MB.')
  }

  const path = [
    'empresas',
    empresaId,
    'fichas',
    produtoCodigo,
    'revisoes',
    String(revisao).padStart(3, '0'),
    `${crypto.randomUUID()}-${safeFileName(file.name || 'imagem')}`,
  ].join('/')

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      empresaId,
      produtoCodigo,
      revisao: String(revisao),
    },
  })

  const url = await getDownloadURL(storageRef)
  return { url, path }
}

export async function deleteTechnicalSheetImage(path: string) {
  if (!path) return
  await deleteObject(ref(storage, path))
}


export async function uploadOperationMedia(
  empresaId: string,
  produtoCodigo: string,
  revisao: number,
  operacaoId: string,
  file: File,
) {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    throw new Error('Envie uma imagem ou vídeo.')
  }

  const maxSize = isVideo ? 120 * 1024 * 1024 : 8 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error(isVideo ? 'O vídeo deve ter no máximo 120 MB.' : 'A imagem deve ter no máximo 8 MB.')
  }

  const path = [
    'empresas',
    empresaId,
    'fichas',
    produtoCodigo,
    'revisoes',
    String(revisao).padStart(3, '0'),
    'operacoes',
    operacaoId,
    `${crypto.randomUUID()}-${safeFileName(file.name || (isVideo ? 'video' : 'imagem'))}`,
  ].join('/')

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      empresaId,
      produtoCodigo,
      revisao: String(revisao),
      operacaoId,
      tipo: isVideo ? 'video' : 'imagem',
    },
  })

  const url = await getDownloadURL(storageRef)
  return {
    url,
    path,
    tipo: (isVideo ? 'video' : 'imagem') as 'video' | 'imagem',
  }
}

export async function deleteOperationMedia(path: string) {
  if (!path) return
  await deleteObject(ref(storage, path))
}


export async function uploadTechnicalAttachment(
  empresaId: string,
  produtoCodigo: string,
  revisao: number,
  tipo: string,
  file: File,
) {
  if (file.size > 130 * 1024 * 1024) throw new Error('O anexo deve ter no máximo 130 MB.')

  const path = [
    'empresas',
    empresaId,
    'fichas',
    produtoCodigo,
    'revisoes',
    String(revisao).padStart(3, '0'),
    'anexos',
    tipo,
    `${crypto.randomUUID()}-${safeFileName(file.name || tipo)}`,
  ].join('/')

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: { empresaId, produtoCodigo, revisao: String(revisao), tipo },
  })

  return { url: await getDownloadURL(storageRef), path }
}

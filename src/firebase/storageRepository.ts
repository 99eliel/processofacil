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

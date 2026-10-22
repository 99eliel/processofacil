import { collection, getDocs } from 'firebase/firestore'
import { db } from './config'

export type MaterialUsage = {
  id: string
  materialId: string
  produtoCodigo: string
  produtoDescricao: string
  revisao: number
  ativo: boolean
}

export async function listMaterialUsage(
  empresaId: string,
  materialId: string,
) {
  const ref = collection(
    db,
    'empresas',
    empresaId,
    'usoMateriais',
    materialId,
    'produtos',
  )
  const snap = await getDocs(ref)

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as MaterialUsage))
    .filter((item) => item.ativo)
    .sort((a, b) =>
      a.produtoCodigo.localeCompare(b.produtoCodigo, 'pt-BR'),
    )
}

import type { Material } from './types'

/** O catálogo pode conter importações antigas com códigos duplicados; a seleção da BOM não deve repetir opções. */
export function uniqueActiveMaterials<T extends Pick<Material, 'id' | 'codigo' | 'ativo'>>(materials: T[]): T[] {
  const unique = new Map<string, T>()
  for (const material of materials) {
    if (!material.ativo) continue
    const key = material.codigo?.trim().toLocaleUpperCase('pt-BR') || material.id
    if (!unique.has(key)) unique.set(key, material)
  }
  return [...unique.values()]
}

export function normalizeMaterialSearch(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

export function filterMaterialOptions<T extends Pick<Material, 'codigo' | 'descricao' | 'categoria' | 'unidade' | 'codigoLegado'>>(
  materials: T[],
  query: string,
): T[] {
  const term = normalizeMaterialSearch(query)
  if (!term) return materials
  const terms = term.split(/\s+/).filter(Boolean)
  return materials.filter((material) => {
    const text = normalizeMaterialSearch([
      material.codigo, material.codigoLegado ?? '', material.descricao, material.categoria, material.unidade,
    ].join(' '))
    return terms.every((word) => text.includes(word))
  })
}

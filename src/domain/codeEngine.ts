export type SegmentDefinition = {
  id: string
  nome: string
  tamanho: number
  ordem: number
  obrigatorio: boolean
}

export type SegmentedStrategy = {
  tipo: 'segmentado'
  segmentos: SegmentDefinition[]
  separador?: string
}

export type SequentialStrategy = {
  tipo: 'sequencial'
  prefixo?: string
  digitos: number
}

export type ManualStrategy = { tipo: 'manual' }
export type ExternalStrategy = { tipo: 'externo' }
export type CodeStrategy = SegmentedStrategy | SequentialStrategy | ManualStrategy | ExternalStrategy

export type GenerateCodeInput = {
  valores?: Record<string, string>
  proximoSequencial?: number
  codigoManual?: string
  codigoExterno?: string
}

export function normalizeCodeToken(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, '')
}

export function generateCode(strategy: CodeStrategy, input: GenerateCodeInput) {
  if (strategy.tipo === 'segmentado') {
    const parts = [...strategy.segmentos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((segmento) => {
        const raw = input.valores?.[segmento.id] ?? ''
        const value = normalizeCodeToken(raw)
        if (!value && segmento.obrigatorio) throw new Error(`Segmento obrigatório: ${segmento.nome}`)
        if (value.length !== segmento.tamanho) {
          throw new Error(`${segmento.nome} deve ter exatamente ${segmento.tamanho} caracteres`)
        }
        return value
      })
    return parts.join(strategy.separador ?? '')
  }

  if (strategy.tipo === 'sequencial') {
    if (!input.proximoSequencial || input.proximoSequencial < 1) throw new Error('Sequencial inválido')
    const body = String(input.proximoSequencial).padStart(strategy.digitos, '0')
    if (body.length > strategy.digitos) throw new Error('Sequencial excedeu o tamanho configurado')
    return `${normalizeCodeToken(strategy.prefixo ?? '')}${body}`
  }

  if (strategy.tipo === 'manual') {
    const code = normalizeCodeToken(input.codigoManual ?? '')
    if (!code) throw new Error('Informe o código manual')
    return code
  }

  const code = normalizeCodeToken(input.codigoExterno ?? '')
  if (!code) throw new Error('Informe o código externo')
  return code
}

export function buildMigrationPreview(ids: string[], generator: (id: string, index: number) => string) {
  const generated = ids.map((id, index) => ({ id, novoCodigo: generator(id, index) }))
  const duplicate = generated.find(
    (item, index) => generated.findIndex((other) => other.novoCodigo === item.novoCodigo) !== index,
  )
  if (duplicate) throw new Error(`Migração gerou código duplicado: ${duplicate.novoCodigo}`)
  return generated
}

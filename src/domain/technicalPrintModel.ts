import type { BomLine, TechnicalCuttingProcess } from './types.ts'

/** Títulos de impressão devem refletir a edição, sem reinterpretar valores salvos em chaves legadas. */
export function buildConsumptionPrintRows(data: TechnicalCuttingProcess): string[][] {
  return [
    ['MODELO', data.encaixe],
    ['GRADE ENCAIXADA', data.consumoTecido],
    ['COMPRIMENTO DO RISCO', data.comprimentoRisco],
    ['CONSUMO', data.alturaEnfesto],
    ['LARGURA DO TECIDO', data.numeroFolhas],
    ['APROVEITAMENTO', data.perdasPercentual],
  ].filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
}

export function materialColorPrintValue(line: BomLine): string {
  if (line.corRegra === 'fixa') return line.corFixa?.trim() || 'Cor fixa não informada'
  if (line.corRegra === 'produto') return 'Segue produto'
  return 'Não se aplica'
}

export type PrintMaterialDetail = { label: string; value: string }

export function buildMaterialPrintDetails(line: BomLine): PrintMaterialDetail[] {
  const number = Number(line.perdaPercentual)
  const details: PrintMaterialDetail[] = [
    ...(line.perdaPercentual != null && Number.isFinite(number)
      ? [{ label: 'PERDA', value: number.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' }] : []),
    { label: 'COR', value: materialColorPrintValue(line) },
    { label: 'OBSERVAÇÃO', value: line.observacao?.trim() || '' },
    { label: 'REF. FORNECEDOR', value: line.referenciaFornecedorSnapshot?.trim() || '' },
  ]
  return details.filter((item) => item.value.length > 0)
}

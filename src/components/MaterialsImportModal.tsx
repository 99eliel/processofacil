import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { importMaterialsBatch, normalizeSearch } from '../firebase/catalogRepository'
import { parseCsv, parseNumberPtBr, valueFromAliases, type CsvRow } from '../utils/csv'
import type { Category, Material, MaterialSupplier, Supplier } from '../domain/types'

type ValidatedRow = {
  index: number
  source: CsvRow
  codigo: string
  descricao: string
  categoria: string
  unidade: string
  errors: string[]
  payload?: Omit<Material, 'id' | 'ativo' | 'buscaNormalizada'>
}

const aliases = {
  codigo: ['codigo', 'código', 'codigo_material', 'cod_material', 'referencia', 'ref'],
  codigoLegado: ['codigo_legado', 'código_legado', 'legado', 'codigo_antigo'],
  descricao: ['descricao', 'descrição', 'material', 'nome', 'descricao_material'],
  categoria: ['categoria', 'grupo', 'subgrupo', 'categoria_material'],
  unidade: ['unidade', 'un', 'unidade_padrao', 'unidade_padrão'],
  fornecedor: ['fornecedor', 'fornecedor_principal', 'supplier'],
  referenciaFornecedor: ['referencia_fornecedor', 'ref_fornecedor', 'codigo_fornecedor'],
  custo: ['custo', 'custo_unitario', 'custo_unitário', 'preco', 'preço'],
  leadTime: ['lead_time', 'lead_time_dias', 'prazo_dias'],
  loteMinimo: ['lote_minimo', 'lote_mínimo', 'minimo_compra'],
  observacao: ['observacao', 'observação', 'obs'],
}

export default function MaterialsImportModal({
  onClose,
  notify,
}: {
  onClose: () => void
  notify: (message: string) => void
}) {
  const { activeCompany, settings, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: categories } = useTenantCollection<Category>(empresaId, 'categorias', 'nome')
  const { items: suppliers } = useTenantCollection<Supplier>(empresaId, 'fornecedores', 'nome')

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<CsvRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const validated = useMemo<ValidatedRow[]>(() => {
    const existingCodes = new Set(materials.map((item) => normalizeSearch(item.codigo)))
    const existingDescriptions = new Set(materials.map((item) => normalizeSearch(item.descricao)))
    const seenCodes = new Set<string>()
    const seenDescriptions = new Set<string>()

    const categoryMap = new Map(
      categories
        .filter((item) => item.ativo)
        .map((item) => [normalizeSearch(item.nome), item]),
    )

    const unitMap = new Map(
      settings.unidades
        .filter((item) => item.ativo)
        .flatMap((item) => [
          [normalizeSearch(item.simbolo), item],
          [normalizeSearch(item.nome), item],
        ]),
    )

    const supplierMap = new Map(
      suppliers
        .filter((item) => item.ativo)
        .map((item) => [normalizeSearch(item.nome), item]),
    )

    return rows.map((source, position) => {
      const errors: string[] = []
      const codigo = valueFromAliases(source, aliases.codigo).trim().toUpperCase()
      const descricao = valueFromAliases(source, aliases.descricao).trim()
      const categoriaRaw = valueFromAliases(source, aliases.categoria).trim()
      const unidadeRaw = valueFromAliases(source, aliases.unidade).trim()
      const fornecedorRaw = valueFromAliases(source, aliases.fornecedor).trim()
      const categoria = categoryMap.get(normalizeSearch(categoriaRaw))
      const unidade = unitMap.get(normalizeSearch(unidadeRaw))
      const fornecedor = fornecedorRaw
        ? supplierMap.get(normalizeSearch(fornecedorRaw))
        : undefined

      if (!codigo) errors.push('Código ausente')
      if (!descricao) errors.push('Descrição ausente')
      if (!categoriaRaw) errors.push('Categoria ausente')
      else if (!categoria) errors.push('Categoria não cadastrada')
      if (!unidadeRaw) errors.push('Unidade ausente')
      else if (!unidade) errors.push('Unidade não cadastrada')
      if (fornecedorRaw && !fornecedor) errors.push('Fornecedor não cadastrado')

      const codeKey = normalizeSearch(codigo)
      const descriptionKey = normalizeSearch(descricao)

      if (codigo && existingCodes.has(codeKey)) errors.push('Código já existe')
      if (descricao && existingDescriptions.has(descriptionKey)) errors.push('Descrição já existe')
      if (codigo && seenCodes.has(codeKey)) errors.push('Código repetido no arquivo')
      if (descricao && seenDescriptions.has(descriptionKey)) errors.push('Descrição repetida no arquivo')

      if (codigo) seenCodes.add(codeKey)
      if (descricao) seenDescriptions.add(descriptionKey)

      const custoRaw = valueFromAliases(source, aliases.custo)
      const leadRaw = valueFromAliases(source, aliases.leadTime)
      const loteRaw = valueFromAliases(source, aliases.loteMinimo)
      const custo = custoRaw ? parseNumberPtBr(custoRaw) : null
      const lead = leadRaw ? parseNumberPtBr(leadRaw) : null
      const lote = loteRaw ? parseNumberPtBr(loteRaw) : null

      if (custoRaw && custo == null) errors.push('Custo inválido')
      if (leadRaw && lead == null) errors.push('Lead time inválido')
      if (loteRaw && lote == null) errors.push('Lote mínimo inválido')

      const fornecedores: MaterialSupplier[] = fornecedor ? [{
        fornecedorId: fornecedor.id,
        nomeSnapshot: fornecedor.nome,
        principal: true,
        referenciaFornecedor: valueFromAliases(source, aliases.referenciaFornecedor).trim(),
      }] : []

      const payload = errors.length === 0 && categoria && unidade
        ? {
            codigo,
            codigoLegado: valueFromAliases(source, aliases.codigoLegado).trim() || undefined,
            descricao,
            categoriaId: categoria.id,
            categoria: categoria.nome,
            unidade: unidade.simbolo,
            fornecedores,
            custoUnitario: custo,
            leadTimeDias: lead,
            loteMinimo: lote,
            observacao: valueFromAliases(source, aliases.observacao).trim(),
          }
        : undefined

      return {
        index: position + 2,
        source,
        codigo,
        descricao,
        categoria: categoriaRaw,
        unidade: unidadeRaw,
        errors,
        payload,
      }
    })
  }, [rows, materials, categories, suppliers, settings.unidades])

  const validRows = validated.filter((item) => item.payload)
  const invalidRows = validated.filter((item) => item.errors.length > 0)

  const readFile = async (file: File) => {
    setError('')
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        throw new Error('O CSV não possui linhas de dados válidas.')
      }
      if (parsed.length > 200) {
        throw new Error('O arquivo possui mais de 200 linhas. Divida a importação em lotes.')
      }
      setRows(parsed)
    } catch (reason) {
      console.error(reason)
      setRows([])
      setError(reason instanceof Error ? reason.message : 'Não foi possível ler o CSV.')
    }
  }

  const importRows = async () => {
    if (!empresaId || !user || validRows.length === 0 || invalidRows.length > 0) return
    setBusy(true)
    setError('')
    try {
      await importMaterialsBatch(
        empresaId,
        user.uid,
        validRows.map((item) => item.payload!),
      )
      notify(`${validRows.length} material(is) importado(s) com sucesso.`)
      onClose()
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível importar os materiais.')
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = () => {
    const header = 'codigo;codigo_legado;descricao;categoria;unidade;fornecedor;referencia_fornecedor;custo_unitario;lead_time_dias;lote_minimo;observacao'
    const example = 'MAT-0001;;Material de exemplo;Categoria existente;un;Fornecedor existente;REF-01;10,50;7;5;Observação opcional'
    const blob = new Blob([header + '\n' + example + '\n'], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo_importacao_materiais.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className="modal-backdrop">
    <section className="form-modal import-modal">
      <div className="modal-head">
        <div>
          <span className="section-kicker">Importação controlada</span>
          <h2>Importar materiais por CSV</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="import-body">
        <div className="info-banner">
          <FileSpreadsheet size={20} />
          <div>
            <strong>Pré-validação antes de gravar</strong>
            <span>
              Categoria, unidade e fornecedor precisam existir no cadastro base.
              Nenhuma linha é importada enquanto houver erro no arquivo.
            </span>
          </div>
        </div>

        <div className="import-actions">
          <label className="secondary-button file-button">
            <Upload size={16} />
            Selecionar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) readFile(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <button type="button" className="text-button" onClick={downloadTemplate}>
            <Download size={15} /> Baixar modelo CSV
          </button>
          {fileName && <span className="import-file-name">{fileName}</span>}
        </div>

        {error && <div className="form-error">{error}</div>}

        {rows.length > 0 && <>
          <div className="import-summary">
            <div><strong>{rows.length}</strong><span>linhas</span></div>
            <div className="success"><strong>{validRows.length}</strong><span>válidas</span></div>
            <div className={invalidRows.length ? 'danger' : 'success'}><strong>{invalidRows.length}</strong><span>com erro</span></div>
          </div>

          <div className="table-wrap import-preview">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                  <th>Validação</th>
                </tr>
              </thead>
              <tbody>
                {validated.slice(0, 100).map((item) => (
                  <tr key={item.index} className={item.errors.length ? 'import-row-error' : ''}>
                    <td>{item.index}</td>
                    <td><strong>{item.codigo || '—'}</strong></td>
                    <td>{item.descricao || '—'}</td>
                    <td>{item.categoria || '—'}</td>
                    <td>{item.unidade || '—'}</td>
                    <td>
                      {item.errors.length === 0
                        ? <span className="import-ok"><CheckCircle2 size={14} /> Pronta</span>
                        : <span className="import-error"><AlertTriangle size={14} /> {item.errors.join(' · ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validated.length > 100 && (
            <p className="helper-text">Prévia limitada às primeiras 100 linhas. Todas as {validated.length} linhas foram validadas.</p>
          )}
        </>}
      </div>

      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={importRows}
          disabled={busy || validRows.length === 0 || invalidRows.length > 0}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
          Importar {validRows.length || ''} material(is)
        </button>
      </div>
    </section>
  </div>
}

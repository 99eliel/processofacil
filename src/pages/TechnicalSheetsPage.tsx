import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  ImagePlus,
  ListChecks,
  Loader2,
  PackagePlus,
  Plus,
  Printer,
  Ruler,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import {
  createBomLine,
  getTechnicalRevision,
  listTechnicalRevisions,
  openOrCreateTechnicalDraft,
  publishTechnicalRevision,
  returnTechnicalRevisionToDraft,
  saveTechnicalDraft,
  submitTechnicalRevision,
} from '../firebase/technicalSheetRepository'
import { deleteTechnicalSheetImage, uploadTechnicalSheetImage } from '../firebase/storageRepository'
import type { BomLine, Material, MaterialSupplier, Product, TechnicalRevision, TechnicalSheetSummary } from '../domain/types'

export default function TechnicalSheetsPage({ notify }: { notify: (message: string) => void }) {
  const auth = useSystem()
  const empresaId = auth.activeCompany?.id
  const user = auth.user
  const { items: products } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: materials } = useTenantCollection<Material>(empresaId, 'materiais', 'descricao')
  const { items: summaries, loading, error } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [editor, setEditor] = useState<TechnicalRevision | null>(null)
  const [history, setHistory] = useState<TechnicalRevision[]>([])
  const [busy, setBusy] = useState(false)
  const [materialToAdd, setMaterialToAdd] = useState('')
  const [newSize, setNewSize] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [localError, setLocalError] = useState('')

  const selectedProduct = products.find((item) => item.codigo === selectedProductCode)
  const editable = editor?.status === 'rascunho'
  const canPublish = (auth.activeMembership?.perfis ?? []).some((role) => ['admin', 'ppcp', 'planejamento'].includes(role))
  const summaryByCode = useMemo(() => new Map(summaries.map((item) => [item.produtoCodigo, item])), [summaries])

  const refreshHistory = async (codigo: string) => {
    if (!empresaId) return
    setHistory(await listTechnicalRevisions(empresaId, codigo))
  }

  useEffect(() => {
    if (editor) refreshHistory(editor.produtoCodigo).catch(console.error)
  }, [editor?.produtoCodigo, editor?.numero])

  const openOrCreate = async (product: Product) => {
    if (!empresaId || !user) return
    setBusy(true)
    setLocalError('')
    try {
      const revision = await openOrCreateTechnicalDraft(empresaId, user.uid, product)
      setEditor(revision)
      setSelectedProductCode(product.codigo)
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível abrir a ficha.')
    } finally {
      setBusy(false)
    }
  }

  const openSummary = async (summary: TechnicalSheetSummary) => {
    if (!empresaId) return
    const numero = summary.revisaoRascunho ?? summary.revisaoVigente
    if (!numero) return
    setBusy(true)
    try {
      const revision = await getTechnicalRevision(empresaId, summary.produtoCodigo, numero)
      if (revision) {
        setEditor(revision)
        setSelectedProductCode(summary.produtoCodigo)
      }
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!empresaId || !user || !editor) return
    setBusy(true)
    setLocalError('')
    try {
      await saveTechnicalDraft(empresaId, user.uid, editor)
      notify('Rascunho salvo.')
      await refreshHistory(editor.produtoCodigo)
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!empresaId || !user || !editor) return
    if (editor.numero > 1 && !editor.motivoRevisao?.trim()) {
      setLocalError('Informe o motivo da revisão antes de enviar para validação.')
      return
    }
    setBusy(true)
    setLocalError('')
    try {
      await saveTechnicalDraft(empresaId, user.uid, editor)
      await submitTechnicalRevision(empresaId, user.uid, editor)
      setEditor({ ...editor, status: 'em_validacao' })
      notify('Ficha enviada para validação.')
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível enviar.')
    } finally {
      setBusy(false)
    }
  }

  const returnToDraft = async () => {
    if (!empresaId || !user || !editor) return
    setBusy(true)
    try {
      await returnTechnicalRevisionToDraft(empresaId, user.uid, editor)
      setEditor({ ...editor, status: 'rascunho' })
      notify('Revisão devolvida para edição.')
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (!empresaId || !user || !editor) return
    setBusy(true)
    setLocalError('')
    try {
      await publishTechnicalRevision(empresaId, user.uid, editor)
      setEditor({ ...editor, status: 'padrao' })
      notify('Revisão publicada como padrão.')
      await refreshHistory(editor.produtoCodigo)
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível publicar.')
    } finally {
      setBusy(false)
    }
  }

  const addMaterial = () => {
    if (!editor || !editable) return
    const material = materials.find((item) => item.id === materialToAdd)
    if (!material) return
    setEditor({ ...editor, bom: [...editor.bom, createBomLine(material)] })
    setMaterialToAdd('')
  }

  const updateBom = (id: string, patch: Partial<BomLine>) => {
    if (!editor || !editable) return
    setEditor({ ...editor, bom: editor.bom.map((line) => line.id === id ? { ...line, ...patch } : line) })
  }

  const removeBom = (id: string) => {
    if (!editor || !editable) return
    setEditor({ ...editor, bom: editor.bom.filter((line) => line.id !== id) })
  }

  const setBomSupplier = (line: BomLine, fornecedorId: string) => {
    if (!editor || !editable) return
    const material = materials.find((item) => item.id === line.materialId)
    const supplier = material?.fornecedores.find(
      (item) => typeof item !== 'string' && item.fornecedorId === fornecedorId,
    )

    updateBom(line.id, {
      fornecedorId: typeof supplier === 'object' ? supplier.fornecedorId : undefined,
      fornecedorSnapshot: typeof supplier === 'object' ? supplier.nomeSnapshot : undefined,
      referenciaFornecedorSnapshot: typeof supplier === 'object'
        ? supplier.referenciaFornecedor
        : undefined,
    })
  }

  const toggleVariableConsumption = (line: BomLine) => {
    if (!editor || !editable) return
    const enabled = line.consumoPorTamanho
      && Object.keys(line.consumoPorTamanho).length > 0

    updateBom(line.id, {
      consumoPorTamanho: enabled
        ? {}
        : Object.fromEntries(
            editor.tamanhos.map((size) => [size, Number(line.consumo)]),
          ),
    })
  }

  const updateVariableConsumption = (
    lineId: string,
    size: string,
    value: number,
  ) => {
    if (!editor || !editable) return
    const line = editor.bom.find((item) => item.id === lineId)
    if (!line) return
    updateBom(lineId, {
      consumoPorTamanho: {
        ...(line.consumoPorTamanho ?? {}),
        [size]: value,
      },
    })
  }

  const addSize = () => {
    if (!editor || !editable) return
    const size = newSize.trim()
    if (!size || editor.tamanhos.includes(size)) return
    setEditor({
      ...editor,
      tamanhos: [...editor.tamanhos, size],
      medidas: editor.medidas.map((row) => ({
        ...row,
        valores: [...row.valores, { tamanho: size, valor: null }],
      })),
    })
    setNewSize('')
  }

  const removeSize = (size: string) => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      tamanhos: editor.tamanhos.filter((item) => item !== size),
      medidas: editor.medidas.map((row) => ({
        ...row,
        valores: row.valores.filter((item) => item.tamanho !== size),
      })),
    })
  }

  const addMeasurementRow = () => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      medidas: [
        ...editor.medidas,
        {
          id: crypto.randomUUID(),
          ponto: '',
          tolerancia: 0,
          valores: editor.tamanhos.map((size) => ({
            tamanho: size,
            valor: null,
          })),
        },
      ],
    })
  }

  const updateMeasurementRow = (
    rowId: string,
    patch: Partial<TechnicalRevision['medidas'][number]>,
  ) => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      medidas: editor.medidas.map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      ),
    })
  }

  const updateMeasurementValue = (
    rowId: string,
    size: string,
    value: number | null,
  ) => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      medidas: editor.medidas.map((row) =>
        row.id === rowId
          ? {
              ...row,
              valores: row.valores.map((item) =>
                item.tamanho === size ? { ...item, valor: value } : item,
              ),
            }
          : row,
      ),
    })
  }

  const removeMeasurementRow = (rowId: string) => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      medidas: editor.medidas.filter((row) => row.id !== rowId),
    })
  }

  const addChecklistItem = () => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      checklist: [
        ...editor.checklist,
        {
          id: crypto.randomUUID(),
          descricao: '',
          obrigatorio: true,
        },
      ],
    })
  }

  const updateChecklistItem = (
    id: string,
    patch: Partial<TechnicalRevision['checklist'][number]>,
  ) => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      checklist: editor.checklist.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  }

  const removeChecklistItem = (id: string) => {
    if (!editor || !editable) return
    setEditor({
      ...editor,
      checklist: editor.checklist.filter((item) => item.id !== id),
    })
  }

  const uploadImage = async (file: File) => {
    if (!editor || !editable || !empresaId || !user) return
    if (editor.imagens.length >= 6) {
      setLocalError('A revisão aceita no máximo 6 imagens.')
      return
    }

    setUploadingImage(true)
    setLocalError('')
    let uploadedPath = ''

    try {
      const uploaded = await uploadTechnicalSheetImage(
        empresaId,
        editor.produtoCodigo,
        editor.numero,
        file,
      )
      uploadedPath = uploaded.path

      const nextEditor: TechnicalRevision = {
        ...editor,
        imagens: [
          ...editor.imagens,
          {
            url: uploaded.url,
            path: uploaded.path,
            legenda: '',
            ordem: editor.imagens.length + 1,
          },
        ],
      }

      await saveTechnicalDraft(empresaId, user.uid, nextEditor)
      setEditor(nextEditor)
      notify('Imagem adicionada e vinculada ao rascunho.')
    } catch (reason) {
      console.error(reason)
      if (uploadedPath) {
        try {
          await deleteTechnicalSheetImage(uploadedPath)
        } catch (cleanupError) {
          console.warn('Não foi possível limpar o upload incompleto.', cleanupError)
        }
      }
      setLocalError(
        reason instanceof Error ? reason.message : 'Não foi possível enviar a imagem.',
      )
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async (index: number) => {
    if (!editor || !editable || !empresaId || !user) return
    const image = editor.imagens[index]
    const nextEditor: TechnicalRevision = {
      ...editor,
      imagens: editor.imagens
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, ordem: itemIndex + 1 })),
    }

    try {
      await saveTechnicalDraft(empresaId, user.uid, nextEditor)
      setEditor(nextEditor)

      if (image.path) {
        try {
          await deleteTechnicalSheetImage(image.path)
        } catch (cleanupError) {
          console.warn('Referência removida, mas o arquivo não pôde ser limpo.', cleanupError)
        }
      }

      notify('Imagem removida da revisão.')
    } catch (reason) {
      console.error(reason)
      setLocalError('Não foi possível atualizar a revisão antes de remover a imagem.')
    }
  }

  if (editor) {
    const currentProduct = products.find((item) => item.codigo === editor.produtoCodigo)
    return <>
      <button className="back-link" onClick={() => { setEditor(null); setLocalError('') }}><ArrowLeft size={16} /> Voltar para fichas</button>
      <section className="passport-header">
        <div className="passport-thumb"><FileText size={27} /></div>
        <div className="passport-main">
          <span className="section-kicker">{editor.produtoCodigo}</span>
          <h2>{editor.produtoDescricao}</h2>
          <div className="passport-meta">
            <Status status={editor.status} />
            <span>REV {String(editor.numero).padStart(2, '0')}</span>
            <span>{editor.bom.length} itens na BOM</span>
          </div>
        </div>
        <div className="passport-actions">
          <button className="secondary-button print-hidden" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
          {editable && <button className="secondary-button" onClick={save} disabled={busy}><Save size={16} /> Salvar</button>}
          {editable && <button className="primary-button" onClick={submit} disabled={busy}><Send size={16} /> Enviar validação</button>}
          {editor.status === 'em_validacao' && <button className="secondary-button" onClick={returnToDraft} disabled={busy}>Devolver</button>}
          {editor.status === 'em_validacao' && canPublish && <button className="primary-button" onClick={publish} disabled={busy}><ShieldCheck size={16} /> Publicar padrão</button>}
          {editor.status === 'padrao' && currentProduct && <button className="primary-button" onClick={() => openOrCreate(currentProduct)} disabled={busy}><Plus size={16} /> Nova revisão</button>}
        </div>
      </section>

      {localError && <div className="form-error page-message">{localError}</div>}

      <div className="two-columns ft-editor-grid">
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Identificação</span><h3>Construção / processo</h3></div><ClipboardCheck size={20} /></div>
          {editor.numero > 1 && <label className="editor-label"><span>Motivo da revisão *</span><input value={editor.motivoRevisao ?? ''} onChange={(e) => editable && setEditor({ ...editor, motivoRevisao: e.target.value })} disabled={!editable} placeholder="O que mudou nesta revisão?" /></label>}
          <label className="editor-label"><span>Descrição de construção/processo *</span><textarea rows={10} value={editor.construcao} onChange={(e) => editable && setEditor({ ...editor, construcao: e.target.value })} disabled={!editable} placeholder="Descreva como o produto deve ser construído, montado ou executado..." /></label>
          <div className="block-toggles">
            <button className={editor.blocos.bom ? 'active' : ''} disabled={!editable} onClick={() => setEditor({ ...editor, blocos: { ...editor.blocos, bom: !editor.blocos.bom } })}>BOM</button>
            <button className={editor.blocos.medidas ? 'active' : ''} disabled={!editable} onClick={() => setEditor({ ...editor, blocos: { ...editor.blocos, medidas: !editor.blocos.medidas } })}>Medidas</button>
            <button className={editor.blocos.checklist ? 'active' : ''} disabled={!editable} onClick={() => setEditor({ ...editor, blocos: { ...editor.blocos, checklist: !editor.blocos.checklist } })}>Checklist</button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">Revisões</span><h3>Histórico</h3></div><History size={20} /></div>
          <div className="revision-list">{history.map((item) => <button key={item.id} className={item.numero === editor.numero ? 'active' : ''} onClick={async () => { if (!empresaId) return; const rev = await getTechnicalRevision(empresaId, item.produtoCodigo, item.numero); if (rev) setEditor(rev) }}><span>REV {String(item.numero).padStart(2, '0')}</span><strong>{statusLabel(item.status)}</strong><small>{item.motivoRevisao || (item.numero === 1 ? 'Revisão inicial' : 'Sem motivo informado')}</small></button>)}</div>
        </section>
      </div>

      <section className="panel ft-images-panel">
        <div className="panel-head">
          <div><span className="section-kicker">Referência visual</span><h3>Imagens da revisão</h3></div>
          <span className="count-badge">{editor.imagens.length}/6</span>
        </div>

        {editable && <label className="image-upload-button print-hidden">
          <ImagePlus size={17} />
          <span>{uploadingImage ? 'Enviando imagem...' : 'Adicionar imagem'}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploadingImage || editor.imagens.length >= 6}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) uploadImage(file)
              event.currentTarget.value = ''
            }}
          />
        </label>}

        {editor.imagens.length === 0 ? (
          <div className="empty-state small-empty">
            <ImagePlus size={28} />
            <strong>Sem imagens nesta revisão</strong>
            <span>Adicione fotos, desenhos, referências ou vistas do produto.</span>
          </div>
        ) : (
          <div className="ft-image-grid">
            {editor.imagens.map((image, index) => (
              <figure className="ft-image-card" key={image.path || image.url}>
                <img src={image.url} alt={image.legenda || `Imagem ${index + 1}`} />
                <figcaption>
                  {editable ? (
                    <input
                      value={image.legenda}
                      onChange={(event) => setEditor({
                        ...editor,
                        imagens: editor.imagens.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, legenda: event.target.value }
                            : item,
                        ),
                      })}
                      placeholder="Legenda da imagem"
                    />
                  ) : (
                    <span>{image.legenda || `Imagem ${index + 1}`}</span>
                  )}
                  {editable && (
                    <button
                      className="icon-button danger-icon print-hidden"
                      type="button"
                      onClick={() => removeImage(index)}
                      title="Remover imagem"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {editor.blocos.bom && <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Composição</span><h3>BOM — Lista de materiais</h3></div><span className="count-badge">{editor.bom.length}</span></div>
        {editable && <div className="inline-form bom-add"><select value={materialToAdd} onChange={(e) => setMaterialToAdd(e.target.value)}><option value="">Selecione um material ativo</option>{materials.filter((item) => item.ativo).map((material) => <option key={material.id} value={material.id}>{material.codigo} — {material.descricao}</option>)}</select><button className="secondary-button compact" type="button" onClick={addMaterial} disabled={!materialToAdd}><PackagePlus size={16} /> Adicionar à BOM</button></div>}
        {editor.bom.length === 0 ? <div className="empty-state small-empty"><PackagePlus size={28} /><strong>BOM vazia</strong><span>Adicione os materiais que compõem este produto.</span></div> :
          <div className="table-wrap"><table className="bom-table"><thead><tr><th>Material</th><th>Fornecedor</th><th>Consumo</th><th>Unidade</th><th>Perda %</th><th>Cor</th><th>Observação</th>{editable && <th></th>}</tr></thead><tbody>{editor.bom.map((line) => <tr key={line.id}><td><strong>{line.codigoSnapshot}</strong><small className="table-sub">{line.descricaoSnapshot}</small></td><td>{editable ? (() => {
          const material = materials.find((item) => item.id === line.materialId)
          const options = material?.fornecedores.filter(
            (item): item is MaterialSupplier => typeof item !== 'string',
          ) ?? []
          return options.length > 0 ? (
            <select
              value={line.fornecedorId ?? ''}
              onChange={(event) => setBomSupplier(line, event.target.value)}
            >
              <option value="">Sem fornecedor</option>
              {options.map((supplier) => (
                <option key={supplier.fornecedorId} value={supplier.fornecedorId}>
                  {supplier.nomeSnapshot}
                  {supplier.referenciaFornecedor ? ` · ${supplier.referenciaFornecedor}` : ''}
                </option>
              ))}
            </select>
          ) : (line.fornecedorSnapshot || '—')
        })() : (line.fornecedorSnapshot || '—')}</td><td>{editable ? <input type="number" min="0.0001" step="0.0001" value={line.consumo} onChange={(e) => updateBom(line.id, { consumo: Number(e.target.value) })} /> : line.consumo}</td><td>{line.unidade}</td><td>{editable ? <input type="number" min="0" step="0.01" value={line.perdaPercentual} onChange={(e) => updateBom(line.id, { perdaPercentual: Number(e.target.value) })} /> : line.perdaPercentual}</td><td>{editable ? <select value={line.corRegra} onChange={(e) => updateBom(line.id, { corRegra: e.target.value as BomLine['corRegra'] })}><option value="nao_aplica">N/A</option><option value="produto">Segue produto</option><option value="fixa">Fixa</option></select> : line.corRegra}</td><td>{editable ? <input value={line.observacao ?? ''} onChange={(e) => updateBom(line.id, { observacao: e.target.value })} /> : line.observacao || '—'}</td>{editable && <td><button className="icon-button danger-icon" onClick={() => removeBom(line.id)}><Trash2 size={15} /></button></td>}</tr>)}</tbody></table></div>}
        {editor.tamanhos.length > 0 && editor.bom.length > 0 && <div className="variant-consumption-panel">
          <div className="variant-consumption-head">
            <div>
              <span className="section-kicker">Consumo por tamanho/variante</span>
              <strong>Use apenas nos materiais cujo consumo muda conforme a variante.</strong>
            </div>
          </div>
          {editor.bom.map((line) => {
            const variable = Boolean(
              line.consumoPorTamanho
              && Object.keys(line.consumoPorTamanho).length > 0,
            )
            return <div className="variant-consumption-row" key={line.id}>
              <div className="variant-consumption-material">
                <strong>{line.codigoSnapshot}</strong>
                <span>{line.descricaoSnapshot}</span>
              </div>
              <label className="variable-toggle print-hidden">
                <input
                  type="checkbox"
                  checked={variable}
                  disabled={!editable}
                  onChange={() => toggleVariableConsumption(line)}
                />
                Varia por tamanho
              </label>
              {variable && <div className="variant-consumption-values">
                {editor.tamanhos.map((size) => (
                  <label key={size}>
                    <span>{size}</span>
                    {editable ? (
                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={line.consumoPorTamanho?.[size] ?? line.consumo}
                        onChange={(event) => updateVariableConsumption(
                          line.id,
                          size,
                          Number(event.target.value),
                        )}
                      />
                    ) : (
                      <strong>{line.consumoPorTamanho?.[size] ?? line.consumo}</strong>
                    )}
                  </label>
                ))}
              </div>}
            </div>
          })}
        </div>}
      </section>}

      {editor.blocos.medidas && <section className="panel ft-measurements-panel">
        <div className="panel-head">
          <div><span className="section-kicker">Especificação dimensional</span><h3>Tabela de medidas</h3></div>
          <span className="count-badge">{editor.medidas.length}</span>
        </div>

        <div className="size-editor">
          <div className="size-chips">
            {editor.tamanhos.map((size) => (
              <span className="size-chip" key={size}>
                {size}
                {editable && <button type="button" onClick={() => removeSize(size)} title="Remover tamanho">×</button>}
              </span>
            ))}
          </div>
          {editable && <div className="inline-form print-hidden">
            <input
              value={newSize}
              onChange={(event) => setNewSize(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSize()
                }
              }}
              placeholder="Ex.: P, M, G, 40, 42..."
            />
            <button type="button" className="secondary-button compact" onClick={addSize} disabled={!newSize.trim()}>
              <Plus size={15} /> Tamanho
            </button>
          </div>}
        </div>

        {editor.tamanhos.length === 0 ? (
          <div className="empty-state small-empty">
            <Ruler size={28} />
            <strong>Defina a grade primeiro</strong>
            <span>Adicione tamanhos ou variantes para montar a tabela de medidas.</span>
          </div>
        ) : (
          <>
            {editable && <div className="measurement-toolbar print-hidden">
              <button type="button" className="secondary-button compact" onClick={addMeasurementRow}>
                <Plus size={15} /> Ponto de medida
              </button>
            </div>}

            {editor.medidas.length === 0 ? (
              <div className="empty-state small-empty">
                <Ruler size={28} />
                <strong>Nenhum ponto de medida</strong>
                <span>Adicione qualquer ponto dimensional necessário ao produto.</span>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="measurement-table">
                  <thead>
                    <tr>
                      <th>Ponto de medida</th>
                      <th>Tolerância</th>
                      {editor.tamanhos.map((size) => <th key={size}>{size}</th>)}
                      {editable && <th className="print-hidden"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {editor.medidas.map((row) => (
                      <tr key={row.id}>
                        <td>{editable ? <input value={row.ponto} onChange={(event) => updateMeasurementRow(row.id, { ponto: event.target.value })} placeholder="Ex.: Comprimento total" /> : row.ponto}</td>
                        <td>{editable ? <input type="number" min="0" step="0.01" value={row.tolerancia} onChange={(event) => updateMeasurementRow(row.id, { tolerancia: Number(event.target.value) })} /> : '± ' + row.tolerancia}</td>
                        {editor.tamanhos.map((size) => {
                          const current = row.valores.find((item) => item.tamanho === size)
                          return <td key={size}>{editable ? <input type="number" step="0.01" value={current?.valor ?? ''} onChange={(event) => updateMeasurementValue(row.id, size, event.target.value === '' ? null : Number(event.target.value))} /> : (current?.valor ?? '—')}</td>
                        })}
                        {editable && <td className="print-hidden"><button type="button" className="icon-button danger-icon" onClick={() => removeMeasurementRow(row.id)} title="Remover ponto"><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>}

      {editor.blocos.checklist && <section className="panel ft-checklist-panel">
        <div className="panel-head">
          <div><span className="section-kicker">Verificação técnica</span><h3>Checklist da revisão</h3></div>
          <span className="count-badge">{editor.checklist.length}</span>
        </div>

        {editable && <div className="measurement-toolbar print-hidden">
          <button type="button" className="secondary-button compact" onClick={addChecklistItem}>
            <Plus size={15} /> Item do checklist
          </button>
        </div>}

        {editor.checklist.length === 0 ? (
          <div className="empty-state small-empty">
            <ListChecks size={28} />
            <strong>Checklist vazio</strong>
            <span>Adicione verificações que precisam acompanhar esta revisão.</span>
          </div>
        ) : (
          <div className="technical-checklist">
            {editor.checklist.map((item, index) => (
              <div className="technical-checklist-row" key={item.id}>
                <span className="check-index">{index + 1}</span>
                {editable ? (
                  <input
                    value={item.descricao}
                    onChange={(event) => updateChecklistItem(item.id, { descricao: event.target.value })}
                    placeholder="Ex.: Conferir acabamento final"
                  />
                ) : (
                  <strong>{item.descricao}</strong>
                )}
                <label className="required-check">
                  <input
                    type="checkbox"
                    checked={item.obrigatorio}
                    disabled={!editable}
                    onChange={(event) => updateChecklistItem(item.id, { obrigatorio: event.target.checked })}
                  />
                  Obrigatório
                </label>
                {editable && <button type="button" className="icon-button danger-icon print-hidden" onClick={() => removeChecklistItem(item.id)}><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        )}
      </section>}
    </>
  }

  return <>
    <section className="page-intro">
      <div><span className="section-kicker">Engenharia / padronização</span><h2>Fichas Técnicas</h2><p>Revisões reais, histórico preservado e composição vinculada ao cadastro mestre de materiais.</p></div>
    </section>

    <section className="panel ft-create-panel">
      <div><span className="section-kicker">Nova ficha ou nova revisão</span><h3>Selecione um produto</h3><p className="helper-text">Se já existir uma revisão em rascunho, ela será reaberta. Se houver uma revisão padrão, será criada uma nova cópia para edição.</p></div>
      <div className="inline-form"><select value={selectedProductCode} onChange={(e) => setSelectedProductCode(e.target.value)}><option value="">Selecione...</option>{products.filter((product) => product.status === 'ativo').map((product) => <option key={product.id} value={product.codigo}>{product.codigo} — {product.descricao}</option>)}</select><button className="primary-button" disabled={!selectedProduct || busy} onClick={() => selectedProduct && openOrCreate(selectedProduct)}>{busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Abrir ficha</button></div>
    </section>

    {localError && <div className="form-error page-message">{localError}</div>}
    {error && <div className="form-error page-message">{error}</div>}
    {loading ? <div className="loading-panel"><Loader2 className="spin" size={25} /> Carregando fichas...</div> :
      <div className="cards-list">{summaries.length === 0 ? <section className="panel"><div className="empty-state"><FileText size={30} /><strong>Nenhuma Ficha Técnica criada</strong><span>Cadastre um produto e abra a primeira revisão.</span></div></section> : summaries.map((summary) => <button className="sheet-card sheet-card-button" key={summary.id} onClick={() => openSummary(summary)}><div className="sheet-head"><span className="sheet-icon"><FileText size={21} /></span><div><span className="op-number">{summary.produtoCodigo}</span><h3>{summary.produtoDescricao}</h3><small>{summary.revisaoRascunho ? `REV ${String(summary.revisaoRascunho).padStart(2, '0')} em trabalho` : summary.revisaoVigente ? `REV ${String(summary.revisaoVigente).padStart(2, '0')} vigente` : 'Sem revisão vigente'}</small></div><Status status={summary.status === 'padrao' ? 'padrao' : summary.status === 'em_validacao' ? 'em_validacao' : 'rascunho'} /></div></button>)}</div>}
  </>
}

function Status({ status }: { status: TechnicalRevision['status'] }) {
  const tone = status === 'padrao' ? 'green' : status === 'em_validacao' ? 'blue' : status === 'obsoleta' ? 'slate' : 'amber'
  return <span className={`status status-${tone}`}>{statusLabel(status)}</span>
}

function statusLabel(status: string) {
  if (status === 'padrao') return 'Padrão'
  if (status === 'em_validacao') return 'Em validação'
  if (status === 'obsoleta') return 'Obsoleta'
  return 'Rascunho'
}

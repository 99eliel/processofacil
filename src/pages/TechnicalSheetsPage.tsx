import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
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
import type { BomLine, Material, Product, TechnicalRevision, TechnicalSheetSummary } from '../domain/types'

export default function TechnicalSheetsPage({ notify }: { notify: (message: string) => void }) {
  const auth = useAuth()
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

      {editor.blocos.bom && <section className="panel">
        <div className="panel-head"><div><span className="section-kicker">Composição</span><h3>BOM — Lista de materiais</h3></div><span className="count-badge">{editor.bom.length}</span></div>
        {editable && <div className="inline-form bom-add"><select value={materialToAdd} onChange={(e) => setMaterialToAdd(e.target.value)}><option value="">Selecione um material ativo</option>{materials.filter((item) => item.ativo).map((material) => <option key={material.id} value={material.id}>{material.codigo} — {material.descricao}</option>)}</select><button className="secondary-button compact" type="button" onClick={addMaterial} disabled={!materialToAdd}><PackagePlus size={16} /> Adicionar à BOM</button></div>}
        {editor.bom.length === 0 ? <div className="empty-state small-empty"><PackagePlus size={28} /><strong>BOM vazia</strong><span>Adicione os materiais que compõem este produto.</span></div> :
          <div className="table-wrap"><table className="bom-table"><thead><tr><th>Material</th><th>Fornecedor</th><th>Consumo</th><th>Unidade</th><th>Perda %</th><th>Cor</th><th>Observação</th>{editable && <th></th>}</tr></thead><tbody>{editor.bom.map((line) => <tr key={line.id}><td><strong>{line.codigoSnapshot}</strong><small className="table-sub">{line.descricaoSnapshot}</small></td><td>{line.fornecedorSnapshot || '—'}</td><td>{editable ? <input type="number" min="0.0001" step="0.0001" value={line.consumo} onChange={(e) => updateBom(line.id, { consumo: Number(e.target.value) })} /> : line.consumo}</td><td>{line.unidade}</td><td>{editable ? <input type="number" min="0" step="0.01" value={line.perdaPercentual} onChange={(e) => updateBom(line.id, { perdaPercentual: Number(e.target.value) })} /> : line.perdaPercentual}</td><td>{editable ? <select value={line.corRegra} onChange={(e) => updateBom(line.id, { corRegra: e.target.value as BomLine['corRegra'] })}><option value="nao_aplica">N/A</option><option value="produto">Segue produto</option><option value="fixa">Fixa</option></select> : line.corRegra}</td><td>{editable ? <input value={line.observacao ?? ''} onChange={(e) => updateBom(line.id, { observacao: e.target.value })} /> : line.observacao || '—'}</td>{editable && <td><button className="icon-button danger-icon" onClick={() => removeBom(line.id)}><Trash2 size={15} /></button></td>}</tr>)}</tbody></table></div>}
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

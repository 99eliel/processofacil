import { useState } from 'react'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Clock3,
  ImagePlus,
  ListChecks,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Video,
  Wrench,
} from 'lucide-react'
import { deleteOperationMedia, uploadOperationMedia } from '../firebase/storageRepository'
import type { TechnicalOperation, TechnicalRevision } from '../domain/types'

type Props = {
  editor: TechnicalRevision
  setEditor: (next: TechnicalRevision) => void
  editable: boolean
  empresaId: string
  notify: (message: string) => void
  onError: (message: string) => void
}

function emptyOperation(order: number): TechnicalOperation {
  return {
    id: crypto.randomUUID(),
    ordem: order,
    codigo: String(order * 10),
    nome: '',
    descricao: '',
    maquina: '',
    regulagem: '',
    ferramenta: '',
    tempoPadraoMin: null,
    dificuldade: 'medio',
    pontosCriticos: [],
    instrucoes: [''],
    midias: [],
  }
}

export default function TechnicalOperationsEditor({
  editor,
  setEditor,
  editable,
  empresaId,
  notify,
  onError,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(editor.operacoes[0]?.id ?? null)
  const [uploading, setUploading] = useState('')

  const update = (id: string, patch: Partial<TechnicalOperation>) => {
    setEditor({
      ...editor,
      operacoes: editor.operacoes.map((operation) =>
        operation.id === id ? { ...operation, ...patch } : operation,
      ),
    })
  }

  const add = () => {
    const next = emptyOperation(editor.operacoes.length + 1)
    setEditor({ ...editor, operacoes: [...editor.operacoes, next] })
    setExpanded(next.id)
  }

  const remove = async (operation: TechnicalOperation) => {
    for (const media of operation.midias) {
      if (media.path) {
        try {
          await deleteOperationMedia(media.path)
        } catch (reason) {
          console.warn('Não foi possível remover mídia órfã.', reason)
        }
      }
    }
    setEditor({
      ...editor,
      operacoes: editor.operacoes
        .filter((item) => item.id !== operation.id)
        .map((item, index) => ({ ...item, ordem: index + 1 })),
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= editor.operacoes.length) return
    const next = [...editor.operacoes]
    ;[next[index], next[target]] = [next[target], next[index]]
    setEditor({
      ...editor,
      operacoes: next.map((item, itemIndex) => ({ ...item, ordem: itemIndex + 1 })),
    })
  }

  const updateInstruction = (operation: TechnicalOperation, index: number, value: string) => {
    update(operation.id, {
      instrucoes: operation.instrucoes.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    })
  }

  const upload = async (operation: TechnicalOperation, file: File) => {
    setUploading(operation.id)
    onError('')
    try {
      const uploaded = await uploadOperationMedia(
        empresaId,
        editor.produtoCodigo,
        editor.numero,
        operation.id,
        file,
      )
      update(operation.id, {
        midias: [
          ...operation.midias,
          {
            id: crypto.randomUUID(),
            tipo: uploaded.tipo,
            url: uploaded.url,
            path: uploaded.path,
            legenda: '',
            ordem: operation.midias.length + 1,
          },
        ],
      })
      notify(uploaded.tipo === 'video' ? 'Vídeo adicionado ao POP.' : 'Imagem adicionada ao POP.')
    } catch (reason) {
      console.error(reason)
      onError(reason instanceof Error ? reason.message : 'Não foi possível enviar a mídia.')
    } finally {
      setUploading('')
    }
  }

  const removeMedia = async (operation: TechnicalOperation, mediaId: string) => {
    const media = operation.midias.find((item) => item.id === mediaId)
    if (!media) return
    if (media.path) {
      try {
        await deleteOperationMedia(media.path)
      } catch (reason) {
        console.warn('Não foi possível remover o arquivo do Storage.', reason)
      }
    }
    update(operation.id, {
      midias: operation.midias.filter((item) => item.id !== mediaId),
    })
  }

  return <section className="panel operations-panel">
    <div className="panel-head">
      <div>
        <span className="section-kicker">Sequência operacional + POP</span>
        <h3>Operações de produção</h3>
      </div>
      <span className="count-badge">{editor.operacoes.length}</span>
    </div>

    <p className="helper-text">
      Cada operação vira uma instrução de chão de fábrica com passo a passo, máquina,
      regulagem, tempo, pontos críticos, fotos e vídeo.
    </p>

    {editor.operacoes.length === 0 ? (
      <div className="empty-state small-empty">
        <ListChecks size={28} />
        <strong>Nenhuma operação cadastrada</strong>
        <span>Crie a sequência que o operador deverá seguir nesta revisão.</span>
      </div>
    ) : (
      <div className="operation-editor-list">
        {editor.operacoes.map((operation, index) => {
          const isExpanded = expanded === operation.id
          return <article className="operation-editor-card" key={operation.id}>
            <div className="operation-editor-summary">
              <span className="operation-order">{operation.codigo || String((index + 1) * 10)}</span>
              <button
                type="button"
                className="operation-title-button"
                onClick={() => setExpanded(isExpanded ? null : operation.id)}
              >
                <strong>{operation.nome || 'Operação sem nome'}</strong>
                <small>
                  {operation.maquina || 'Máquina não definida'}
                  {operation.tempoPadraoMin != null ? ` · ${operation.tempoPadraoMin} min` : ''}
                  {operation.midias.some((item) => item.tipo === 'video') ? ' · vídeo' : ''}
                </small>
              </button>
              {editable && <div className="operation-order-actions">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0}><ChevronUp size={14} /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === editor.operacoes.length - 1}><ChevronDown size={14} /></button>
                <button type="button" className="danger-icon" onClick={() => remove(operation)}><Trash2 size={14} /></button>
              </div>}
              <button
                type="button"
                className="icon-button"
                onClick={() => setExpanded(isExpanded ? null : operation.id)}
              >
                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>

            {isExpanded && <div className="operation-editor-body">
              <div className="form-grid operation-fields">
                <label><span>Código / nº</span><input value={operation.codigo} disabled={!editable} onChange={(event) => update(operation.id, { codigo: event.target.value })} placeholder="Ex.: 30" /></label>
                <label><span>Nome da operação *</span><input value={operation.nome} disabled={!editable} onChange={(event) => update(operation.id, { nome: event.target.value })} placeholder="Ex.: Pregar manga" /></label>
                <label><span>Máquina</span><input value={operation.maquina} disabled={!editable} onChange={(event) => update(operation.id, { maquina: event.target.value })} placeholder="Ex.: Overlock 5 fios" /></label>
                <label><span>Ferramenta / acessório</span><input value={operation.ferramenta} disabled={!editable} onChange={(event) => update(operation.id, { ferramenta: event.target.value })} placeholder="Ex.: Aparelho de viés" /></label>
                <label><span>Tempo padrão (min)</span><input type="number" min="0" step="0.01" value={operation.tempoPadraoMin ?? ''} disabled={!editable} onChange={(event) => update(operation.id, { tempoPadraoMin: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                <label><span>Dificuldade</span><select value={operation.dificuldade} disabled={!editable} onChange={(event) => update(operation.id, { dificuldade: event.target.value as TechnicalOperation['dificuldade'] })}><option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option></select></label>
                <label className="span-2"><span>Regulagem</span><input value={operation.regulagem} disabled={!editable} onChange={(event) => update(operation.id, { regulagem: event.target.value })} placeholder="Ponto, tensão, margem, velocidade ou outra regulagem importante" /></label>
                <label className="span-2"><span>Objetivo / instrução principal *</span><textarea rows={3} value={operation.descricao} disabled={!editable} onChange={(event) => update(operation.id, { descricao: event.target.value })} placeholder="Explique o que deve ser feito nesta operação." /></label>
              </div>

              <div className="pop-section">
                <div className="pop-section-head"><div><Wrench size={17} /><strong>Passo a passo</strong></div>{editable && <button type="button" className="text-button" onClick={() => update(operation.id, { instrucoes: [...operation.instrucoes, ''] })}><Plus size={14} /> Passo</button>}</div>
                <div className="pop-steps">
                  {operation.instrucoes.map((instruction, instructionIndex) => <div className="pop-step-row" key={instructionIndex}><span>{instructionIndex + 1}</span>{editable ? <input value={instruction} onChange={(event) => updateInstruction(operation, instructionIndex, event.target.value)} placeholder="Descreva este passo..." /> : <strong>{instruction || '—'}</strong>}{editable && operation.instrucoes.length > 1 && <button type="button" className="icon-button" onClick={() => update(operation.id, { instrucoes: operation.instrucoes.filter((_, itemIndex) => itemIndex !== instructionIndex) })}><Trash2 size={13} /></button>}</div>)}
                </div>
              </div>

              <div className="pop-section">
                <div className="pop-section-head"><div><Settings2 size={17} /><strong>Pontos críticos de qualidade</strong></div>{editable && <button type="button" className="text-button" onClick={() => update(operation.id, { pontosCriticos: [...operation.pontosCriticos, ''] })}><Plus size={14} /> Ponto</button>}</div>
                {operation.pontosCriticos.length === 0 ? <p className="helper-text">Nenhum ponto crítico definido.</p> : <div className="critical-points-editor">{operation.pontosCriticos.map((point, pointIndex) => <div key={pointIndex}>{editable ? <input value={point} onChange={(event) => update(operation.id, { pontosCriticos: operation.pontosCriticos.map((item, itemIndex) => itemIndex === pointIndex ? event.target.value : item) })} placeholder="Ex.: Não franzir a manga" /> : <span>{point}</span>}{editable && <button type="button" className="icon-button" onClick={() => update(operation.id, { pontosCriticos: operation.pontosCriticos.filter((_, itemIndex) => itemIndex !== pointIndex) })}><Trash2 size={13} /></button>}</div>)}</div>}
              </div>

              <div className="pop-section">
                <div className="pop-section-head"><div><Camera size={17} /><strong>Fotos e vídeo do POP</strong></div></div>
                {editable && <label className="operation-media-upload">
                  {uploading === operation.id ? <Loader2 className="spin" size={17} /> : <ImagePlus size={17} />}
                  <span>{uploading === operation.id ? 'Enviando...' : 'Adicionar foto ou vídeo'}</span>
                  <input type="file" accept="image/*,video/*" disabled={uploading === operation.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(operation, file); event.currentTarget.value = '' }} />
                </label>}
                {operation.midias.length === 0 ? <div className="pop-media-empty"><Video size={22} /><span>Sem mídia demonstrativa.</span></div> : <div className="pop-media-grid">{operation.midias.map((media) => <figure key={media.id} className="pop-media-card">{media.tipo === 'video' ? <video src={media.url} controls preload="metadata" /> : <img src={media.url} alt={media.legenda || operation.nome} />}<figcaption>{editable ? <input value={media.legenda} onChange={(event) => update(operation.id, { midias: operation.midias.map((item) => item.id === media.id ? { ...item, legenda: event.target.value } : item) })} placeholder="Legenda" /> : <span>{media.legenda || (media.tipo === 'video' ? 'Vídeo demonstrativo' : 'Imagem demonstrativa')}</span>}{editable && <button type="button" className="icon-button danger-icon" onClick={() => removeMedia(operation, media.id)}><Trash2 size={13} /></button>}</figcaption></figure>)}</div>}
              </div>

              <div className="operation-footnote">
                <Clock3 size={15} />
                <span>Esta operação será congelada junto com a revisão quando uma OP for liberada.</span>
              </div>
            </div>}
          </article>
        })}
      </div>
    )}

    {editable && <button type="button" className="secondary-button compact operation-add-button" onClick={add}><Plus size={15} /> Nova operação</button>}
  </section>
}


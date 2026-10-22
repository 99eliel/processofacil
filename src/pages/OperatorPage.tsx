import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Factory,
  Image as ImageIcon,
  Loader2,
  MonitorPlay,
  Play,
  RotateCcw,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import {
  blockOperationTask,
  completeOperationTask,
  startOperationTask,
  unblockOperationTask,
} from '../firebase/operatorRepository'
import type { ProductionOperationTask, ProductionOrderRecord } from '../domain/types'

export default function OperatorPage({ notify }: { notify: (message: string) => void }) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: orders, loading, error } = useTenantCollection<ProductionOrderRecord>(
    empresaId,
    'ordensProducao',
    'numero',
  )
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [problemModal, setProblemModal] = useState(false)
  const [problemText, setProblemText] = useState('')

  const availableOrders = useMemo(
    () => orders
      .filter((order) =>
        ['liberada', 'em_fluxo', 'reprovada'].includes(order.status)
        && (order.operacoes ?? []).length > 0,
      )
      .sort((a, b) => b.numero.localeCompare(a.numero)),
    [orders],
  )

  const selectedOrder = availableOrders.find((order) => order.id === selectedOrderId)
    ?? availableOrders[0]
    ?? null

  const tasks = useMemo(() => {
    if (!selectedOrder) return []
    return [...(selectedOrder.operacoes ?? [])].sort((a, b) => {
      const itemA = selectedOrder.itens.findIndex((item) => item.id === a.itemId)
      const itemB = selectedOrder.itens.findIndex((item) => item.id === b.itemId)
      if (itemA !== itemB) return itemA - itemB
      return a.operacao.ordem - b.operacao.ordem
    })
  }, [selectedOrder])

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedOrderId('')
      setSelectedTaskId('')
      return
    }
    if (!selectedOrderId) setSelectedOrderId(selectedOrder.id)

    const current = tasks.find((task) => task.id === selectedTaskId)
    if (current) return

    const firstOpen = tasks.find((task) => task.status !== 'concluida')
    setSelectedTaskId(firstOpen?.id ?? tasks[0]?.id ?? '')
  }, [selectedOrder?.id, tasks.length])

  const currentIndex = Math.max(0, tasks.findIndex((task) => task.id === selectedTaskId))
  const task = tasks[currentIndex] ?? null
  const completed = tasks.filter((item) => item.status === 'concluida').length
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0

  const currentItem = task
    ? selectedOrder?.itens.find((item) => item.id === task.itemId)
    : null

  const execute = async (action: 'start' | 'complete' | 'unblock') => {
    if (!empresaId || !user || !selectedOrder || !task) return
    setBusy(true)
    setLocalError('')
    try {
      if (action === 'start') {
        await startOperationTask(empresaId, user.uid, selectedOrder.id, task.id)
        notify('Operação iniciada.')
      } else if (action === 'complete') {
        await completeOperationTask(empresaId, user.uid, selectedOrder.id, task.id)
        notify('Operação concluída.')
        const next = tasks[currentIndex + 1]
        if (next) setSelectedTaskId(next.id)
      } else {
        await unblockOperationTask(empresaId, user.uid, selectedOrder.id, task.id)
        notify('Bloqueio removido.')
      }
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a operação.')
    } finally {
      setBusy(false)
    }
  }

  const reportProblem = async () => {
    if (!empresaId || !user || !selectedOrder || !task) return
    setBusy(true)
    setLocalError('')
    try {
      await blockOperationTask(
        empresaId,
        user.uid,
        selectedOrder.id,
        task.id,
        problemText,
      )
      notify('Problema registrado e operação bloqueada.')
      setProblemModal(false)
      setProblemText('')
    } catch (reason) {
      console.error(reason)
      setLocalError(reason instanceof Error ? reason.message : 'Não foi possível registrar o problema.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="loading-panel"><Loader2 className="spin" size={24} /> Carregando chão de fábrica...</div>
  }

  return <>
    <section className="operator-page-head">
      <div>
        <span className="section-kicker">Execução no chão de fábrica</span>
        <h2>Modo Operador</h2>
        <p>Instrução visual da operação, POP, vídeo e rastreabilidade da execução.</p>
      </div>
      <div className="operator-order-select">
        <span>Ordem de Produção</span>
        <select
          value={selectedOrder?.id ?? ''}
          onChange={(event) => {
            setSelectedOrderId(event.target.value)
            setSelectedTaskId('')
          }}
        >
          {availableOrders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.numero} · {order.itens.reduce((sum, item) => sum + item.quantidadeTotal, 0)} peças
            </option>
          ))}
        </select>
      </div>
    </section>

    {error && <div className="form-error page-message">{error}</div>}
    {localError && <div className="form-error page-message">{localError}</div>}

    {!selectedOrder || !task ? (
      <section className="panel">
        <div className="empty-state">
          <MonitorPlay size={34} />
          <strong>Nenhuma operação disponível</strong>
          <span>
            Libere uma OP que possua uma Ficha Técnica padrão com sequência operacional.
          </span>
        </div>
      </section>
    ) : (
      <div className="operator-layout">
        <aside className="operator-sequence panel">
          <div className="operator-sequence-head">
            <div>
              <span>{selectedOrder.numero}</span>
              <strong>{completed}/{tasks.length} concluídas</strong>
            </div>
            <b>{progress}%</b>
          </div>
          <div className="operator-progress"><i style={{ width: `${progress}%` }} /></div>

          <div className="operator-task-list">
            {tasks.map((item, index) => (
              <button
                key={item.id}
                className={`operator-task ${item.id === task.id ? 'active' : ''} ${item.status}`}
                onClick={() => setSelectedTaskId(item.id)}
              >
                <span>{item.operacao.codigo || String((index + 1) * 10)}</span>
                <div>
                  <strong>{item.operacao.nome}</strong>
                  <small>{item.produtoCodigo} · {statusLabel(item.status)}</small>
                </div>
                {item.status === 'concluida' && <CheckCircle2 size={16} />}
                {item.status === 'bloqueada' && <AlertTriangle size={16} />}
              </button>
            ))}
          </div>
        </aside>

        <main className="operator-work-card">
          <div className="operator-product-bar">
            <div>
              <span>{task.produtoCodigo}</span>
              <strong>{task.produtoDescricao}</strong>
            </div>
            <div>
              <span>REV {String(task.revisao).padStart(2, '0')}</span>
              {currentItem?.cor && <span>Cor: {currentItem.cor}</span>}
              <span>
                {currentItem?.variantes.map((variant) => `${variant.nome}: ${variant.quantidade}`).join(' · ')}
              </span>
            </div>
          </div>

          <section className="operator-operation-hero">
            <span className="operator-operation-number">
              OPERAÇÃO {task.operacao.codigo || task.operacao.ordem}
            </span>
            <h1>{task.operacao.nome}</h1>
            <p>{task.operacao.descricao}</p>
            <div className="operator-badges">
              {task.operacao.maquina && <span><Factory size={15} /> {task.operacao.maquina}</span>}
              {task.operacao.tempoPadraoMin != null && <span><Clock3 size={15} /> {task.operacao.tempoPadraoMin} min</span>}
              <span className={`difficulty ${task.operacao.dificuldade}`}>
                {difficultyLabel(task.operacao.dificuldade)}
              </span>
            </div>
          </section>

          {task.operacao.midias.length > 0 && <section className="operator-media-section">
            <div className="operator-media-grid">
              {task.operacao.midias.map((media) => (
                <figure key={media.id} className={`operator-media ${media.tipo}`}>
                  {media.tipo === 'video'
                    ? <video src={media.url} controls playsInline preload="metadata" />
                    : <img src={media.url} alt={media.legenda || task.operacao.nome} />}
                  <figcaption>
                    {media.tipo === 'video' ? <Play size={14} /> : <ImageIcon size={14} />}
                    {media.legenda || (media.tipo === 'video' ? 'Vídeo demonstrativo' : 'Referência visual')}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>}

          <div className="operator-info-grid">
            <section className="operator-info-card">
              <div className="operator-info-title"><Wrench size={18} /><strong>Como fazer</strong></div>
              <ol>
                {(task.operacao.instrucoes ?? []).filter(Boolean).map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
              {(task.operacao.instrucoes ?? []).filter(Boolean).length === 0 && (
                <p>Use a instrução principal desta operação.</p>
              )}
            </section>

            <section className="operator-info-card">
              <div className="operator-info-title"><ShieldAlert size={18} /><strong>Pontos críticos</strong></div>
              {(task.operacao.pontosCriticos ?? []).filter(Boolean).length > 0 ? (
                <ul>
                  {task.operacao.pontosCriticos.filter(Boolean).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : <p>Nenhum ponto crítico cadastrado.</p>}
            </section>

            <section className="operator-info-card technical">
              <div className="operator-info-title"><Factory size={18} /><strong>Preparação técnica</strong></div>
              <dl>
                <div><dt>Máquina</dt><dd>{task.operacao.maquina || '—'}</dd></div>
                <div><dt>Ferramenta</dt><dd>{task.operacao.ferramenta || '—'}</dd></div>
                <div><dt>Regulagem</dt><dd>{task.operacao.regulagem || '—'}</dd></div>
                <div><dt>Tempo padrão</dt><dd>{task.operacao.tempoPadraoMin != null ? `${task.operacao.tempoPadraoMin} min` : '—'}</dd></div>
              </dl>
            </section>
          </div>

          {task.status === 'bloqueada' && (
            <div className="operator-blocked-banner">
              <AlertTriangle size={20} />
              <div>
                <strong>Operação bloqueada</strong>
                <span>{task.observacao || 'Problema informado pelo operador.'}</span>
              </div>
              <button className="secondary-button compact" disabled={busy} onClick={() => execute('unblock')}>
                <RotateCcw size={15} /> Liberar novamente
              </button>
            </div>
          )}

          <footer className="operator-controls">
            <button
              className="operator-nav-button"
              disabled={currentIndex === 0}
              onClick={() => setSelectedTaskId(tasks[currentIndex - 1]?.id ?? task.id)}
            >
              <ChevronLeft size={18} /> Anterior
            </button>

            <div className="operator-main-actions">
              {task.status === 'pendente' && (
                <button className="primary-button operator-start" disabled={busy} onClick={() => execute('start')}>
                  <Play size={18} /> Iniciar operação
                </button>
              )}
              {task.status === 'em_execucao' && (
                <button className="primary-button operator-complete" disabled={busy} onClick={() => execute('complete')}>
                  <CheckCircle2 size={18} /> Concluir operação
                </button>
              )}
              {task.status !== 'concluida' && task.status !== 'bloqueada' && (
                <button className="operator-problem-button" disabled={busy} onClick={() => setProblemModal(true)}>
                  <AlertTriangle size={17} /> Informar problema
                </button>
              )}
              {task.status === 'concluida' && (
                <span className="operator-completed-label"><CheckCircle2 size={18} /> Operação concluída</span>
              )}
            </div>

            <button
              className="operator-nav-button"
              disabled={currentIndex >= tasks.length - 1}
              onClick={() => setSelectedTaskId(tasks[currentIndex + 1]?.id ?? task.id)}
            >
              Próxima <ChevronRight size={18} />
            </button>
          </footer>
        </main>
      </div>
    )}

    {problemModal && task && <div className="modal-backdrop">
      <section className="form-modal operator-problem-modal">
        <div className="modal-head">
          <div>
            <span className="section-kicker">Não conformidade / ajuda</span>
            <h2>Informar problema</h2>
          </div>
          <button className="icon-button" onClick={() => setProblemModal(false)}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label className="span-2">
            <span>Operação</span>
            <input value={`${task.operacao.codigo} · ${task.operacao.nome}`} disabled />
          </label>
          <label className="span-2">
            <span>O que aconteceu? *</span>
            <textarea
              rows={5}
              value={problemText}
              onChange={(event) => setProblemText(event.target.value)}
              placeholder="Ex.: máquina desregulada, peça com defeito, dúvida na instrução..."
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setProblemModal(false)}>Cancelar</button>
          <button className="primary-button" disabled={busy || !problemText.trim()} onClick={reportProblem}>
            <AlertTriangle size={16} /> Registrar e bloquear
          </button>
        </div>
      </section>
    </div>}
  </>
}

function statusLabel(status: ProductionOperationTask['status']) {
  if (status === 'em_execucao') return 'Em execução'
  if (status === 'concluida') return 'Concluída'
  if (status === 'bloqueada') return 'Bloqueada'
  return 'Pendente'
}

function difficultyLabel(value: ProductionOperationTask['operacao']['dificuldade']) {
  if (value === 'facil') return 'Fácil'
  if (value === 'dificil') return 'Difícil'
  return 'Médio'
}

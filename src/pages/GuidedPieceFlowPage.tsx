import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Factory,
  FileText,
  ImagePlus,
  Loader2,
  MonitorPlay,
  PackageCheck,
  PlayCircle,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import {
  createProduct,
} from '../firebase/productRepository'
import {
  openOrCreateTechnicalDraft,
  publishTechnicalRevision,
  saveTechnicalDraft,
  submitTechnicalRevision,
} from '../firebase/technicalSheetRepository'
import {
  createProductionOrder,
  releaseProductionOrder,
} from '../firebase/productionOrderRepository'
import {
  deleteTechnicalSheetImage,
  uploadTechnicalSheetImage,
} from '../firebase/storageRepository'
import type {
  Product,
  ProductionVariant,
  TechnicalOperation,
  TechnicalRevision,
} from '../domain/types'

type Props = {
  notify: (message: string) => void
  openOperator: () => void
  openPassport: () => void
}

type Step = 1 | 2 | 3 | 4 | 5

function newOperation(order: number): TechnicalOperation {
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

function demoOperations(): TechnicalOperation[] {
  return [
    {
      ...newOperation(1),
      codigo: '10',
      nome: 'Preparar a peça',
      descricao: 'Conferir componentes, posicionamento e referências antes de iniciar a montagem.',
      maquina: 'Bancada de preparação',
      tempoPadraoMin: 0.3,
      dificuldade: 'facil',
      instrucoes: [
        'Separar todos os componentes da peça.',
        'Conferir frente, costas e demais partes.',
        'Validar posição e orientação antes da montagem.',
      ],
      pontosCriticos: ['Componentes corretos', 'Orientação da peça'],
    },
    {
      ...newOperation(2),
      codigo: '20',
      nome: 'Montagem principal',
      descricao: 'Executar a montagem principal seguindo a referência visual e a sequência definida.',
      maquina: 'Máquina principal',
      tempoPadraoMin: 0.7,
      dificuldade: 'medio',
      instrucoes: [
        'Posicionar os componentes conforme o padrão.',
        'Executar a montagem mantendo alinhamento.',
        'Conferir a uniformidade antes de seguir.',
      ],
      pontosCriticos: ['Alinhamento', 'Acabamento uniforme'],
    },
    {
      ...newOperation(3),
      codigo: '30',
      nome: 'Acabamento',
      descricao: 'Realizar o acabamento final da peça e eliminar imperfeições visuais.',
      maquina: 'Estação de acabamento',
      tempoPadraoMin: 0.5,
      dificuldade: 'medio',
      instrucoes: [
        'Finalizar bordas e acabamentos.',
        'Remover excessos e resíduos.',
        'Comparar a peça com a referência aprovada.',
      ],
      pontosCriticos: ['Sem resíduos', 'Acabamento regular'],
    },
    {
      ...newOperation(4),
      codigo: '40',
      nome: 'Conferência final',
      descricao: 'Conferir visualmente a peça antes de liberar para a próxima etapa do processo.',
      maquina: 'Bancada de inspeção',
      tempoPadraoMin: 0.25,
      dificuldade: 'facil',
      instrucoes: [
        'Conferir aparência geral.',
        'Validar medidas e pontos críticos definidos.',
        'Liberar a peça somente se estiver conforme.',
      ],
      pontosCriticos: ['Sem defeitos aparentes', 'Produto conforme padrão'],
    },
  ]
}

export default function GuidedPieceFlowPage({
  notify,
  openOperator,
  openPassport,
}: Props) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id

  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [draft, setDraft] = useState<TechnicalRevision | null>(null)
  const [order, setOrder] = useState<{ id: string; numero: string } | null>(null)

  const [piece, setPiece] = useState({
    descricao: '',
    codigo: '',
    cor: '',
    tamanhos: 'P, M, G, GG',
  })
  const [construction, setConstruction] = useState('')
  const [uploading, setUploading] = useState(false)
  const [orderForm, setOrderForm] = useState({
    prazo: '',
    cor: '',
  })
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const sizes = useMemo(
    () => piece.tamanhos
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    [piece.tamanhos],
  )

  const progress = ((step - 1) / 4) * 100

  const createPiece = async () => {
    if (!empresaId || !user) return
    if (!piece.descricao.trim()) {
      setError('Informe o nome da peça.')
      return
    }

    const generatedCode = piece.codigo.trim().toUpperCase()
      || `PEC-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(Date.now()).slice(-3)}`

    setBusy(true)
    setError('')
    try {
      await createProduct(empresaId, user.uid, {
        codigo: generatedCode,
        descricao: piece.descricao,
        classificacoes: {
          cor: piece.cor.trim(),
          tamanhos: sizes.join(', '),
        },
      })

      const created: Product = {
        id: generatedCode,
        codigo: generatedCode,
        descricao: piece.descricao.trim(),
        classificacoes: {
          cor: piece.cor.trim(),
          tamanhos: sizes.join(', '),
        },
        status: 'ativo',
      }
      const revision = await openOrCreateTechnicalDraft(empresaId, user.uid, created)
      const simplified: TechnicalRevision = {
        ...revision,
        construcao: construction,
        tamanhos: sizes,
        blocos: {
          bom: false,
          medidas: false,
          checklist: false,
        },
        bom: [],
        medidas: [],
        checklist: [],
      }
      await saveTechnicalDraft(empresaId, user.uid, simplified)

      setProduct(created)
      setDraft(simplified)
      setPiece((current) => ({ ...current, codigo: generatedCode }))
      setOrderForm((current) => ({ ...current, cor: piece.cor.trim() }))
      setQuantities(Object.fromEntries(sizes.map((size) => [size, 0])))
      setStep(2)
      notify('Peça criada. Agora complete o Passaporte.')
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a peça.')
    } finally {
      setBusy(false)
    }
  }

  const updateDraft = (patch: Partial<TechnicalRevision>) => {
    if (!draft) return
    setDraft({ ...draft, ...patch })
  }

  const savePassportBasics = async () => {
    if (!empresaId || !user || !draft) return
    const nextConstruction = construction.trim()
    if (!nextConstruction) {
      setError('Escreva uma descrição simples de como a peça é construída.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const next = {
        ...draft,
        construcao: nextConstruction,
        tamanhos: sizes,
      }
      await saveTechnicalDraft(empresaId, user.uid, next)
      setDraft(next)
      setStep(3)
      notify('Passaporte básico salvo. Agora defina as operações.')
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o Passaporte.')
    } finally {
      setBusy(false)
    }
  }

  const uploadImage = async (file: File) => {
    if (!empresaId || !draft) return
    setUploading(true)
    setError('')
    try {
      const uploaded = await uploadTechnicalSheetImage(
        empresaId,
        draft.produtoCodigo,
        draft.numero,
        file,
      )
      const next = {
        ...draft,
        imagens: [
          ...draft.imagens,
          {
            url: uploaded.url,
            path: uploaded.path,
            legenda: 'Referência principal da peça',
            ordem: draft.imagens.length + 1,
          },
        ],
      }
      setDraft(next)
      if (user) await saveTechnicalDraft(empresaId, user.uid, next)
      notify('Imagem adicionada ao Passaporte.')
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = async (path?: string, index?: number) => {
    if (!draft || index == null) return
    if (path) {
      try {
        await deleteTechnicalSheetImage(path)
      } catch (reason) {
        console.warn(reason)
      }
    }
    const next = {
      ...draft,
      imagens: draft.imagens.filter((_, itemIndex) => itemIndex !== index),
    }
    setDraft(next)
    if (empresaId && user) await saveTechnicalDraft(empresaId, user.uid, next)
  }

  const setOperations = (operations: TechnicalOperation[]) => {
    if (!draft) return
    setDraft({ ...draft, operacoes: operations.map((item, index) => ({ ...item, ordem: index + 1 })) })
  }

  const addOperation = () => {
    if (!draft) return
    setOperations([...draft.operacoes, newOperation(draft.operacoes.length + 1)])
  }

  const updateOperation = (id: string, patch: Partial<TechnicalOperation>) => {
    if (!draft) return
    setOperations(draft.operacoes.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const removeOperation = (id: string) => {
    if (!draft) return
    setOperations(draft.operacoes.filter((item) => item.id !== id))
  }

  const saveOperations = async () => {
    if (!empresaId || !user || !draft) return
    if (draft.operacoes.length === 0) {
      setError('Adicione ao menos uma operação.')
      return
    }
    if (draft.operacoes.some((item) => !item.nome.trim() || !item.descricao.trim())) {
      setError('Preencha nome e instrução principal de todas as operações.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await saveTechnicalDraft(empresaId, user.uid, draft)
      setStep(4)
      notify('Operações salvas. A peça já pode ser liberada para produção.')
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar as operações.')
    } finally {
      setBusy(false)
    }
  }

  const releasePiece = async () => {
    if (!empresaId || !user || !draft) return
    setBusy(true)
    setError('')
    try {
      await saveTechnicalDraft(empresaId, user.uid, draft)
      await submitTechnicalRevision(empresaId, user.uid, draft)
      await publishTechnicalRevision(empresaId, user.uid, {
        ...draft,
        status: 'em_validacao',
      })
      setDraft({ ...draft, status: 'padrao' })
      setStep(5)
      notify('Peça liberada. Agora crie a Ordem de Produção.')
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível liberar a peça.')
    } finally {
      setBusy(false)
    }
  }

  const createAndReleaseOrder = async () => {
    if (!empresaId || !user || !product) return
    const variants: ProductionVariant[] = sizes
      .map((size) => ({
        id: crypto.randomUUID(),
        nome: size,
        quantidade: Number(quantities[size] ?? 0),
      }))
      .filter((variant) => variant.quantidade > 0)

    if (variants.length === 0) {
      setError('Informe a quantidade que será produzida em pelo menos um tamanho.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const created = await createProductionOrder(empresaId, user.uid, {
        prazo: orderForm.prazo,
        itens: [{
          produtoCodigo: product.codigo,
          produtoDescricao: product.descricao,
          cor: orderForm.cor,
          variantes,
        }],
      })
      await releaseProductionOrder(empresaId, user.uid, created.id, null)
      setOrder(created)
      notify(`${created.numero} criada e liberada para o chão de fábrica.`)
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a OP.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStep(1)
    setError('')
    setProduct(null)
    setDraft(null)
    setOrder(null)
    setPiece({ descricao: '', codigo: '', cor: '', tamanhos: 'P, M, G, GG' })
    setConstruction('')
    setOrderForm({ prazo: '', cor: '' })
    setQuantities({})
  }

  return <>
    <section className="guided-flow-head">
      <div>
        <span className="guided-flow-kicker"><Sparkles size={14} /> Fluxo rápido</span>
        <h2>Da peça ao chão de fábrica</h2>
        <p>Um caminho guiado para criar, preparar e mandar uma peça para produção sem navegar por vários módulos.</p>
      </div>
      {step > 1 && !order && (
        <button className="guided-back-button" onClick={() => setStep((step - 1) as Step)}>
          <ArrowLeft size={16} /> Voltar
        </button>
      )}
    </section>

    <section className="guided-progress-card">
      <div className="guided-progress-line"><i style={{ width: `${progress}%` }} /></div>
      <div className="guided-steps">
        <GuidedStep number={1} current={step} label="Criar peça" />
        <GuidedStep number={2} current={step} label="Passaporte" />
        <GuidedStep number={3} current={step} label="Operações" />
        <GuidedStep number={4} current={step} label="Liberar" />
        <GuidedStep number={5} current={step} label="Produzir" />
      </div>
    </section>

    {error && <div className="form-error page-message guided-error">{error}</div>}

    {step === 1 && <section className="guided-stage-card">
      <div className="guided-stage-intro">
        <span className="guided-stage-icon"><PackageCheck size={26} /></span>
        <div>
          <span>Etapa 1</span>
          <h3>Crie a peça</h3>
          <p>Só o essencial. Os detalhes técnicos podem ser completados depois.</p>
        </div>
      </div>

      <div className="guided-form-grid">
        <label className="guided-field wide">
          <span>Nome da peça *</span>
          <input
            value={piece.descricao}
            onChange={(event) => setPiece({ ...piece, descricao: event.target.value })}
            placeholder="Ex.: Polo Masculina Corporativa"
            autoFocus
          />
        </label>
        <label className="guided-field">
          <span>Referência / código</span>
          <input
            value={piece.codigo}
            onChange={(event) => setPiece({ ...piece, codigo: event.target.value.toUpperCase() })}
            placeholder="Opcional · gerado automaticamente"
          />
        </label>
        <label className="guided-field">
          <span>Cor principal</span>
          <input
            value={piece.cor}
            onChange={(event) => setPiece({ ...piece, cor: event.target.value })}
            placeholder="Ex.: Azul Marinho"
          />
        </label>
        <label className="guided-field wide">
          <span>Tamanhos / variantes</span>
          <input
            value={piece.tamanhos}
            onChange={(event) => setPiece({ ...piece, tamanhos: event.target.value })}
            placeholder="P, M, G, GG"
          />
          <small>Separe por vírgula. Você poderá informar a quantidade de cada tamanho na OP.</small>
        </label>
      </div>

      <div className="guided-stage-actions">
        <span>Você não precisa cadastrar materiais, fornecedores ou categorias agora.</span>
        <button className="guided-primary-button" disabled={busy} onClick={createPiece}>
          {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          Criar peça e continuar
        </button>
      </div>
    </section>}

    {step === 2 && draft && <section className="guided-stage-card">
      <div className="guided-stage-intro">
        <span className="guided-stage-icon"><FileText size={26} /></span>
        <div>
          <span>Etapa 2</span>
          <h3>Monte o Passaporte básico</h3>
          <p>Explique a peça de forma visual e simples. BOM, medidas e outros detalhes ficam opcionais.</p>
        </div>
      </div>

      <div className="guided-passport-layout">
        <div className="guided-photo-zone">
          {draft.imagens[0] ? (
            <div className="guided-main-photo">
              <img src={draft.imagens[0].url} alt={draft.produtoDescricao} />
              <button onClick={() => removeImage(draft.imagens[0].path, 0)}><X size={15} /></button>
            </div>
          ) : (
            <label className="guided-photo-upload">
              {uploading ? <Loader2 className="spin" size={28} /> : <ImagePlus size={30} />}
              <strong>Adicionar foto da peça</strong>
              <span>Opcional, mas deixa a apresentação muito melhor.</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadImage(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          )}
        </div>

        <div className="guided-passport-copy">
          <div className="guided-piece-summary">
            <span>{product?.codigo}</span>
            <strong>{product?.descricao}</strong>
            <small>{piece.cor || 'Sem cor definida'} · {sizes.join(' · ')}</small>
          </div>
          <label className="guided-field">
            <span>Como essa peça é construída? *</span>
            <textarea
              rows={7}
              value={construction}
              onChange={(event) => {
                setConstruction(event.target.value)
                updateDraft({ construcao: event.target.value })
              }}
              placeholder="Ex.: Peça em malha, mangas curtas, gola aplicada, fechamento frontal e acabamento em bainha."
            />
          </label>

          <div className="guided-advanced-note">
            <Sparkles size={16} />
            <div>
              <strong>Modo rápido ativado</strong>
              <span>Materiais, medidas, checklist e documentação avançada podem ser adicionados depois no Passaporte completo.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="guided-stage-actions">
        <button className="guided-secondary-button" onClick={openPassport}>
          Abrir Passaporte completo
        </button>
        <button className="guided-primary-button" disabled={busy} onClick={savePassportBasics}>
          {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          Definir operações
        </button>
      </div>
    </section>}

    {step === 3 && draft && <section className="guided-stage-card">
      <div className="guided-stage-intro">
        <span className="guided-stage-icon"><Factory size={26} /></span>
        <div>
          <span>Etapa 3</span>
          <h3>Defina como produzir</h3>
          <p>Para a apresentação, basta nome + instrução. Máquina e tempo são opcionais.</p>
        </div>
      </div>

      <div className="guided-operation-toolbar">
        <button className="guided-example-button" onClick={() => setOperations(demoOperations())}>
          <Sparkles size={16} /> Usar sequência exemplo
        </button>
        <button className="guided-secondary-button" onClick={addOperation}>
          <Plus size={16} /> Nova operação
        </button>
      </div>

      <div className="guided-operation-list">
        {draft.operacoes.length === 0 && (
          <div className="guided-empty-operations">
            <Factory size={28} />
            <strong>Nenhuma operação ainda</strong>
            <span>Crie manualmente ou use a sequência exemplo para demonstrar rapidamente.</span>
          </div>
        )}

        {draft.operacoes.map((operation, index) => (
          <article className="guided-operation-card" key={operation.id}>
            <span className="guided-operation-number">{operation.codigo || String((index + 1) * 10)}</span>
            <div className="guided-operation-fields">
              <label>
                <span>Operação *</span>
                <input
                  value={operation.nome}
                  onChange={(event) => updateOperation(operation.id, { nome: event.target.value })}
                  placeholder="Ex.: Pregar manga"
                />
              </label>
              <label className="wide">
                <span>Instrução principal *</span>
                <input
                  value={operation.descricao}
                  onChange={(event) => updateOperation(operation.id, { descricao: event.target.value })}
                  placeholder="Explique em uma frase o que o operador precisa fazer."
                />
              </label>
              <label>
                <span>Máquina</span>
                <input
                  value={operation.maquina}
                  onChange={(event) => updateOperation(operation.id, { maquina: event.target.value })}
                  placeholder="Opcional"
                />
              </label>
              <label>
                <span>Tempo (min)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={operation.tempoPadraoMin ?? ''}
                  onChange={(event) => updateOperation(operation.id, {
                    tempoPadraoMin: event.target.value === '' ? null : Number(event.target.value),
                  })}
                  placeholder="0,50"
                />
              </label>
            </div>
            <button className="guided-operation-remove" onClick={() => removeOperation(operation.id)}>
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </div>

      <div className="guided-stage-actions">
        <span>Fotos, vídeos, regulagens e pontos críticos podem ser enriquecidos depois.</span>
        <button className="guided-primary-button" disabled={busy} onClick={saveOperations}>
          {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          Revisar e liberar
        </button>
      </div>
    </section>}

    {step === 4 && draft && <section className="guided-stage-card guided-release-card">
      <div className="guided-release-icon"><Rocket size={32} /></div>
      <span className="guided-stage-label">Etapa 4</span>
      <h3>Pronto para produção</h3>
      <p>
        O sistema vai publicar a <strong>REV {String(draft.numero).padStart(2, '0')}</strong> e congelar
        essas instruções quando a OP for criada.
      </p>

      <div className="guided-release-summary">
        <div><span>Peça</span><strong>{draft.produtoDescricao}</strong></div>
        <div><span>Referência</span><strong>{draft.produtoCodigo}</strong></div>
        <div><span>Operações</span><strong>{draft.operacoes.length}</strong></div>
        <div><span>Tamanhos</span><strong>{sizes.length}</strong></div>
      </div>

      <div className="guided-simple-flow">
        <span><FileText size={17} /> Publicar Passaporte</span>
        <ArrowRight size={17} />
        <span><Factory size={17} /> Criar OP</span>
        <ArrowRight size={17} />
        <span><MonitorPlay size={17} /> Chão de fábrica</span>
      </div>

      <button className="guided-release-button" disabled={busy} onClick={releasePiece}>
        {busy ? <Loader2 className="spin" size={19} /> : <Rocket size={19} />}
        Liberar para produção
      </button>
    </section>}

    {step === 5 && product && <section className="guided-stage-card">
      <div className="guided-stage-intro">
        <span className="guided-stage-icon"><Factory size={26} /></span>
        <div>
          <span>Etapa 5</span>
          <h3>{order ? 'OP pronta para produzir' : 'Crie a Ordem de Produção'}</h3>
          <p>{order ? 'A revisão e as operações já foram congeladas nesta OP.' : 'Informe apenas quantidade, tamanhos, cor e prazo.'}</p>
        </div>
      </div>

      {!order ? <>
        <div className="guided-order-grid">
          <div className="guided-order-main">
            <label className="guided-field">
              <span>Cor / variante</span>
              <input
                value={orderForm.cor}
                onChange={(event) => setOrderForm({ ...orderForm, cor: event.target.value })}
                placeholder="Ex.: Azul Marinho"
              />
            </label>
            <label className="guided-field">
              <span>Prazo</span>
              <input
                type="date"
                value={orderForm.prazo}
                onChange={(event) => setOrderForm({ ...orderForm, prazo: event.target.value })}
              />
            </label>
          </div>

          <div className="guided-size-grid">
            {sizes.map((size) => (
              <label key={size} className="guided-size-field">
                <span>{size}</span>
                <input
                  type="number"
                  min="0"
                  value={quantities[size] ?? 0}
                  onChange={(event) => setQuantities({
                    ...quantities,
                    [size]: Number(event.target.value),
                  })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="guided-stage-actions">
          <span>Total: <strong>{Object.values(quantities).reduce((sum, value) => sum + Number(value || 0), 0)} peças</strong></span>
          <button className="guided-primary-button" disabled={busy} onClick={createAndReleaseOrder}>
            {busy ? <Loader2 className="spin" size={18} /> : <PlayCircle size={18} />}
            Criar OP e mandar produzir
          </button>
        </div>
      </> : <div className="guided-success">
        <span className="guided-success-icon"><CheckCircle2 size={34} /></span>
        <span className="guided-stage-label">Fluxo concluído</span>
        <h3>{order.numero} está no chão de fábrica</h3>
        <p>A peça já pode ser executada operação por operação no Modo Operador.</p>

        <div className="guided-success-actions">
          <button className="guided-primary-button" onClick={openOperator}>
            <MonitorPlay size={18} /> Abrir Modo Operador
          </button>
          <button className="guided-secondary-button" onClick={openPassport}>
            <FileText size={18} /> Ver Passaporte
          </button>
          <button className="guided-secondary-button" onClick={reset}>
            <Plus size={18} /> Criar outra peça
          </button>
        </div>
      </div>}
    </section>}
  </>
}

function GuidedStep({
  number,
  current,
  label,
}: {
  number: Step
  current: Step
  label: string
}) {
  const done = current > number
  const active = current === number
  return <div className={`guided-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
    <span>{done ? <Check size={15} /> : number}</span>
    <strong>{label}</strong>
  </div>
}

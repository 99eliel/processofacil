import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Factory,
  FileText,
  Loader2,
  MonitorPlay,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { demoTechnicalPiece } from '../data/demoTechnicalPiece'
import {
  importDemoTechnicalPiece,
  importSimulationPackage,
  parseSimulationFile,
  resetSimulationJourney,
  type SimulationImportResult,
  type SimulationPackage,
} from '../firebase/simulationRepository'

type Props = {
  notify: (message: string) => void
  openOperator: () => void
  openPassport: () => void
}

export default function SimulationPage({ notify, openOperator, openPassport }: Props) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id
  const [pkg, setPkg] = useState<SimulationPackage | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<SimulationImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const readFile = async (file: File) => {
    setError('')
    setResult(null)
    try {
      const text = await file.text()
      const parsed = parseSimulationFile(text)
      setPkg(parsed)
      setFileName(file.name)
    } catch (reason) {
      console.error(reason)
      setPkg(null)
      setFileName('')
      setError(reason instanceof Error ? reason.message : 'Não foi possível ler o arquivo.')
    }
  }

  const importPackage = async () => {
    if (!empresaId || !user || !pkg) return
    setBusy(true)
    setError('')
    try {
      const imported = await importSimulationPackage(empresaId, user.uid, pkg)
      setResult(imported)
      notify(
        imported.alreadyExists
          ? 'Este cenário já existe. Você pode abrir o Modo Operador ou reiniciar o trajeto.'
          : 'Cenário importado. A OP já está liberada para execução.',
      )
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível importar o cenário.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!empresaId || !user || !pkg) return
    setBusy(true)
    setError('')
    try {
      await resetSimulationJourney(empresaId, user.uid, pkg.id)
      notify('Trajeto reiniciado. Todas as operações voltaram para Pendente.')
      setResult((current) => current ?? {
        orderId: `sim-${pkg.id}`,
        orderNumber: pkg.op.numero,
        productCode: pkg.produto.codigo,
        operations: pkg.ficha.operacoes.length,
        materials: pkg.materiais.length,
        alreadyExists: true,
      })
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível reiniciar a simulação.')
    } finally {
      setBusy(false)
    }
  }

  const downloadDemoJson = () => {
    const blob = new Blob([JSON.stringify(demoTechnicalPiece, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'processo-facil-demo-polo-completa.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const createDemoPiece = async () => {
    if (!empresaId || !user) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const parsed = structuredClone(demoTechnicalPiece)
      setPkg(parsed)
      setFileName('Peça demonstrativa interna')
      const imported = await importDemoTechnicalPiece(empresaId, user.uid, parsed)
      setResult(imported)
      notify(
        imported.alreadyExists
          ? 'A peça demonstrativa já existe e está disponível para edição.'
          : 'Peça demonstrativa criada como rascunho. Agora só falta adicionar as imagens.',
      )
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a peça demonstrativa.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="page-intro">
      <div>
        <span className="section-kicker">Laboratório do processo</span>
        <h2>Simulador de Trajeto</h2>
        <p>
          Importe um cenário pronto e acompanhe uma peça desde os cadastros técnicos
          até a execução das operações no chão de fábrica.
        </p>
      </div>
      <div className="simulation-header-actions">
        <button className="primary-button" disabled={busy} onClick={() => void createDemoPiece()}>
          {busy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
          Criar peça demo completa
        </button>
        <button className="secondary-button simulation-download" type="button" onClick={downloadDemoJson}>
          <FileText size={17} /> Baixar JSON
        </button>
      </div>
    </section>

    <section className="simulation-flow panel">
      <div className="simulation-flow-step">
        <span>1</span>
        <div><strong>Pacote JSON</strong><small>Materiais, produto, FT, POPs e OP.</small></div>
      </div>
      <ArrowRight size={18} />
      <div className="simulation-flow-step">
        <span>2</span>
        <div><strong>Importação</strong><small>Cria o cenário real no Firestore.</small></div>
      </div>
      <ArrowRight size={18} />
      <div className="simulation-flow-step">
        <span>3</span>
        <div><strong>Modo Operador</strong><small>Inicie, conclua ou bloqueie operações.</small></div>
      </div>
      <ArrowRight size={18} />
      <div className="simulation-flow-step">
        <span>4</span>
        <div><strong>Rastreabilidade</strong><small>Veja o caminho percorrido pela peça.</small></div>
      </div>
    </section>

    <div className="two-columns simulation-grid">
      <section className="panel simulation-upload-panel">
        <div className="panel-head">
          <div><span className="section-kicker">Entrada</span><h3>Carregar pacote de simulação</h3></div>
          <Upload size={20} />
        </div>

        <label className="simulation-dropzone">
          <Upload size={28} />
          <strong>{fileName || 'Escolha o arquivo .json'}</strong>
          <span>Opcional. O botão “Criar peça demo completa” acima já faz o teste sem precisar baixar arquivo.</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void readFile(file)
              event.currentTarget.value = ''
            }}
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        {pkg && <div className="simulation-package-preview">
          <div className="simulation-package-title">
            <CheckCircle2 size={19} />
            <div><strong>{pkg.nome}</strong><span>{pkg.descricao || 'Cenário compatível com o Processo Fácil.'}</span></div>
          </div>

          <div className="simulation-preview-stats">
            <div><PackageCheck size={17} /><strong>{pkg.produto.codigo}</strong><span>{pkg.produto.descricao}</span></div>
            <div><Factory size={17} /><strong>{pkg.materiais.length}</strong><span>materiais</span></div>
            <div><MonitorPlay size={17} /><strong>{pkg.ficha.operacoes.length}</strong><span>operações/POPs</span></div>
            <div><FileText size={17} /><strong>{pkg.op.numero}</strong><span>{pkg.op.variantes.reduce((sum, item) => sum + item.quantidade, 0)} peças</span></div>
          </div>

          <button className="primary-button simulation-import-button" disabled={busy} onClick={importPackage}>
            {busy ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
            Importar e preparar OP
          </button>
        </div>}
      </section>

      <section className="panel simulation-result-panel">
        <div className="panel-head">
          <div><span className="section-kicker">Resultado</span><h3>Trajeto de teste</h3></div>
          <MonitorPlay size={20} />
        </div>

        {!result ? <div className="empty-state small-empty">
          <MonitorPlay size={30} />
          <strong>Aguardando importação</strong>
          <span>Depois da importação, a OP de simulação ficará pronta no Modo Operador.</span>
        </div> : <>
          <div className="simulation-success">
            <CheckCircle2 size={26} />
            <div>
              <strong>{result.orderNumber ? (result.alreadyExists ? 'Cenário já disponível' : 'Cenário criado com sucesso') : (result.alreadyExists ? 'Peça demo já disponível' : 'Peça demo criada com sucesso')}</strong>
              <span>{result.orderNumber ? `${result.orderNumber} · ${result.productCode}` : `${result.productCode} · REV 01 em rascunho`}</span>
            </div>
          </div>

          <div className="simulation-created-list">
            <div><span>Materiais</span><strong>{result.materials}</strong></div>
            <div><span>Produto</span><strong>{result.productCode}</strong></div>
            <div><span>Ficha Técnica</span><strong>REV 01</strong></div>
            <div><span>Operações / POPs</span><strong>{result.operations}</strong></div>
            {result.orderNumber ? <>
              <div><span>OP</span><strong>{result.orderNumber}</strong></div>
              <div><span>Status inicial</span><strong>Em fluxo</strong></div>
            </> : <>
              <div><span>Status</span><strong>Rascunho editável</strong></div>
              <div><span>Falta</span><strong>Adicionar imagens</strong></div>
            </>}
          </div>

          <div className="simulation-actions">
            {result.orderNumber ? <>
              <button className="primary-button" onClick={openOperator}>
                <MonitorPlay size={17} /> Abrir Modo Operador
              </button>
              <button className="secondary-button" disabled={busy || !pkg} onClick={reset}>
                {busy ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />}
                Reiniciar trajeto
              </button>
            </> : <button className="primary-button" onClick={openPassport}>
              <FileText size={17} /> Abrir Ficha Técnica e adicionar imagens
            </button>}
          </div>
        </>}
      </section>
    </div>

    <section className="panel simulation-explanation">
      <div className="panel-head">
        <div><span className="section-kicker">O que o teste cria</span><h3>Fluxo completo e rastreável</h3></div>
      </div>
      <div className="simulation-check-grid">
        <span><CheckCircle2 size={16} /> Cadastro dos materiais usados</span>
        <span><CheckCircle2 size={16} /> Produto de teste</span>
        <span><CheckCircle2 size={16} /> Passaporte Digital REV 01 publicada</span>
        <span><CheckCircle2 size={16} /> BOM e tabela de medidas</span>
        <span><CheckCircle2 size={16} /> Sequência operacional + POPs</span>
        <span><CheckCircle2 size={16} /> OP já liberada</span>
        <span><CheckCircle2 size={16} /> Operações congeladas na OP</span>
        <span><CheckCircle2 size={16} /> Registro de início, conclusão e problema</span>
      </div>
    </section>
  </>
}

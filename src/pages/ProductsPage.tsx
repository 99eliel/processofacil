import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Boxes, Calculator, CheckCircle2, Clock3, Copy, Download, Edit3, Eye, Factory, FileText, GitBranch, Image as ImageIcon, Loader2, PackageCheck, Plus, RotateCcw, Ruler, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { createProduct, generateNextProductCode, setProductActive, setProductDeleted, updateProduct } from '../firebase/productRepository'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { cloneTechnicalRevisionToProduct, getTechnicalRevision } from '../firebase/technicalSheetRepository'
import type { Product, ProductionOrderRecord, TechnicalRevision, TechnicalSheetSummary } from '../domain/types'
import type { CodeStrategy } from '../domain/codeEngine'

type ClassificationRow = { id: string; chave: string; valor: string }

export default function ProductsPage({
  notify,
  openPassport,
}: {
  notify: (message: string) => void
  openPassport?: (produtoCodigo: string) => void
}) {
  const { activeCompany, settings, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: products, loading, error } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: summaries } = useTenantCollection<TechnicalSheetSummary>(empresaId, 'fichas', 'produtoDescricao')
  const { items: orders } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [description, setDescription] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [externalCode, setExternalCode] = useState('')
  const [segmentValues, setSegmentValues] = useState<Record<string, string>>({})
  const [classificationRows, setClassificationRows] = useState<ClassificationRow[]>([])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedRevision, setSelectedRevision] = useState<TechnicalRevision | null>(null)
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [duplicateSource, setDuplicateSource] = useState<Product | null>(null)
  const [copyTechnicalData, setCopyTechnicalData] = useState(true)
  const [materialQuantities, setMaterialQuantities] = useState<Record<string, number>>({})

  const strategy = settings.estrategiaCodigo as CodeStrategy

  const selectedSummary = selectedProduct
    ? summaries.find((item) => item.produtoCodigo === selectedProduct.codigo)
    : undefined

  const selectedRevisionNumber = selectedProduct
    ? (selectedProduct.revisaoVigente
      ?? selectedSummary?.revisaoVigente
      ?? selectedSummary?.revisaoRascunho
      ?? null)
    : null

  const relatedOrders = useMemo(() => {
    if (!selectedProduct) return []
    return orders
      .filter((order) =>
        !order.excluido
        && order.itens.some((item) => item.produtoCodigo === selectedProduct.codigo),
      )
      .sort((a, b) => b.numero.localeCompare(a.numero))
  }, [orders, selectedProduct])

  useEffect(() => {
    if (!empresaId || !selectedProduct || !selectedRevisionNumber) {
      setSelectedRevision(null)
      return
    }

    let cancelled = false
    setRevisionLoading(true)
    getTechnicalRevision(empresaId, selectedProduct.codigo, selectedRevisionNumber)
      .then((revision) => {
        if (!cancelled) setSelectedRevision(revision)
      })
      .catch((reason) => {
        console.error(reason)
        if (!cancelled) setSelectedRevision(null)
      })
      .finally(() => {
        if (!cancelled) setRevisionLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [empresaId, selectedProduct?.codigo, selectedRevisionNumber])

  useEffect(() => {
    if (!selectedRevision) {
      setMaterialQuantities({})
      return
    }
    const keys = selectedRevision.tamanhos.length > 0 ? selectedRevision.tamanhos : ['TOTAL']
    setMaterialQuantities(Object.fromEntries(keys.map((key) => [key, 0])))
  }, [selectedRevision?.produtoCodigo, selectedRevision?.numero])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((product) => {
      if (!showDeleted && product.excluido) return false
      if (showDeleted && !product.excluido) return false
      if (!showInactive && product.status === 'inativo' && !product.excluido) return false
      if (!term) return true
      return [product.codigo, product.descricao, ...Object.values(product.classificacoes ?? {})]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [products, search, showInactive, showDeleted])

  const openCreate = () => {
    setEditing(null)
    setDuplicateSource(null)
    setCopyTechnicalData(false)
    setDescription('')
    setManualCode('')
    setExternalCode('')
    setSegmentValues({})
    setClassificationRows([])
    setFormError('')
    setModal(true)
  }

  const openDuplicate = (product: Product) => {
    setEditing(null)
    setDuplicateSource(product)
    setCopyTechnicalData(true)
    setDescription(`${product.descricao} - Cópia`)
    setManualCode('')
    setExternalCode('')
    setSegmentValues({})
    setClassificationRows(
      Object.entries(product.classificacoes ?? {}).map(([chave, valor]) => ({
        id: crypto.randomUUID(),
        chave,
        valor,
      })),
    )
    setFormError('')
    setModal(true)
  }

  const openEdit = (product: Product) => {
    setDuplicateSource(null)
    setEditing(product)
    setDescription(product.descricao)
    setClassificationRows(
      Object.entries(product.classificacoes ?? {}).map(([chave, valor]) => ({
        id: crypto.randomUUID(),
        chave,
        valor,
      })),
    )
    setFormError('')
    setModal(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!empresaId || !user) return
    if (!description.trim()) {
      setFormError('Informe a descrição do produto.')
      return
    }

    setBusy(true)
    setFormError('')
    try {
      if (editing) {
        const classifications = Object.fromEntries(
          classificationRows
            .map((row) => [row.chave.trim(), row.valor.trim()] as const)
            .filter(([key]) => Boolean(key)),
        )
        await updateProduct(empresaId, user.uid, editing.codigo, {
          descricao: description,
          classificacoes: classifications,
        })
        notify(`Produto ${editing.codigo} atualizado.`)
      } else {
        const codigo = await generateNextProductCode(empresaId, strategy, {
          manual: manualCode,
          external: externalCode,
          segmentValues,
        })

        const customClassifications = Object.fromEntries(
          classificationRows
            .map((row) => [row.chave.trim(), row.valor.trim()] as const)
            .filter(([key]) => Boolean(key)),
        )
        const classifications = strategy.tipo === 'segmentado'
          ? {
              ...Object.fromEntries((strategy.segmentos ?? []).map((segment) => [segment.nome, segmentValues[segment.id] ?? ''])),
              ...customClassifications,
            }
          : customClassifications

        await createProduct(empresaId, user.uid, {
          codigo,
          descricao: description,
          classificacoes: classifications,
        })

        if (duplicateSource && copyTechnicalData) {
          const sourceSummary = summaries.find((item) => item.produtoCodigo === duplicateSource.codigo)
          const sourceRevisionNumber = sourceSummary?.revisaoRascunho
            ?? duplicateSource.revisaoVigente
            ?? sourceSummary?.revisaoVigente
            ?? null

          if (sourceRevisionNumber) {
            await cloneTechnicalRevisionToProduct(
              empresaId,
              user.uid,
              duplicateSource.codigo,
              sourceRevisionNumber,
              {
                id: codigo,
                codigo,
                descricao: description.trim(),
                classificacoes: classifications,
                status: 'ativo',
              },
            )
          }
        }

        notify(duplicateSource
          ? `Produto ${codigo} duplicado${copyTechnicalData ? ' com dados técnicos' : ''}.`
          : `Produto ${codigo} criado.`)
      }

      setModal(false)
      setEditing(null)
      setDescription('')
      setManualCode('')
      setExternalCode('')
      setSegmentValues({})
      setClassificationRows([])
      setDuplicateSource(null)
      setCopyTechnicalData(false)
    } catch (reason) {
      console.error(reason)
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar o produto.')
    } finally {
      setBusy(false)
    }
  }

  const toggleState = async (product: Product) => {
    if (!empresaId || !user) return
    const next = product.status !== 'ativo'
    try {
      await setProductActive(empresaId, user.uid, product.codigo, next)
      notify(next ? 'Produto reativado.' : 'Produto inativado.')
    } catch (reason) {
      console.error(reason)
      notify('Não foi possível alterar o status do produto.')
    }
  }

  const toggleDeleted = async (product: Product) => {
    if (!empresaId || !user) return
    const restoring = Boolean(product.excluido)
    if (!restoring) {
      const confirmed = window.confirm(
        `Excluir ${product.codigo} · ${product.descricao}?\n\nO produto sairá das telas normais, mas o histórico e as Fichas Técnicas serão preservados e ele poderá ser restaurado.`,
      )
      if (!confirmed) return
    }

    setBusy(true)
    try {
      await setProductDeleted(empresaId, user.uid, product.codigo, !restoring)
      notify(restoring ? 'Produto restaurado.' : 'Produto excluído da visualização.')
      if (editing?.codigo === product.codigo) setModal(false)
    } catch (reason) {
      console.error(reason)
      notify(reason instanceof Error ? reason.message : 'Não foi possível alterar o produto.')
    } finally {
      setBusy(false)
    }
  }

  const downloadMaterialNeedCsv = () => {
    if (!selectedRevision || !selectedProduct) return
    const sizes = selectedRevision.tamanhos.length > 0 ? selectedRevision.tamanhos : ['TOTAL']
    const totalPieces = sizes.reduce((sum, size) => sum + Number(materialQuantities[size] ?? 0), 0)
    const rows = selectedRevision.bom.map((line) => {
      const variable = line.consumoPorTamanho && Object.keys(line.consumoPorTamanho).length > 0
      const base = variable
        ? sizes.reduce((sum, size) => sum + Number(line.consumoPorTamanho?.[size] ?? line.consumo) * Number(materialQuantities[size] ?? 0), 0)
        : Number(line.consumo) * totalPieces
      const total = base * (1 + Number(line.perdaPercentual || 0) / 100)
      return [
        line.codigoSnapshot,
        line.descricaoSnapshot,
        line.fornecedorSnapshot || '',
        line.unidade,
        total.toFixed(4).replace('.', ','),
        String(line.perdaPercentual ?? 0).replace('.', ','),
      ]
    })
    const csv = [
      ['Codigo','Material','Fornecedor','Unidade','Quantidade necessaria','Perda %'],
      ...rows,
    ].map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `necessidade-materiais-${selectedProduct.codigo}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (selectedProduct) {
    const heroImage = selectedRevision?.imagens
      ?.slice()
      .sort((a, b) => {
        const rank = (type?: string) => type === 'frente' ? 0 : type === 'peca_perfeita' ? 1 : 2
        return rank(a.tipo) - rank(b.tipo) || a.ordem - b.ordem
      })[0]
    const openRelatedOrders = relatedOrders.filter((order) => !['concluida', 'cancelada'].includes(order.status))
    const totalProducedPlanned = relatedOrders.reduce(
      (sum, order) => sum + order.itens
        .filter((item) => item.produtoCodigo === selectedProduct.codigo)
        .reduce((itemSum, item) => itemSum + item.quantidadeTotal, 0),
      0,
    )

    return <>
      <button className="back-link product-360-back" onClick={() => {
        setSelectedProduct(null)
        setSelectedRevision(null)
      }}>
        <ArrowLeft size={16} /> Voltar para produtos
      </button>

      <section className="product-360-hero">
        <div className="product-360-image">
          {heroImage?.url
            ? <img src={heroImage.url} alt={heroImage.legenda || selectedProduct.descricao} />
            : <PackageCheck size={54} />}
        </div>
        <div className="product-360-main">
          <span className="section-kicker">Produto · visão completa</span>
          <div className="product-360-title-row">
            <div>
              <span className="product-360-code">{selectedProduct.codigo}</span>
              <h2>{selectedProduct.descricao}</h2>
            </div>
            <span className={`status ${selectedProduct.status === 'ativo' ? 'status-green' : 'status-slate'}`}>
              {selectedProduct.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div className="product-360-tags">
            {Object.entries(selectedProduct.classificacoes ?? {}).map(([key, value]) => (
              <span key={key}><small>{key}</small>{value}</span>
            ))}
            {Object.keys(selectedProduct.classificacoes ?? {}).length === 0 && <span><small>Classificação</small>Não informada</span>}
          </div>
          <div className="product-360-actions">
            <button className="secondary-button" onClick={() => openEdit(selectedProduct)}><Edit3 size={16} /> Editar produto</button>
            <button className="secondary-button" onClick={() => openDuplicate(selectedProduct)}><Copy size={16} /> Duplicar produto</button>
            {openPassport && <button className="primary-button" onClick={() => openPassport(selectedProduct.codigo)}><FileText size={16} /> Abrir Ficha Técnica</button>}
          </div>
        </div>
      </section>

      <section className="product-360-stats">
        <div><FileText size={20} /><span>Ficha Técnica</span><strong>{selectedSummary?.status === 'padrao' ? `REV ${String(selectedSummary.revisaoVigente ?? 0).padStart(2, '0')} padrão` : selectedSummary?.status === 'em_validacao' ? 'Em validação' : selectedSummary?.revisaoRascunho ? `REV ${String(selectedSummary.revisaoRascunho).padStart(2, '0')} em edição` : 'Ainda não publicada'}</strong></div>
        <div><Boxes size={20} /><span>Materiais na FT</span><strong>{selectedRevision?.bom.length ?? 0}</strong></div>
        <div><Factory size={20} /><span>Operações</span><strong>{selectedRevision?.operacoes.length ?? 0}</strong></div>
        <div><Clock3 size={20} /><span>OPs relacionadas</span><strong>{relatedOrders.length} · {openRelatedOrders.length} abertas</strong></div>
        <div><PackageCheck size={20} /><span>Quantidade em OPs</span><strong>{totalProducedPlanned}</strong></div>
      </section>

      {revisionLoading && <div className="loading-panel"><Loader2 className="spin" size={22} /> Carregando dados técnicos do produto...</div>}

      {!revisionLoading && !selectedRevision && (
        <section className="panel product-360-empty-ft">
          <FileText size={30} />
          <div><strong>Este produto ainda não possui uma Ficha Técnica disponível</strong><span>O cadastro do produto existe, mas os dados técnicos ainda não foram publicados.</span></div>
          {openPassport && <button className="primary-button compact" onClick={() => openPassport(selectedProduct.codigo)}>Criar / abrir Ficha Técnica</button>}
        </section>
      )}

      {selectedRevision && <>
        <div className="product-360-grid">
          <section className="panel product-360-section">
            <div className="panel-head"><div><span className="section-kicker">Referência técnica</span><h3>Produto e tecido</h3></div><ImageIcon size={20} /></div>
            <div className="product-tech-summary">
              <InfoLine label="Construção" value={selectedRevision.construcao} />
              <InfoLine label="Cliente" value={selectedRevision.cliente} />
              <InfoLine label="Coleção" value={selectedRevision.colecao} />
              <InfoLine label="Família" value={selectedRevision.familia} />
              <InfoLine label="Modelo" value={selectedRevision.modelo} />
              <InfoLine label="Tecido principal" value={selectedRevision.dadosTecido.tecidoPrincipal} />
              <InfoLine label="Composição" value={selectedRevision.dadosTecido.composicao} />
              <InfoLine label="Gramatura" value={selectedRevision.dadosTecido.gramatura} />
              <InfoLine label="Rendimento" value={selectedRevision.dadosTecido.rendimento} />
              <InfoLine label="Cor" value={selectedRevision.dadosTecido.cor} />
            </div>
          </section>

          <section className="panel product-360-section">
            <div className="panel-head"><div><span className="section-kicker">Imagens e documentos</span><h3>Referências do produto</h3></div><ImageIcon size={20} /></div>
            {selectedRevision.imagens.length === 0
              ? <div className="product-mini-empty">Nenhuma imagem cadastrada nesta revisão.</div>
              : <div className="product-image-strip">{selectedRevision.imagens.slice().sort((a,b) => a.ordem-b.ordem).slice(0,6).map((item, index) => <figure key={item.path || item.url || index}><img src={item.url} alt={item.legenda || 'Referência do produto'} /><figcaption>{item.legenda || imageTypeProductLabel(item.tipo)}</figcaption></figure>)}</div>}
            <div className="product-document-count"><FileText size={17} /><strong>{selectedRevision.anexos.filter((item) => item.url).length}</strong><span>arquivo(s) anexado(s) à revisão</span></div>
          </section>
        </div>

        <section className="panel product-360-section">
          <div className="panel-head"><div><span className="section-kicker">Necessidade técnica</span><h3>Materiais previstos na Ficha Técnica</h3><p>Estes são os materiais necessários para fabricar o produto. O sistema apenas informa a necessidade; não controla separação física.</p></div><Boxes size={20} /></div>
          {selectedRevision.bom.length === 0
            ? <div className="product-mini-empty">Nenhum material cadastrado na revisão.</div>
            : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Material</th><th>Fornecedor</th><th>Consumo</th><th>Cor</th></tr></thead><tbody>
              {selectedRevision.bom.map((line) => <tr key={line.id}><td><strong>{line.codigoSnapshot}</strong></td><td>{line.descricaoSnapshot}</td><td>{line.fornecedorSnapshot || '—'}</td><td>{line.consumoPorTamanho && Object.keys(line.consumoPorTamanho).length > 0 ? 'Varia por tamanho' : `${line.consumo} ${line.unidade}`}</td><td>{line.corRegra === 'produto' ? 'Segue a peça' : line.corRegra === 'fixa' ? line.corFixa || 'Fixa' : '—'}</td></tr>)}
            </tbody></table></div>}
        </section>

        <section className="panel product-360-section product-material-simulator">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Planejamento rápido</span>
              <h3>Calcular materiais necessários</h3>
              <p>Informe a quantidade prevista por tamanho. O cálculo usa o consumo da Ficha Técnica e aplica a perda cadastrada em cada material.</p>
            </div>
            <Calculator size={20} />
          </div>

          <div className="material-simulation-sizes">
            {(selectedRevision.tamanhos.length > 0 ? selectedRevision.tamanhos : ['TOTAL']).map((size) => (
              <label key={size}>
                <span>{size === 'TOTAL' ? 'Quantidade de peças' : size}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={materialQuantities[size] ?? 0}
                  onChange={(event) => setMaterialQuantities({
                    ...materialQuantities,
                    [size]: Math.max(0, Number(event.target.value || 0)),
                  })}
                />
              </label>
            ))}
          </div>

          {(() => {
            const sizes = selectedRevision.tamanhos.length > 0 ? selectedRevision.tamanhos : ['TOTAL']
            const totalPieces = sizes.reduce((sum, size) => sum + Number(materialQuantities[size] ?? 0), 0)
            const calculated = selectedRevision.bom.map((line) => {
              const variable = Boolean(line.consumoPorTamanho && Object.keys(line.consumoPorTamanho).length > 0)
              const base = variable
                ? sizes.reduce((sum, size) =>
                    sum + Number(line.consumoPorTamanho?.[size] ?? line.consumo) * Number(materialQuantities[size] ?? 0),
                  0)
                : Number(line.consumo) * totalPieces
              return {
                line,
                total: base * (1 + Number(line.perdaPercentual || 0) / 100),
              }
            })

            return <>
              <div className="material-simulation-summary">
                <div><span>Peças simuladas</span><strong>{totalPieces}</strong></div>
                <div><span>Materiais calculados</span><strong>{calculated.length}</strong></div>
                <button className="secondary-button compact" disabled={calculated.length === 0} onClick={downloadMaterialNeedCsv}>
                  <Download size={15} /> Baixar CSV
                </button>
              </div>
              {calculated.length > 0 && <div className="table-wrap"><table>
                <thead><tr><th>Material</th><th>Consumo base</th><th>Perda</th><th>Necessidade calculada</th></tr></thead>
                <tbody>{calculated.map(({ line, total }) => <tr key={line.id}>
                  <td><strong>{line.codigoSnapshot}</strong><small className="table-sub">{line.descricaoSnapshot}</small></td>
                  <td>{line.consumoPorTamanho && Object.keys(line.consumoPorTamanho).length > 0 ? 'Por tamanho' : `${line.consumo} ${line.unidade}/peça`}</td>
                  <td>{line.perdaPercentual || 0}%</td>
                  <td><strong>{total.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {line.unidade}</strong></td>
                </tr>)}</tbody>
              </table></div>}
            </>
          })()}
        </section>

        <div className="product-360-grid">
          <section className="panel product-360-section">
            <div className="panel-head"><div><span className="section-kicker">Engenharia</span><h3>Operações</h3></div><Factory size={20} /></div>
            {selectedRevision.operacoes.length === 0
              ? <div className="product-mini-empty">Nenhuma operação cadastrada.</div>
              : <div className="product-operation-list">{selectedRevision.operacoes.slice().sort((a,b)=>a.ordem-b.ordem).map((op) => <div key={op.id}><span>{String(op.ordem).padStart(2,'0')}</span><div><strong>{op.nome}</strong><small>{[op.maquina, op.regulagem].filter(Boolean).join(' · ') || 'Sem preparação informada'}</small></div><em>{op.tempoPadraoMin != null ? `${op.tempoPadraoMin} min` : '—'}</em></div>)}</div>}
          </section>

          <section className="panel product-360-section">
            <div className="panel-head"><div><span className="section-kicker">Grade</span><h3>Medidas</h3></div><Ruler size={20} /></div>
            <div className="product-measure-overview">
              <div><strong>{selectedRevision.tamanhos.length}</strong><span>tamanhos</span></div>
              <div><strong>{selectedRevision.medidas.length}</strong><span>pontos de medida</span></div>
            </div>
            {selectedRevision.tamanhos.length > 0 && <div className="product-size-row">{selectedRevision.tamanhos.map((size) => <span key={size}>{size}</span>)}</div>}
            {selectedRevision.medidas.length > 0 && <div className="product-measure-list">{selectedRevision.medidas.slice(0,6).map((row) => <div key={row.id}><strong>{row.ponto}</strong><span>± {row.tolerancia} cm</span></div>)}</div>}
          </section>
        </div>
      </>}

      <section className="panel product-360-section">
        <div className="panel-head"><div><span className="section-kicker">Histórico produtivo</span><h3>Ordens de Produção deste produto</h3></div><Clock3 size={20} /></div>
        {relatedOrders.length === 0
          ? <div className="product-mini-empty">Este produto ainda não foi usado em nenhuma Ordem de Produção.</div>
          : <div className="product-order-list">{relatedOrders.map((order) => {
              const items = order.itens.filter((item) => item.produtoCodigo === selectedProduct.codigo)
              const quantity = items.reduce((sum, item) => sum + item.quantidadeTotal, 0)
              return <div key={order.id}><div><strong>{order.numero}</strong><span>{quantity} unidade(s){order.prazo ? ` · Prazo ${order.prazo}` : ''}</span></div><span className={`status ${orderStatusTone(order.status)}`}>{orderStatusProductLabel(order.status)}</span></div>
            })}</div>}
      </section>
    </>
  }

  return <>
    <section className="page-intro">
      <div>
        <span className="section-kicker">Cadastro universal</span>
        <h2>Produtos</h2>
        <p>O código segue a estratégia configurada pela empresa. Produtos podem existir antes da publicação de uma Ficha Técnica.</p>
      </div>
      <button className="primary-button" onClick={openCreate}><Plus size={18} /> Novo produto</button>
    </section>

    <section className="panel code-builder">
      <div className="panel-head">
        <div><span className="section-kicker">Estratégia ativa</span><h3>{strategyLabel(strategy.tipo)}</h3></div>
        <span className="status status-green">Configurada</span>
      </div>
      {strategy.tipo === 'segmentado' && <div className="segment-row">{(strategy.segmentos ?? []).map((segment) => <div className="segment-card" key={segment.id}><span>{segment.ordem}</span><div><strong>{segment.nome}</strong><small>{segment.tamanho} caracteres</small></div></div>)}</div>}
      <p className="helper-text">Esta configuração pertence somente a <strong>{activeCompany?.nomeFantasia}</strong> e pode ser alterada por um administrador.</p>
    </section>

    <div className="toolbar">
      <div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, descrição ou classificação..." /></div>
      <button className={`filter-button ${showInactive ? 'filter-active' : ''}`} onClick={() => setShowInactive((value) => !value)}>{showInactive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />} Inativos</button>
      <button className={`filter-button ${showDeleted ? 'filter-active danger-filter' : ''}`} onClick={() => setShowDeleted((value) => !value)}>
        {showDeleted ? <RotateCcw size={17} /> : <Trash2 size={17} />} {showDeleted ? 'Voltar aos produtos' : 'Excluídos'}
      </button>
    </div>
    {error && <div className="form-error page-message">{error}</div>}

    {loading ? <div className="loading-panel"><Loader2 className="spin" size={25} /> Carregando produtos...</div> :
      <section className="panel">
        {filtered.length === 0 ? <div className="empty-state"><PackageCheck size={30} /><strong>Nenhum produto cadastrado</strong><span>Crie o primeiro produto usando a estratégia de código da empresa.</span></div> :
          <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Classificações</th><th>Revisão vigente</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><strong>{product.codigo}</strong></td><td>{product.descricao}</td><td>{Object.entries(product.classificacoes ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || '—'}</td><td>{product.revisaoVigente ? `REV ${String(product.revisaoVigente).padStart(2, '0')}` : 'Sem FT padrão'}</td><td>{product.excluido
  ? <span className="status status-red">Excluído</span>
  : <span className={`status ${product.status === 'ativo' ? 'status-green' : 'status-slate'}`}>{product.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
}</td><td><div className="row-actions">
  {!product.excluido && <button title="Ver produto" onClick={() => setSelectedProduct(product)}><Eye size={15} /></button>}
  {!product.excluido && <button title="Editar" onClick={() => openEdit(product)}><Edit3 size={15} /></button>}
  {!product.excluido && <button title="Duplicar" onClick={() => openDuplicate(product)}><Copy size={15} /></button>}
  {!product.excluido && <button title={product.status === 'ativo' ? 'Inativar' : 'Reativar'} onClick={() => toggleState(product)}>{product.status === 'ativo' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button>}
  <button className={product.excluido ? 'restore-action' : 'danger-action'} title={product.excluido ? 'Restaurar' : 'Excluir'} onClick={() => void toggleDeleted(product)}>
    {product.excluido ? <RotateCcw size={15} /> : <Trash2 size={15} />}
  </button>
</div></td></tr>)}</tbody></table></div>}
      </section>}

    {modal && <div className="modal-backdrop"><form className="form-modal" onSubmit={submit}>
      <div className="modal-head"><div><span className="section-kicker">{editing ? 'Alteração controlada' : duplicateSource ? 'Reaproveitar produto' : 'Novo cadastro'}</span><h2>{editing ? 'Editar produto' : duplicateSource ? 'Duplicar produto' : 'Novo produto'}</h2></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X size={18} /></button></div>
      <div className="form-grid">
        {editing && <div className="info-banner span-2"><GitBranch size={18} /><div><strong>{editing.codigo}</strong><span>O código é imutável nesta edição. Mudanças estruturais devem usar uma migração controlada.</span></div></div>}
        {duplicateSource && <div className="info-banner span-2 duplicate-product-banner"><Copy size={18} /><div><strong>Origem: {duplicateSource.codigo} · {duplicateSource.descricao}</strong><span>O novo produto recebe outro código e pode reaproveitar toda a engenharia da Ficha Técnica.</span></div></div>}
        <label className="span-2"><span>Descrição *</span><input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Nome/descrição do produto" /></label>

        <div className="span-2 product-classification-editor">
          <div className="classification-editor-head">
            <div><span>Classificações</span><small>Campos livres do produto: família, modelo, coleção, cor ou qualquer outra classificação.</small></div>
            <button type="button" className="secondary-button compact" onClick={() => setClassificationRows([...classificationRows, { id: crypto.randomUUID(), chave: '', valor: '' }])}><Plus size={14} /> Adicionar campo</button>
          </div>
          {classificationRows.length === 0 ? <div className="classification-empty">Nenhuma classificação adicional.</div> :
            <div className="classification-row-list">{classificationRows.map((row) => <div key={row.id} className="classification-row">
              <input value={row.chave} onChange={(e) => setClassificationRows(classificationRows.map((item) => item.id === row.id ? { ...item, chave: e.target.value } : item))} placeholder="Campo · Ex.: Família" />
              <input value={row.valor} onChange={(e) => setClassificationRows(classificationRows.map((item) => item.id === row.id ? { ...item, valor: e.target.value } : item))} placeholder="Valor · Ex.: Uniformes" />
              <button type="button" className="icon-button danger-icon" onClick={() => setClassificationRows(classificationRows.filter((item) => item.id !== row.id))}><Trash2 size={14} /></button>
            </div>)}</div>}
        </div>

        {duplicateSource && <label className="span-2 duplicate-ft-toggle">
          <input type="checkbox" checked={copyTechnicalData} onChange={(e) => setCopyTechnicalData(e.target.checked)} />
          <span><strong>Copiar também a Ficha Técnica</strong><small>Materiais, medidas, operações, tecido, imagens de referência e anexos serão usados como base da REV 01 em rascunho.</small></span>
        </label>}

        {!editing && strategy.tipo === 'manual' && <label className="span-2"><span>Código *</span><input value={manualCode} onChange={(e) => setManualCode(e.target.value)} required placeholder="Código definido pela empresa" /></label>}
        {!editing && strategy.tipo === 'externo' && <label className="span-2"><span>Código externo *</span><input value={externalCode} onChange={(e) => setExternalCode(e.target.value)} required placeholder="Código vindo do ERP/sistema externo" /></label>}
        {!editing && strategy.tipo === 'sequencial' && <div className="info-banner span-2"><GitBranch size={18} /><div><strong>Código automático</strong><span>O próximo sequencial será reservado de forma transacional ao salvar.</span></div></div>}
        {!editing && strategy.tipo === 'segmentado' && (strategy.segmentos ?? []).map((segment) => <label key={segment.id}><span>{segment.nome} ({segment.tamanho})</span><input value={segmentValues[segment.id] ?? ''} onChange={(e) => setSegmentValues({ ...segmentValues, [segment.id]: e.target.value })} required={segment.obrigatorio} maxLength={segment.tamanho} minLength={segment.tamanho} placeholder={`${segment.tamanho} caracteres`} /></label>)}
      </div>
      {formError && <div className="form-error">{formError}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />} {editing ? 'Salvar alterações' : duplicateSource ? 'Criar cópia' : 'Criar produto'}</button></div>
    </form></div>}
  </>
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return <div><span>{label}</span><strong>{value?.trim() || '—'}</strong></div>
}

function imageTypeProductLabel(type?: string) {
  if (type === 'frente') return 'Frente'
  if (type === 'costas') return 'Costas'
  if (type === 'detalhe_1') return 'Detalhe 1'
  if (type === 'detalhe_2') return 'Detalhe 2'
  if (type === 'peca_perfeita') return 'Peça'
  return 'Referência'
}

function orderStatusProductLabel(status: ProductionOrderRecord['status']) {
  if (status === 'rascunho') return 'Rascunho'
  if (status === 'liberada') return 'Liberada'
  if (status === 'em_fluxo') return 'Em produção'
  if (status === 'concluida') return 'Concluída'
  if (status === 'cancelada') return 'Cancelada'
  return 'Reprovada'
}

function orderStatusTone(status: ProductionOrderRecord['status']) {
  if (status === 'concluida') return 'status-green'
  if (status === 'cancelada' || status === 'reprovada') return 'status-red'
  if (status === 'rascunho') return 'status-slate'
  return 'status-blue'
}

function strategyLabel(type: string) {
  if (type === 'manual') return 'Código manual'
  if (type === 'sequencial') return 'Código sequencial'
  if (type === 'segmentado') return 'Código por segmentos'
  return 'Código de sistema externo'
}

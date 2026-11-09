import { useMemo, useState } from 'react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { AlertTriangle, Factory, Loader2, Plus, Save, Trash2, Users } from 'lucide-react'
import { db } from '../firebase/config'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { useSystem } from '../system/SystemProvider'
import type { Product, ProductionOrderRecord } from '../domain/types'
import { calculateCapacity, numberHours, type CapacityResource, type CapacitySettingsRecord } from '../domain/capacityEngine'
import './CapacityPage.css'

type Kind = 'maquinas' | 'maoObra'
type Props = { kind: Kind; notify: (text: string) => void }
const freshResource = (kind: Kind): CapacityResource => ({
  id: crypto.randomUUID(),
  nome: kind === 'maoObra' ? 'Equipe geral' : '',
  quantidade: 1,
  horasDia: 8,
  diasSemana: 5,
  eficiencia: 85,
  ativo: true,
})
const percentage = (a: number, b: number) => b > 0 ? a / b * 100 : 0

export default function CapacityPage({ kind, notify }: Props) {
  const { activeCompany, user } = useSystem()
  const empresaId = activeCompany?.id
  const { items: orders, loading: ordersLoading, error: ordersError } = useTenantCollection<ProductionOrderRecord>(empresaId, 'ordensProducao', 'numero')
  const { items: products, loading: productsLoading, error: productsError } = useTenantCollection<Product>(empresaId, 'produtos', 'descricao')
  const { items: configurations, loading: configLoading, error: configError } = useTenantCollection<CapacitySettingsRecord>(empresaId, 'configuracoesCapacidade', 'tipo')
  const stored = configurations.find(c => c.id === kind)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CapacityResource[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const machines = kind === 'maquinas'
  const savedResources = stored?.recursos ?? []
  const calculation = useMemo(
    () => calculateCapacity(orders, products, savedResources, kind),
    [orders, products, stored, kind],
  )
  const { rows, totals } = calculation
  const title = machines ? 'Carga Máquina' : 'Carga Mão de Obra'
  const beginEdit = () => {
    setDraft(savedResources.length ? savedResources.map(r => ({ ...r })) : machines ? [] : [freshResource(kind)])
    setError('')
    setEditing(true)
  }
  const patch = (id: string, patchValue: Partial<CapacityResource>) =>
    setDraft(current => current.map(r => r.id === id ? { ...r, ...patchValue } : r))
  const save = async () => {
    if (!empresaId || !user || saving) return
    if (draft.some(r => !r.nome.trim() || !Number.isFinite(r.quantidade) || r.quantidade < 0
      || !Number.isFinite(r.horasDia) || r.horasDia < 0 || r.horasDia > 24
      || !Number.isFinite(r.diasSemana) || r.diasSemana < 0 || r.diasSemana > 7
      || !Number.isFinite(r.eficiencia) || r.eficiencia < 0 || r.eficiencia > 100)) {
      setError('Confira os nomes, quantidades e limites de horas, dias e eficiência.')
      return
    }
    if (new Set(draft.map(r => r.nome.trim().toLocaleLowerCase('pt-BR'))).size !== draft.length) {
      setError('Não é possível cadastrar dois recursos com o mesmo nome.')
      return
    }
    if (!machines && (draft.length !== 1 || draft[0]?.nome !== 'Equipe geral')) {
      setError('A carga de mão de obra deve utilizar uma única configuração chamada Equipe geral.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'empresas', empresaId, 'configuracoesCapacidade', kind), {
        tipo: kind, recursos: draft.map(r => ({ ...r, nome: r.nome.trim() })),
        alteradoEm: serverTimestamp(), alteradoPor: user.uid,
      })
      batch.set(doc(collection(db, 'empresas', empresaId, 'auditoria')), {
        entidade: 'configuracao_capacidade', entidadeId: kind, acao: 'alterada',
        resumo: title, uid: user.uid, em: serverTimestamp(),
      })
      await batch.commit()
      setEditing(false)
      notify('Capacidade atualizada com sucesso.')
    } catch (reason) {
      console.error(reason)
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar os dados.')
    } finally {
      setSaving(false)
    }
  }

  if (ordersLoading || productsLoading || configLoading) {
    return <div className="loading-panel"><Loader2 className="spin" size={22} /> Carregando capacidade...</div>
  }
  const configured = savedResources.some(r => r.ativo)
  const rate = percentage(totals.planejadas, totals.capacidade)
  return <div className="capacity-page">
    <section className="page-intro capacity-intro">
      <div>
        <span className="section-kicker">Planejamento e acompanhamento de execução</span>
        <h2>{title}</h2>
        <p>{machines
          ? 'Compare a carga por tipo de máquina com a capacidade semanal cadastrada.'
          : 'Compare a carga de trabalho das operações com a disponibilidade semanal da equipe.'}</p>
      </div>
      {!editing && <button className="primary-button" onClick={beginEdit}><Save size={16} /> Configurar capacidade</button>}
    </section>

    {(ordersError || productsError || configError || error) &&
      <div className="form-error page-message">{error || ordersError || productsError || configError}</div>}

    <div className="capacity-kpis">
      <article className="panel"><small>Demanda restante (sem calendário)</small><strong>{numberHours(totals.planejadas)} h</strong><span>Soma do tempo padrão das operações abertas</span></article>
      <article className="panel"><small>Capacidade por semana</small><strong>{numberHours(totals.capacidade)} h</strong><span>Recursos ativos × jornada × eficiência</span></article>
      <article className="panel"><small>Tempo padrão concluído</small><strong>{numberHours(totals.concluidasPadrao)} h</strong><span>Estimativa técnica das operações finalizadas</span></article>
      <article className="panel"><small>Tempo real decorrido</small><strong>{numberHours(totals.decorridas)} h</strong><span>Entre início e conclusão, inclui possíveis pausas</span></article>
    </div>

    {!configured && !editing && <div className="capacity-note"><AlertTriangle size={17} /> Configure {machines ? 'as máquinas' : 'o tamanho e a jornada da equipe'} para comparar capacidade e demanda.</div>}
    {totals.semTempo > 0 && <div className="capacity-note"><AlertTriangle size={17} /> {totals.semTempo} operação(ões) sem tempo padrão válido no Passaporte. Elas não entram na demanda calculada.</div>}
    <section className="panel capacity-chart">
      <div className="panel-head"><div><span className="section-kicker">Visão consolidada</span><h3>Demanda e disponibilidade</h3></div></div>
      <div className="capacity-meter"><span style={{ width: `${Math.min(100, rate)}%`, background: rate > 100 ? '#c55243' : '#137c88' }} /></div>
      <div className="capacity-meter-caption">
        <span>{totals.capacidade > 0 ? `${numberHours(rate)}% de uma semana de capacidade` : 'Capacidade ainda não configurada'}</span>
        <strong>{totals.capacidade > 0 && totals.planejadas > totals.capacidade
          ? `Excesso de ${numberHours(totals.planejadas - totals.capacidade)} h`
          : totals.capacidade > 0 ? `Folga de ${numberHours(totals.capacidade - totals.planejadas)} h` : '—'}</strong>
      </div>
      <p className="helper-text">Comparação de referência: demanda total pendente versus uma semana típica de capacidade. Não é programação por datas ou previsão automática de entrega.</p>
      <div className="capacity-summary">Operações: <strong>{totals.operacoes}</strong> · Em execução: <strong>{totals.emExecucao}</strong></div>
    </section>

    {editing && <section className="panel capacity-editor">
      <div className="panel-head"><div><span className="section-kicker">Parâmetros por empresa</span><h3>{machines ? 'Parque de máquinas' : 'Capacidade da equipe'}</h3></div></div>
      <p className="helper-text">Informe capacidade semanal disponível. Os nomes das máquinas devem corresponder ao campo Máquina das operações no Passaporte.</p>
      {draft.map(r => <div className="capacity-edit-row" key={r.id}>
        <label>Recurso<input value={r.nome} disabled={!machines} placeholder="Nome da máquina" onChange={e => patch(r.id, { nome: e.target.value })} /></label>
        <label>Quantidade<input type="number" min="0" step="1" value={r.quantidade} onChange={e => patch(r.id, { quantidade: Number(e.target.value) })} /></label>
        <label>Horas/dia<input type="number" min="0" max="24" step="0.5" value={r.horasDia} onChange={e => patch(r.id, { horasDia: Number(e.target.value) })} /></label>
        <label>Dias/semana<input type="number" min="0" max="7" step="1" value={r.diasSemana} onChange={e => patch(r.id, { diasSemana: Number(e.target.value) })} /></label>
        <label>Eficiência %<input type="number" min="0" max="100" step="1" value={r.eficiencia} onChange={e => patch(r.id, { eficiencia: Number(e.target.value) })} /></label>
        <label className="capacity-active"><input type="checkbox" checked={r.ativo} onChange={e => patch(r.id, { ativo: e.target.checked })} /> Ativo</label>
        {machines && <button type="button" className="icon-button danger-icon" title="Remover configuração" onClick={() => setDraft(old => old.filter(item => item.id !== r.id))}><Trash2 size={17}/></button>}
      </div>)}
      <div className="modal-actions">
        {machines && <button className="secondary-button" onClick={() => setDraft(old => [...old, freshResource(kind)])}><Plus size={15}/> Adicionar máquina</button>}
        <button className="secondary-button" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
        <button className="primary-button" disabled={saving} onClick={save}>{saving ? <Loader2 className="spin" size={16}/> : <Save size={16}/>} Salvar capacidade</button>
      </div>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><span className="section-kicker">Análise por recurso</span><h3>{machines ? 'Máquinas e carga programada' : 'Equipe e demanda'}</h3></div>{machines ? <Factory size={19} /> : <Users size={19}/>}</div>
      {rows.length === 0 ? <div className="empty-state"><strong>Sem operações para analisar</strong><span>Libere uma OP com Passaporte publicado ou cadastre a capacidade.</span></div>
        : <div className="table-wrap"><table><thead><tr><th>Recurso</th><th>Demanda restante</th><th>Capacidade semanal</th><th>Concluído padrão</th><th>Decorrido real</th><th>Utilização*</th></tr></thead><tbody>
          {rows.map(row => <tr key={row.nome}><td><strong>{row.nome}</strong>{!row.configurado && <small className="capacity-warning"> · Sem capacidade cadastrada</small>}</td>
            <td>{numberHours(row.previstasHoras)} h</td><td>{row.configurado ? `${numberHours(row.capacidadeHoras)} h` : '—'}</td>
            <td>{numberHours(row.concluidasHoras)} h</td><td>{numberHours(row.decorridasHoras)} h</td>
            <td>{row.capacidadeHoras > 0 ? `${numberHours(percentage(row.previstasHoras, row.capacidadeHoras))}%` : '—'}</td></tr>)}
        </tbody></table></div>}
      <p className="helper-text">* A demanda é calculada pelo tempo padrão por peça × quantidade total da OP. O decorrido real é o intervalo de execução registrado pelo operador, não uma medição de horas produtivas por unidade. Operações concluídas saem da demanda restante. Não são atribuídas datas às operações automaticamente.</p>
    </section>
  </div>
}

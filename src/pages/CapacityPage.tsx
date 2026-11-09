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
  nome: '',
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
    setDraft(savedResources.map(r => ({ ...r })))
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
          : 'Compare a carga planejada e o tempo decorrido de cada equipe com a capacidade semanal cadastrada.'}</p>
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
      {!machines && rows.some(row => row.nome === 'Sem equipe atribuída') && <div className="capacity-note"><AlertTriangle size={17} /> Existem operações sem equipe responsável. No Passaporte Digital, abra uma revisão em rascunho, escolha a equipe em cada operação, publique-a e libere uma nova OP para usar a atribuição.</div>}
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
      <div className="panel-head"><div><span className="section-kicker">Parâmetros por empresa</span><h3>{machines ? 'Parque de máquinas' : 'Gerenciar equipes'}</h3></div></div>
      <p className="helper-text">{machines ? 'Informe a capacidade semanal. O nome da máquina deve corresponder ao nome usado no Passaporte.' : 'Cadastre e renomeie suas equipes. Cada equipe tem seu próprio número de pessoas, jornada e eficiência. As equipes podem ser organizadas livremente.'}</p>
      {draft.length === 0 && <div className="capacity-empty-editor"><Users size={25} /><strong>{machines ? 'Nenhuma máquina cadastrada' : 'Nenhuma equipe cadastrada'}</strong><span>{machines ? 'Adicione uma máquina para começar.' : 'Adicione sua primeira equipe para definir a capacidade de trabalho.'}</span></div>}
      <div className="capacity-resource-list">
        {draft.map((r, index) => <article className="capacity-resource-card" key={r.id}>
          <div className="capacity-resource-head">
            <div className="capacity-resource-icon">{machines ? <Factory size={19} /> : <Users size={19} />}</div>
            <div className="capacity-resource-identity">
              <small>{machines ? `Máquina ${index + 1}` : `Equipe ${index + 1}`}</small>
              <strong>{r.nome.trim() || (machines ? 'Nova máquina' : 'Nova equipe')}</strong>
            </div>
            <span className="capacity-resource-hours">{numberHours(r.quantidade * r.horasDia * r.diasSemana * r.eficiencia / 100)} h/semana</span>
            <label className="capacity-resource-toggle"><input type="checkbox" checked={r.ativo} onChange={e => patch(r.id, { ativo: e.target.checked })} /> Ativa</label>
            <button type="button" className="icon-button danger-icon" title={machines ? 'Remover máquina' : 'Remover equipe'} aria-label={machines ? 'Remover máquina' : 'Remover equipe'} onClick={() => setDraft(old => old.filter(item => item.id !== r.id))}><Trash2 size={17}/></button>
          </div>
          <div className="capacity-resource-fields">
            <label className="capacity-resource-name">{machines ? 'Nome da máquina' : 'Nome da equipe'}<input value={r.nome} placeholder={machines ? 'Ex.: Reta industrial' : 'Ex.: Equipe de costura A'} onChange={e => patch(r.id, { nome: e.target.value })} /></label>
            <label>{machines ? 'Máquinas' : 'Pessoas'}<input type="number" min="0" step="1" value={r.quantidade} onChange={e => patch(r.id, { quantidade: Number(e.target.value) })} /></label>
            <label>Horas por dia<input type="number" min="0" max="24" step="0.5" value={r.horasDia} onChange={e => patch(r.id, { horasDia: Number(e.target.value) })} /></label>
            <label>Dias por semana<input type="number" min="0" max="7" step="1" value={r.diasSemana} onChange={e => patch(r.id, { diasSemana: Number(e.target.value) })} /></label>
            <label>Eficiência (%)<input type="number" min="0" max="100" step="1" value={r.eficiencia} onChange={e => patch(r.id, { eficiencia: Number(e.target.value) })} /></label>
          </div>
        </article>)}
      </div>
      <div className="modal-actions">
        <button className="secondary-button" onClick={() => setDraft(old => [...old, freshResource(kind)])}><Plus size={15}/> {machines ? 'Adicionar máquina' : 'Adicionar equipe'}</button>
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
            <td>{row.capacidadeHoras > 0 && (machines || row.tarefas > 0) ? `${numberHours(percentage(row.previstasHoras, row.capacidadeHoras))}%` : '—'}</td></tr>)}
        </tbody></table></div>}
      {!machines && <p className="helper-text">As operações são vinculadas às equipes no Passaporte Digital, em cada revisão de produto. Quando uma OP é liberada, a atribuição da equipe fica registrada na operação. Operações antigas sem vínculo aparecem em “Sem equipe atribuída”; novas atribuições valem para novas OPs.</p>}
      <p className="helper-text">* A demanda é calculada pelo tempo padrão por peça × quantidade total da OP. O decorrido real é o intervalo de execução registrado pelo operador, não uma medição de horas produtivas por unidade. Operações concluídas saem da demanda restante. Não são atribuídas datas às operações automaticamente.</p>
    </section>
  </div>
}

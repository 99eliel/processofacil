import { useMemo, useState } from 'react'
import { ArrowRightLeft, TriangleAlert, Users } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import { useTenantCollection } from '../hooks/useTenantCollection'
import type { ProductionOrderRecord } from '../domain/types'
import { weeklyHours, type CapacitySettingsRecord } from '../domain/capacityEngine'
import { type ProductionBalance } from '../firebase/productionLedger'
import { findBalance } from '../domain/progressEngine'
import { simulateBalance } from '../domain/balanceEngine'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
export default function BalancePage() {
  const { activeCompany } = useSystem()
  const companyId = activeCompany?.id
  const orders = useTenantCollection<ProductionOrderRecord>(companyId, 'ordensProducao', 'numero')
  const balances = useTenantCollection<ProductionBalance>(companyId, 'saldosOperacoes', 'taskId')
  const settings = useTenantCollection<CapacitySettingsRecord>(companyId, 'configuracoesCapacidade', 'tipo')
  const [opId, setOpId] = useState('')
  const active = useMemo(() => orders.items.filter((o) => !o.excluido && ['liberada','em_fluxo','reprovada'].includes(o.status)), [orders.items])
  const order = active.find((o) => o.id === opId) ?? active[0]
  const teamSettings = settings.items.find((s) => s.id === 'maoObra')?.recursos ?? []
  const teams = teamSettings.filter((team) => team.ativo && weeklyHours(team) > 0)
    .map((team) => ({ id: team.id, nome: team.nome, capacidadeHoras: weeklyHours(team) }))
  const tasks = (order?.operacoes ?? []).map((task) => {
    const qty = order?.itens.find((item) => item.id === task.itemId)?.quantidadeTotal ?? 0
    const finished = Number(findBalance(balances.items, task.id)?.boas ??
      (task.status === 'concluida' ? qty : 0))
    const remaining = Math.max(0, qty - finished)
    const standard = Number(task.operacao.tempoPadraoMin ?? 0)
    return {
      id: task.id,
      nome: task.produtoDescricao + ' · ' + task.operacao.nome,
      horas: standard > 0 ? remaining * standard / 60 : 0,
      equipeId: task.equipeId || task.operacao.equipeId || undefined,
      missingTime: standard <= 0,
    }
  })
  const simulation = simulateBalance(tasks, teams)
  const totalDemand = tasks.reduce((sum, task) => sum + task.horas, 0)
  const missingTimes = tasks.filter((task) => task.missingTime).length
  const pending = simulation.assignments.filter((a) => a.tipo === 'pendente').length
  const assignedHours = simulation.teams.reduce((sum, team) => sum + team.planejadaHoras, 0)
  const error = orders.error || balances.error || settings.error
  if (orders.loading || balances.loading || settings.loading) return <div className="loading-panel">Calculando cenários de balanceamento...</div>
  return <div className="pf-page">
    <section className="pf-page-heading"><div><span className="section-kicker">Simulação de capacidade</span>
      <h2>Balanceamento por equipes</h2>
      <p>Sugere a distribuição da demanda restante e destaca sobrecargas sem alterar equipes ou ordens.</p>
    </div></section>
    {error && <div className="form-error page-message">{error}</div>}
    <section className="panel pf-form-card">
      <label className="pf-field-label">OP de referência
        <select value={order?.id ?? ''} onChange={(e) => setOpId(e.target.value)}>
          {active.map((op) => <option key={op.id} value={op.id}>{op.numero} · {op.itens.map((i) => i.produtoDescricao).join(', ')}</option>)}
        </select>
      </label>
      {!order && <p className="helper-text">Libere uma OP para começar a simulação.</p>}
      {teams.length === 0 && <div className="capacity-note"><Users size={17}/> Cadastre equipes com capacidade no Planejamento → Equipes.</div>}
      {missingTimes > 0 && <div className="capacity-note"><TriangleAlert size={17}/> {missingTimes} operação(ões) sem tempo-padrão. A simulação dessas etapas está incompleta.</div>}
      <div className="pf-op-summary">
        <div><small>Demanda restante estimada</small><strong>{fmt(totalDemand)} h</strong></div>
        <div><small>Equipes com capacidade</small><strong>{teams.length}</strong></div>
        <div><small>Horas alocadas</small><strong>{fmt(assignedHours)} h</strong></div>
        <div><small>Etapas sem equipe válida</small><strong>{pending}</strong></div>
      </div>
      <p className="helper-text"><ArrowRightLeft size={15}/> Atribuições já vinculadas no Passaporte e congeladas na OP são mantidas. Só as operações sem equipe recebem sugestão. A heurística considera carga e capacidade; <strong>não verifica habilidades, disponibilidade real por dia nem compatibilidade de máquinas</strong>. Não salva alocações.</p>
    </section>
    <section className="panel pf-form-card">
      <h3>Distribuição simulada por equipe</h3>
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr>
        <th>Equipe</th><th>Capacidade semanal</th><th>Alocada</th><th>Ocupação</th><th>Excesso</th>
      </tr></thead><tbody>{simulation.teams.map((team) => <tr key={team.id}>
        <td><strong>{team.nome}</strong></td><td>{fmt(team.capacidadeHoras)} h</td>
        <td>{fmt(team.planejadaHoras)} h</td><td>{team.ocupacao}%</td>
        <td>{team.excedenteHoras > 0 ? fmt(team.excedenteHoras) + ' h' : '—'}</td>
      </tr>)}</tbody></table></div>
    </section>
    <section className="panel pf-form-card">
      <h3>Operações e atribuições</h3>
      <div className="pf-table-scroll"><table className="pf-data-table"><thead><tr>
        <th>Operação</th><th>Demanda</th><th>Equipe</th><th>Tipo</th>
      </tr></thead><tbody>{simulation.assignments.map((task) => <tr key={task.taskId}>
        <td><strong>{task.tarefa}</strong></td><td>{fmt(task.horas)} h</td>
        <td>{task.equipeNome}</td><td>{task.tipo === 'fixo' ? 'Já vinculada' : task.tipo === 'sugestao' ? 'Sugestão' : 'Pendente'}</td>
      </tr>)}</tbody></table></div>
    </section>
  </div>
}

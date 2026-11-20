export type BalanceTask = {
  id: string
  nome: string
  horas: number
  equipeId?: string
}
export type BalanceTeam = {
  id: string
  nome: string
  capacidadeHoras: number
}
export type BalanceAssignment = {
  taskId: string
  tarefa: string
  equipeId: string | null
  equipeNome: string
  horas: number
  tipo: 'fixo' | 'sugestao' | 'pendente'
}
export function simulateBalance(tasks: BalanceTask[], teams: BalanceTeam[]) {
  const available = teams.filter((t) => t.capacidadeHoras > 0)
  const loads = new Map(available.map((t) => [t.id, 0]))
  const assignments: BalanceAssignment[] = []
  // Atribuições já definidas na OP nunca são transferidas automaticamente.
  for (const task of tasks.filter((t) => t.equipeId)) {
    const team = available.find((t) => t.id === task.equipeId)
    if (team) {
      loads.set(team.id, (loads.get(team.id) ?? 0) + task.horas)
      assignments.push({
        taskId: task.id, tarefa: task.nome, equipeId: team.id, equipeNome: team.nome,
        horas: task.horas, tipo: 'fixo',
      })
    } else {
      assignments.push({
        taskId: task.id, tarefa: task.nome, equipeId: null,
        equipeNome: 'Equipe atribuída não disponível', horas: task.horas, tipo: 'pendente',
      })
    }
  }
  // Sugestão exploratória: maiores cargas primeiro, minimizando ocupação relativa.
  for (const task of tasks.filter((t) => !t.equipeId).sort((a, b) => b.horas - a.horas)) {
    const choice = available.reduce<BalanceTeam | null>((best, team) => {
      if (!best) return team
      const occupancy = ((loads.get(team.id) ?? 0) + task.horas) / team.capacidadeHoras
      const bestOccupancy = ((loads.get(best.id) ?? 0) + task.horas) / best.capacidadeHoras
      return occupancy < bestOccupancy ? team : best
    }, null)
    if (choice) loads.set(choice.id, (loads.get(choice.id) ?? 0) + task.horas)
    assignments.push({
      taskId: task.id, tarefa: task.nome,
      equipeId: choice?.id ?? null, equipeNome: choice?.nome ?? 'Sem equipe disponível',
      horas: task.horas, tipo: choice ? 'sugestao' : 'pendente',
    })
  }
  return {
    assignments,
    teams: available.map((team) => {
      const planejadaHoras = loads.get(team.id) ?? 0
      return {
        ...team, planejadaHoras, excedenteHoras: Math.max(0, planejadaHoras - team.capacidadeHoras),
        ocupacao: Math.round(planejadaHoras / team.capacidadeHoras * 100),
      }
    }),
  }
}

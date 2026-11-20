import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCapacity, weeklyHours } from './capacityEngine.ts'

function fixture() {
  return {
    id: 'op1', numero: 'OP-1', status: 'em_fluxo', excluido: false,
    itens: [{ id: 'i1', produtoCodigo: 'P1', quantidadeTotal: 100 }],
    operacoes: [{
      id: 'task1', itemId: 'i1', produtoCodigo: 'P1',
      operacao: { nome: 'Montar', maquina: 'Reta', tempoPadraoMin: 3, ordem: 1 },
      status: 'pendente',
    }],
  }
}
const resources = [{ id: 'machine', nome: 'Reta', quantidade: 1, horasDia: 8, diasSemana: 5, eficiencia: 100, ativo: true }]
test('capacidade semanal é horas por equipamento vezes disponibilidade', () => {
  assert.equal(weeklyHours(resources[0]), 40)
})
test('100 unidades a 3 minutos correspondem a 5 horas planejadas', () => {
  const { rows } = calculateCapacity([fixture()], [], resources, 'maquinas')
  assert.equal(rows[0].previstasHoras, 5)
  assert.equal(rows[0].concluidasHoras, 0)
})
test('apontamentos parciais atualizam carga restante e produção equivalente', () => {
  const balances = [{ id: 'task1', taskId: 'task1', boas: 40, defeituosas: 10, total: 50 }]
  const { rows } = calculateCapacity([fixture()], [], resources, 'maquinas', Date.now(), balances)
  assert.equal(rows[0].previstasHoras, 3)
  assert.equal(rows[0].concluidasHoras, 2)
})
test('OP congelada preserva carga mesmo que o cadastro do produto tenha sido excluído', () => {
  const deletedProducts = [{ id: 'P1', codigo: 'P1', excluido: true }]
  const { rows } = calculateCapacity([fixture()], deletedProducts, resources, 'maquinas')
  assert.equal(rows[0].previstasHoras, 5)
})

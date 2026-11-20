import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateBalance } from './balanceEngine.ts'

test('mantém equipe já atribuída e sugere nova para não atribuída', () => {
  const teams = [{ id: 'A', nome: 'A', capacidadeHoras: 10 }, { id: 'B', nome: 'B', capacidadeHoras: 10 }]
  const tasks = [{ id: '1', nome: 'Corte', equipeId: 'A', horas: 8 }, { id: '2', nome: 'Montagem', horas: 6 }]
  const result = simulateBalance(tasks, teams)
  assert.equal(result.assignments.find((x) => x.taskId === '1').equipeId, 'A')
  assert.equal(result.assignments.find((x) => x.taskId === '2').equipeId, 'B')
})

test('equipes ausentes não são forçadas em nova atribuição', () => {
  const result = simulateBalance([{ id: '1', nome: 'X', equipeId: 'inexistente', horas: 3 }], [])
  assert.equal(result.assignments[0].tipo, 'pendente')
})
test('ocupação maior que 100% aponta excedente', () => {
  const result = simulateBalance([{ id: '1', nome: 'X', horas: 15 }],
    [{ id: 'A', nome: 'Equipe A', capacidadeHoras: 10 }])
  assert.equal(result.teams[0].excedenteHoras, 5)
  assert.equal(result.teams[0].ocupacao, 150)
})

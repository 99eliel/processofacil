import test from 'node:test'
import assert from 'node:assert/strict'
import { orderProgress, stepProgress, productionWarnings } from './progressEngine.ts'

function order(qty = 10) {
  const op1 = { id: 't1', itemId: 'i1', operacao: { ordem: 1, nome: 'Montar', tempoPadraoMin: 2 } }
  const op2 = { id: 't2', itemId: 'i1', operacao: { ordem: 2, nome: 'Embalar', tempoPadraoMin: 1 } }
  return {
    id: 'op1', numero: 'OP-TESTE', status: 'liberada',
    itens: [{ id: 'i1', produtoCodigo: 'P1', quantidadeTotal: qty }],
    operacoes: [op1, op2],
  }
}

test('etapas respeitam apenas unidades boas da etapa anterior', () => {
  const o = order()
  const balances = [{ id: 't1', taskId: 't1', boas: 7, defeituosas: 2, total: 9 }]
  const second = stepProgress(o, o.operacoes[1], balances)
  assert.equal(second.available, 7)
  assert.equal(second.toPoint, 7)
  assert.equal(second.toGoal, 10)
})

test('produção parcial da etapa intermediária não é confundida com produto acabado', () => {
  const o = order()
  const balances = [{ id: 't1', taskId: 't1', boas: 7, defeituosas: 1, total: 8 }]
  assert.deepEqual(orderProgress(o, balances).finished, 0)
  balances.push({ id: 't2', taskId: 't2', boas: 4, defeituosas: 0, total: 4 })
  assert.equal(orderProgress(o, balances).finished, 4)
  assert.equal(orderProgress(o, balances).remaining, 6)
  assert.equal(orderProgress(o, balances).percentage, 40)
})

test('OP concluída exige todas as boas na última operação', () => {
  const o = order()
  const balances = [
    { id: 't1', taskId: 't1', boas: 10, defeituosas: 0, total: 10 },
    { id: 't2', taskId: 't2', boas: 10, defeituosas: 0, total: 10 },
  ]
  assert.equal(orderProgress(o, balances).ready, true)
  assert.equal(orderProgress(o, []).ready, false)
})

test('avisa sobre defeitos e operações sem tempo', () => {
  const o = order()
  o.operacoes[0].operacao.tempoPadraoMin = null
  o.prazo = '2026-10-01'
  const balances = [{ id: 't1', taskId: 't1', boas: 9, defeituosas: 1, total: 10 }]
  const alerts = productionWarnings(o, balances, '2026-11-19')
  assert.ok(alerts.some((x) => x.includes('vencida')))
  assert.ok(alerts.some((x) => x.includes('retrabalho')))
  assert.ok(alerts.some((x) => x.includes('tempo-padrão')))
})

test('OP sem operações não fica pronta mesmo com quantidade zero', () => {
  const o = order()
  o.operacoes = []
  assert.equal(orderProgress(o, []).ready, false)
  assert.equal(orderProgress(o, []).missingOperations, 1)
})

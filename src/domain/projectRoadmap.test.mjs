import test from 'node:test'
import assert from 'node:assert/strict'
import { PROJECT_ROADMAP } from './projectRoadmap.ts'

test('Ficha Técnica vem antes de POP e Ficha Técnica e POP estão ativos', () => {
  assert.deepEqual(PROJECT_ROADMAP.slice(0, 2).map((stage) => stage.id), ['ficha-tecnica', 'pop'])
  assert.equal(PROJECT_ROADMAP[0].status, 'atual')
  assert.equal(PROJECT_ROADMAP[1].status, 'atual')
  assert.equal(PROJECT_ROADMAP.filter((stage) => stage.status === 'atual').length, 2)
  assert.equal(PROJECT_ROADMAP.length, 10)
})

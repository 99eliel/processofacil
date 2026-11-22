import test from 'node:test'
import assert from 'node:assert/strict'
import { uniqueActiveMaterials, filterMaterialOptions } from './materialPicker.ts'

const catalog = [
  {id:'a',codigo:'SIM-MAT-004',descricao:'Botão 4 furos Azul Marinho',categoria:'Aviamentos',unidade:'un',ativo:true},
  {id:'b',codigo:'sim-mat-004 ',descricao:'Botão 4 furos Azul Marinho',categoria:'Aviamentos',unidade:'un',ativo:true},
  {id:'c',codigo:'SIM-MAT-005',descricao:'Etiqueta de marca',categoria:'Etiquetas',unidade:'un',ativo:true},
  {id:'d',codigo:'SIM-MAT-006',descricao:'Inativo',categoria:'',unidade:'m',ativo:false},
]
test('não mostra cópias do mesmo código na pesquisa da BOM, sem apagar cadastros',()=>{
  const results=uniqueActiveMaterials(catalog)
  assert.equal(results.length,2)
  assert.deepEqual(results.map(x=>x.id),['a','c'])
  assert.equal(catalog.length,4)
})
test('busca por código, descrição sem acento, unidade e categoria',()=>{
  const results=uniqueActiveMaterials(catalog)
  assert.equal(filterMaterialOptions(results,'mat-004').length,1)
  assert.equal(filterMaterialOptions(results,'botao azul').length,1)
  assert.equal(filterMaterialOptions(results,'etiquetas').length,1)
  assert.equal(filterMaterialOptions(results,'un').length,2)
  assert.equal(filterMaterialOptions(results,'inativo').length,0)
})

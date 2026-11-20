import test from 'node:test'
import assert from 'node:assert/strict'
import {forecastOperationLoads} from './planningEngine.ts'
const machine=(id)=>({id,nome:id,quantidade:1,horasDia:8,diasSemana:5,eficiencia:100,ativo:true})
const sample=(taskId,horas,extra={})=>({
  taskId,opId:'op',opNumero:'OP1',itemId:'item',ordem:1,
  operacao:taskId,produto:'Produto',data:'2026-11-16',turno:'integral',
  equipeId:'T',maquinaId:'M',pendente:10,horas,semTempo:false,programado:true,prioridade:'normal',...extra,
})
test('previsão distribui horas entre dias, sem ultrapassar uma máquina',()=>{
 const results=forecastOperationLoads([sample('a',12),sample('b',5,{itemId:'b'})],
   [machine('M')],[machine('T')],[],[],'2026-11-16')
 assert.equal(results[0].dataPrevista,'2026-11-17')
 assert.equal(results[1].dataPrevista,'2026-11-18')
})
test('máquina em manutenção não recebe horas naquele dia',()=>{
 const absence=[{id:'x',tipo:'maquinas',recursoId:'M',dataInicio:'2026-11-16',dataFim:'2026-11-16',quantidade:1,motivo:'Manutenção'}]
 const results=forecastOperationLoads([sample('a',4)],[machine('M')],[machine('T')],[],absence,'2026-11-16')
 assert.equal(results[0].dataPrevista,'2026-11-17')
})
test('operações sem recursos e tempo não recebem previsão falsa',()=>{
 const result=forecastOperationLoads([sample('a',0,{semTempo:true})],[],[],[],[],'2026-11-16')
 assert.equal(result[0].dataPrevista,null)
})

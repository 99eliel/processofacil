import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOperationLoads,capacityForDate,capacityForWeek,dailyLoads,effectiveHeadcount,
  resourceForTask,startOfWeek } from './planningEngine.ts'

const resource=(id,nome)=>({id,nome,quantidade:2,horasDia:8,diasSemana:5,eficiencia:100,ativo:true})
test('pessoas ativas substituem headcount manual quando equipe tem cadastro nominal',()=>{
 const team=resource('A','Equipe A')
 assert.equal(effectiveHeadcount('maoObra',team,[]),2)
 assert.equal(effectiveHeadcount('maoObra',team,[{id:'1',nome:'A',equipeId:'A',ativo:true},{id:'2',nome:'B',equipeId:'A',ativo:false}]),1)
})
test('férias e manutenção diminuem capacidade em datas específicas',()=>{
 const t=resource('A','Equipe A')
 const workers=[{id:'1',nome:'A',equipeId:'A',ativo:true},{id:'2',nome:'B',equipeId:'A',ativo:true}]
 const absence=[{id:'x',tipo:'colaborador',recursoId:'1',dataInicio:'2026-11-16',dataFim:'2026-11-20',quantidade:1,motivo:'Férias'}]
 assert.equal(capacityForDate(t,'maoObra','2026-11-19',workers,absence),8)
 assert.equal(capacityForDate(t,'maoObra','2026-11-22',workers,absence),0)
 const maint=[{id:'m',tipo:'maquinas',recursoId:'A',dataInicio:'2026-11-19',dataFim:'2026-11-19',quantidade:1,motivo:'Manutenção'}]
 assert.equal(capacityForDate(t,'maquinas','2026-11-19',[],maint),8)
})
test('semana e jornadas evitam soma de capacidade fora dos dias úteis',()=>{
 assert.equal(startOfWeek('2026-11-19'),'2026-11-16')
 assert.equal(capacityForWeek(resource('A','A'),'maquinas','2026-11-16',[],[]),80)
})
test('operação usa identificador estável programado ou nome legado',()=>{
 const task={id:'t1',operacao:{maquina:'Máquina Reta'},equipeId:'A'}
 const resources=[resource('M','Maquina Reta')]
 assert.equal(resourceForTask('maquinas',task,resources),'M')
 assert.equal(resourceForTask('maquinas',task,resources,{maquinaId:'M'}),'M')
 assert.equal(resourceForTask('maoObra',task,[resource('A','A')],{equipeId:'B'}),'B')
})
test('plano por operação substitui equipe e máquina de Ficha Técnica congelada',()=>{
 const t={id:'t',itemId:'i',produtoDescricao:'Camisa',operacao:{nome:'Montar',tempoPadraoMin:3,maquina:'Reta',equipeId:'A'}}
 const op={id:'op',numero:'OP1',status:'liberada',itens:[{id:'i',quantidadeTotal:100}],operacoes:[t]}
 const plan={id:'t',opId:'op',taskId:'t',data:'2026-11-19',turno:'integral',equipeId:'B',maquinaId:'M',prioridade:'alta'}
 const loads=buildOperationLoads([op],[{id:'t',taskId:'t',boas:40,defeituosas:0,total:40}],[plan],[resource('M','Reta')],[resource('A','A'),resource('B','B')])
 assert.equal(loads[0].horas,3)
 assert.equal(loads[0].equipeId,'B')
 assert.equal(loads[0].maquinaId,'M')
 const grid=dailyLoads('maoObra',loads,[resource('B','B')],[],[],'2026-11-19','2026-11-19')
 assert.equal(grid[0].demanda,3)
})

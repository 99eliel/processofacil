
import test from 'node:test'
import assert from 'node:assert/strict'
import {youtubeId,latestPops,popReference,emptyPop,validatePop,popFromOperation} from './popModel.ts'
test('aceita links YouTube e rejeita hosts falsos',()=>{
 const id='dQw4w9WgXcQ'
 for(const u of ['https://youtu.be/'+id,'https://www.youtube.com/watch?v='+id,'https://youtube.com/shorts/'+id]) assert.equal(youtubeId(u),id)
 assert.equal(youtubeId('https://youtube.com.evil.test/watch?v='+id),null)
 assert.equal(youtubeId('javascript:alert(1)'),null)
})
test('versões independentes e referência fixa',()=>{
 const a=emptyPop('Teste'), b={...a,id:a.groupId+'-2',version:2}
 assert.equal(latestPops([a,b])[0].id,b.id)
 assert.equal(popReference(a).version,1)
 assert.throws(()=>validatePop(a,true))
})

test('cria POP a partir de produto e operação da ficha em rascunho',()=>{
 const op={id:'op1',codigo:'20',ordem:2,nome:'Aplicar gola',descricao:'Alinhar gola',maquina:'Galoneira',ferramenta:'Aparelho',tempoPadraoMin:0.65,dificuldade:'medio',regulagem:'3 mm',pontosCriticos:['Conferir costura'],instrucoes:['Posicionar gola']}
 const sheet={produtoCodigo:'UNI-2458',produtoDescricao:'Camisa polo',numero:3,status:'rascunho',operacoes:[op]}
 const p=popFromOperation('Teste',sheet,op)
 assert.equal(p.origin.productCode,'UNI-2458')
 assert.equal(p.origin.operationId,'op1')
 assert.equal(p.origin.sheetRevision,3)
 assert.equal(p.code,'UNI-2458-20')
 assert.equal(p.name,'Aplicar gola')
 assert.equal(p.machine,'Galoneira')
 assert.equal(p.steps[0].text,'Posicionar gola')
 assert.throws(()=>popFromOperation('Teste',{...sheet,status:'padrao'},op))
})

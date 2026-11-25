
import test from 'node:test'
import assert from 'node:assert/strict'
import {youtubeId,latestPops,popReference,emptyPop,validatePop} from './popModel.ts'
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

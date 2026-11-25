import test from 'node:test'
import assert from 'node:assert/strict'
import { demoPops, isDemoPop } from './demoPops.ts'
import { validatePop } from './popModel.ts'
test('exemplos completos, independentes, com IDs estáveis e vídeos vazios',()=>{
 const a=demoPops(), b=demoPops()
 assert.equal(a.length,6)
 assert.equal(new Set(a.map(p=>p.id)).size,6)
 assert.deepEqual(a.map(p=>p.id),b.map(p=>p.id))
 for(const p of a){assert.equal(p.status,'draft');assert.equal(p.origin,undefined);assert.ok(isDemoPop(p));assert.ok(p.steps.length>=4);assert.ok(p.videos.every(v=>v.url===''));assert.doesNotThrow(()=>validatePop(p,true))}
})

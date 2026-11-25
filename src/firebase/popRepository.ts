
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './config'
import { validatePop, popReference, type PopRecord } from '../domain/popModel'
import type { TechnicalOperation } from '../domain/types'

const popDoc = (company:string,id:string) => doc(db,'empresas',company,'pops',id)
export async function savePop(company:string, p:PopRecord, publish:boolean, actor:string, uid:string):Promise<PopRecord> {
  validatePop(p,publish)
  const next:PopRecord={...p,code:p.code.trim(),name:p.name.trim(),status:publish?'published':'draft',updatedAt:new Date().toISOString(),publishedAt:publish?new Date().toISOString():'',approver:publish?actor:p.approver}
  await runTransaction(db,async tx=>{
    const target=popDoc(company,p.id), snap=await tx.get(target)
    if(snap.exists()) {
      const old=snap.data() as PopRecord
      if(old.status!=='draft') throw new Error('POP publicado é imutável. Crie uma nova revisão.')
      if(old.updatedAt!==p.updatedAt) throw new Error('O POP foi alterado em outra sessão. Reabra o documento.')
    }
    // A primeira publicação grava o POP e o vínculo na mesma transação.
    // Novas versões permanecem independentes até uma vinculação explícita.
    if(publish && next.version===1 && next.origin) {
      const origin=next.origin
      const sheetRef=doc(db,'empresas',company,'produtos',origin.productCode,'revisoes',String(origin.sheetRevision).padStart(3,'0'))
      const summaryRef=doc(db,'empresas',company,'fichas',origin.productCode)
      const [sheet,summary]=await Promise.all([tx.get(sheetRef),tx.get(summaryRef)])
      if(!sheet.exists()||sheet.data().status!=='rascunho'||!summary.exists()||summary.data().revisaoRascunho!==origin.sheetRevision) throw new Error('A ficha de origem não está mais em rascunho. A publicação não foi concluída; escolha novamente o produto e a operação.')
      const ops=(sheet.data().operacoes??[]) as TechnicalOperation[]
      const op=ops.find(o=>o.id===origin.operationId)
      if(!op) throw new Error('A operação de origem foi removida. Selecione novamente a operação antes de publicar.')
      if((op.pop?.id??null)!==origin.previousPopId) throw new Error('O vínculo da operação mudou. Selecione novamente a operação antes de publicar.')
      tx.update(sheetRef,{operacoes:ops.map(o=>o.id===origin.operationId?{...o,pop:popReference(next)}:o),alteradoEm:serverTimestamp(),alteradoPor:uid})
      tx.update(summaryRef,{alteradoEm:serverTimestamp(),alteradoPor:uid})
    }
    tx.set(target,next)
  })
  return next
}
export async function createPopRevision(company:string,p:PopRecord,actor:string):Promise<PopRecord> {
  const version=p.version+1, now=new Date().toISOString()
  const next:PopRecord={...p,id:p.groupId+'-'+version,version,status:'draft',author:actor,reviewer:'',approver:'',reason:'',createdAt:now,updatedAt:now,publishedAt:''}
  await runTransaction(db,async tx=>{
    const source=await tx.get(popDoc(company,p.id)), target=popDoc(company,next.id), exists=await tx.get(target)
    if(!source.exists() || source.data().status!=='published') throw new Error('Publique a revisão anterior primeiro.')
    if(exists.exists()) throw new Error('Esta revisão já existe. Abra-a na biblioteca.')
    tx.set(target,next)
  })
  return next
}
export async function uploadPopPhoto(company:string,groupId:string,file:File) {
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>8*1024*1024) throw new Error('Use JPG, PNG, WEBP ou GIF de até 8 MB.')
  const target=ref(storage,'empresas/'+company+'/pops/'+groupId+'/'+crypto.randomUUID())
  await uploadBytes(target,file,{contentType:file.type})
  return getDownloadURL(target)
}
export async function linkPopToDraft(company:string,uid:string,p:PopRecord,product:string,revision:number,operationId:string) {
  const target=doc(db,'empresas',company,'produtos',product,'revisoes',String(revision).padStart(3,'0'))
  const summary=doc(db,'empresas',company,'fichas',product)
  await runTransaction(db,async tx=>{
    const [snap,ps]=await Promise.all([tx.get(target),tx.get(popDoc(company,p.id))])
    if(!snap.exists()||snap.data().status!=='rascunho') throw new Error('Somente uma Ficha Técnica em rascunho pode receber o POP.')
    if(!ps.exists()||ps.data().status!=='published') throw new Error('Publique o POP antes de vincular.')
    const ops=(snap.data().operacoes??[]) as TechnicalOperation[]
    if(!ops.some(o=>o.id===operationId)) throw new Error('Operação não encontrada.')
    tx.update(target,{operacoes:ops.map(o=>o.id===operationId?{...o,pop:popReference(ps.data() as PopRecord)}:o),alteradoEm:serverTimestamp(),alteradoPor:uid})
    tx.update(summary,{alteradoEm:serverTimestamp(),alteradoPor:uid})
  })
}

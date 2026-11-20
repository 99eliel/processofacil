import { collection,doc,runTransaction,serverTimestamp,Timestamp } from 'firebase/firestore'
import {db} from './config'
import type { ProductionOrderRecord } from '../domain/types'
import type { OperationSchedule,TimedOperation } from '../domain/planningEngine'

export type OperationTimer = {
  id:string
  opId:string
  taskId:string
  operadorNome:string
  fase:'rodando'|'pausado'|'encerrado'
  inicioEm?:unknown
  retomadoEm?:unknown
  tempoAcumuladoMs:number
  atualizadoEm?:unknown
}
function sessionId(taskId:string,name:string){
  return taskId+'__'+encodeURIComponent(name.trim().normalize('NFKC').toLocaleLowerCase('pt-BR')).slice(0,200)
}
function ms(time:unknown):number{
  if(time instanceof Timestamp)return time.toMillis()
  if(time && typeof time==='object' && 'toMillis' in time && typeof time.toMillis==='function')
    return time.toMillis()
  return 0
}
export function operationTimerMilliseconds(timer:OperationTimer,now=Date.now()){
  const accrued=Math.max(0,Number(timer.tempoAcumuladoMs)||0)
  return timer.fase==='rodando'?accrued+Math.max(0,now-ms(timer.retomadoEm)):accrued
}
export async function controlOperationTimer(
  empresaId:string,uid:string,params:{
    opId:string;taskId:string;operadorNome:string;action:'iniciar'|'pausar'|'retomar'|'encerrar'
  }
){
  if(!params.operadorNome.trim())throw new Error('Selecione o responsável pela cronometragem.')
  const opRef=doc(db,'empresas',empresaId,'ordensProducao',params.opId)
  const id=sessionId(params.taskId,params.operadorNome)
  const timerRef=doc(db,'empresas',empresaId,'sessoesOperacoes',id)
  const logRef=doc(collection(db,'empresas',empresaId,'temposOperacoes'))
  const auditRef=doc(collection(db,'empresas',empresaId,'auditoria'))
  const scheduleRef=doc(db,'empresas',empresaId,'programacaoOperacoes',params.taskId)
  await runTransaction(db,async tx=>{
    const [opSnap,timerSnap,planSnap]=await Promise.all([tx.get(opRef),tx.get(timerRef),tx.get(scheduleRef)])
    if(!opSnap.exists())throw new Error('OP não encontrada.')
    const order={id:opSnap.id,...opSnap.data()} as ProductionOrderRecord
    if(order.excluido||!['liberada','em_fluxo','reprovada'].includes(order.status))
      throw new Error('OP não está liberada para registro de tempo.')
    const task=(order.operacoes??[]).find(t=>t.id===params.taskId)
    if(!task||task.status==='bloqueada'||task.status==='concluida')
      throw new Error('Operação indisponível ou concluída pelo fluxo antigo.')
    const old=timerSnap.exists()?timerSnap.data() as OperationTimer:null
    const now=Timestamp.now()
    const current=old?operationTimerMilliseconds(old,now.toMillis()):0
    const plan=planSnap.exists()&&!planSnap.data().excluido?planSnap.data() as OperationSchedule:null
    if(params.action==='iniciar'){
      if(old&&old.fase!=='encerrado')throw new Error('Já existe sessão aberta para este responsável e operação.')
      tx.set(timerRef,{
        opId:order.id,taskId:task.id,operadorNome:params.operadorNome.trim(),fase:'rodando',
        inicioEm:now,retomadoEm:now,tempoAcumuladoMs:0,atualizadoEm:serverTimestamp(),
      })
    }else{
      if(!old)throw new Error('Inicie a medição antes de pausar ou encerrar.')
      if(params.action==='pausar'){
        if(old.fase!=='rodando')throw new Error('A medição não está em execução.')
        tx.update(timerRef,{fase:'pausado',retomadoEm:null,tempoAcumuladoMs:current,atualizadoEm:serverTimestamp()})
      }else if(params.action==='retomar'){
        if(old.fase!=='pausado')throw new Error('A medição não está pausada.')
        tx.update(timerRef,{fase:'rodando',retomadoEm:now,atualizadoEm:serverTimestamp()})
      }else if(params.action==='encerrar'){
        if(!['rodando','pausado'].includes(old.fase))throw new Error('Esta sessão já foi encerrada.')
        if(current<1000)throw new Error('A sessão deve ter pelo menos um segundo de trabalho.')
        tx.update(timerRef,{fase:'encerrado',retomadoEm:null,tempoAcumuladoMs:current,atualizadoEm:serverTimestamp()})
        const log:Omit<TimedOperation,'id'> & {operadorNome:string;opNumero:string;criadoPor:string}={
          opId:order.id,taskId:task.id,operadorNome:params.operadorNome.trim(),
          opNumero:order.numero,maquinaId:plan?.maquinaId||task.operacao.maquinaId||'',
          equipeId:plan?.equipeId||task.equipeId||task.operacao.equipeId||'',
          duracaoMs:current,registradoEm:serverTimestamp(),criadoPor:uid,
        }
        tx.set(logRef,log)
      }
    }
    tx.set(auditRef,{
      entidade:'tempo_operacao',entidadeId:id,acao:params.action,
      resumo:order.numero+' · '+task.operacao.nome+' · '+params.operadorNome.trim(),
      uid,em:serverTimestamp(),
    })
  })
}

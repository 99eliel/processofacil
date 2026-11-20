import { useEffect,useMemo,useState } from 'react'
import { Clock3,Play,Pause,Square } from 'lucide-react'
import { useTenantCollection } from '../hooks/useTenantCollection'
import {useSystem} from '../system/SystemProvider'
import {controlOperationTimer,operationTimerMilliseconds,type OperationTimer} from '../firebase/timeLedger'
import type {TimedOperation} from '../domain/planningEngine'
const format=(ms:number)=>{
  const sec=Math.floor(Math.max(0,ms)/1000)
  return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,'0')).join(':')
}
export default function ProductionTimerPanel({opId,taskId,operator,notify}:{
  opId:string;taskId:string;operator:string;notify:(msg:string)=>void
}){
  const {activeCompany,user}=useSystem(),companyId=activeCompany?.id
  const timers=useTenantCollection<OperationTimer>(companyId,'sessoesOperacoes','opId')
  const logs=useTenantCollection<TimedOperation>(companyId,'temposOperacoes','opId')
  const [now,setNow]=useState(Date.now())
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{
    const interval=window.setInterval(()=>setNow(Date.now()),1000)
    return ()=>window.clearInterval(interval)
  },[])
  const session=timers.items.find(t=>t.opId===opId&&t.taskId===taskId&&
    t.operadorNome?.normalize('NFKC').toLocaleLowerCase('pt-BR')===
    operator.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'))
  const history=useMemo(()=>logs.items.filter(t=>t.opId===opId&&t.taskId===taskId),[logs.items,opId,taskId])
  const total=history.reduce((sum,t)=>sum+Math.max(0,Number(t.duracaoMs)||0),0)
  const action=async(next:'iniciar'|'pausar'|'retomar'|'encerrar')=>{
    if(!companyId||!user||busy)return
    if(!operator.trim()){setError('Preencha o responsável pelo apontamento antes de cronometrar.');return}
    setBusy(true);setError('')
    try{
      await controlOperationTimer(companyId,user.uid,{opId,taskId,operadorNome:operator,action:next})
      notify('Tempo '+(next==='iniciar'?'iniciado':next==='pausar'?'pausado':next==='retomar'?'retomado':'registrado')+' com sucesso.')
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar o tempo.')}
    finally{setBusy(false)}
  }
  return <details className="pf-timing-panel">
    <summary><Clock3 size={16}/> Registro de tempo real (opcional)</summary>
    <p className="helper-text">Cronometre o tempo de trabalho efetivo de cada responsável: inicie, pause durante paradas e encerre para registrar as horas. Os apontamentos de quantidade funcionam independentemente.</p>
    {error&&<div className="form-error" role="alert">{error}</div>}
    {(timers.error||logs.error)&&<div className="form-error">{timers.error||logs.error}</div>}
    <div className="pf-timer-inline">
      <div><small>Responsável selecionado</small><strong>{operator.trim()||'Informe um nome acima'}</strong></div>
      <div><small>Sessão atual</small><strong>{session?format(operationTimerMilliseconds(session,now)):'00:00:00'}</strong></div>
      <div><small>Horas concluídas na operação</small><strong>{format(total)}</strong></div>
    </div>
    <div className="pf-actions">
      {(!session||session.fase==='encerrado')&&<button className="secondary-button" disabled={busy||!operator.trim()} onClick={()=>void action('iniciar')}><Play size={15}/> Iniciar</button>}
      {session?.fase==='rodando'&&<button className="secondary-button" disabled={busy} onClick={()=>void action('pausar')}><Pause size={15}/> Pausar</button>}
      {session?.fase==='pausado'&&<button className="secondary-button" disabled={busy} onClick={()=>void action('retomar')}><Play size={15}/> Retomar</button>}
      {session&&session.fase!=='encerrado'&&<button className="primary-button" disabled={busy} onClick={()=>void action('encerrar')}><Square size={15}/> Encerrar e salvar</button>}
    </div>
    {session?.fase==='rodando'&&<p className="pf-timer-state">Cronômetro em execução. Use Pausar para não contar intervalos de parada.</p>}
    {session?.fase==='pausado'&&<p className="pf-timer-state">Sessão pausada. O período parado não é contabilizado.</p>}
    <p className="helper-text">O horário é calculado pelo relógio do dispositivo, com registros auditados no Firestore. Os relatórios de tempo utilizam somente sessões encerradas. Não confunda horas de trabalho de vários operadores com tempo exclusivo de máquina.</p>
  </details>
}

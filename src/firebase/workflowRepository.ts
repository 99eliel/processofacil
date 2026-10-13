import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './config'
import type { WorkflowDefinition } from '../domain/workflowEngine'

export const emptyWorkflow: WorkflowDefinition = {
  etapas: [],
  permitePularComJustificativa: true,
  permiteAprovacaoParalela: false,
}

export function subscribeWorkflow(
  empresaId: string,
  onData: (workflow: WorkflowDefinition) => void,
  onError: (error: Error) => void,
) {
  const ref = doc(db, 'empresas', empresaId, 'configuracoes', 'workflow')
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      onData(emptyWorkflow)
      return
    }
    const data = snapshot.data()
    onData({
      etapas: Array.isArray(data.etapas) ? data.etapas : [],
      permitePularComJustificativa: Boolean(data.permitePularComJustificativa),
      permiteAprovacaoParalela: Boolean(data.permiteAprovacaoParalela),
    })
  }, onError)
}

export async function saveWorkflow(
  empresaId: string,
  uid: string,
  workflow: WorkflowDefinition,
) {
  const ref = doc(db, 'empresas', empresaId, 'configuracoes', 'workflow')
  const auditRef = doc(collection(db, 'empresas', empresaId, 'auditoria'))
  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.set(ref, {
    ...workflow,
    etapas: workflow.etapas.map((stage, index) => ({ ...stage, ordem: index + 1 })),
    alteradoEm: now,
    alteradoPor: uid,
  }, { merge: true })

  batch.set(auditRef, {
    entidade: 'workflow',
    entidadeId: 'principal',
    acao: 'alterado',
    resumo: `Workflow atualizado com ${workflow.etapas.length} etapa(s)`,
    uid,
    em: now,
  })

  await batch.commit()
}

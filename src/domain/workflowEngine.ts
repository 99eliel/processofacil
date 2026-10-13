export type WorkflowStageDefinition = {
  id: string
  nome: string
  ordem: number
  perfis: string[]
  obrigatoria: boolean
}

export type WorkflowDefinition = {
  etapas: WorkflowStageDefinition[]
  permitePularComJustificativa: boolean
  permiteAprovacaoParalela: boolean
}

export function orderedStages(definition: WorkflowDefinition) {
  return [...definition.etapas].sort((a, b) => a.ordem - b.ordem)
}

export function canActOnStage(stage: WorkflowStageDefinition, userProfiles: string[]) {
  return stage.perfis.some((perfil) => userProfiles.includes(perfil))
}

export function nextStage(definition: WorkflowDefinition, currentStageId: string) {
  const list = orderedStages(definition)
  const index = list.findIndex((stage) => stage.id === currentStageId)
  return index >= 0 && index < list.length - 1 ? list[index + 1] : null
}

export function validateSkip(definition: WorkflowDefinition, justification?: string) {
  if (!definition.permitePularComJustificativa) return false
  return Boolean(justification?.trim())
}

export type RevisionSnapshot<T> = {
  numero: number
  status: string
  dados: T
  publicadaEm?: string
  publicadaPor?: string
}

export function nextRevisionNumber(revisions: Array<{ numero: number }>) {
  return revisions.reduce((max, item) => Math.max(max, item.numero), 0) + 1
}

export function openRevisionForEdit<T extends Record<string, unknown>>(
  current: RevisionSnapshot<T>,
  allRevisions: RevisionSnapshot<T>[],
): RevisionSnapshot<T> {
  const locked = ['padrao', 'publicada', 'obsoleta'].includes(current.status.toLowerCase())
  if (!locked) return current

  return {
    numero: nextRevisionNumber(allRevisions),
    status: 'rascunho',
    dados: structuredClone(current.dados),
  }
}

export function publishRevision<T>(draft: RevisionSnapshot<T>, uid: string) {
  return {
    ...draft,
    status: 'publicada',
    publicadaEm: new Date().toISOString(),
    publicadaPor: uid,
  }
}

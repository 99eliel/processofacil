
export type PopStep = { id: string; title: string; text: string; image: string }
export type PopVideo = { id: string; title: string; url: string }
export type PopRecord = {
  id: string; groupId: string; version: number; status: 'draft' | 'published';
  code: string; name: string; objective: string; materials: string; machine: string;
  tools: string; needles: string; time: string; skill: string; settings: string;
  stitch: string; stitchImage: string; quality: string; defects: string; critical: string;
  guidance: string; safety: string; steps: PopStep[]; videos: PopVideo[];
  author: string; reviewer: string; approver: string; reason: string;
  createdAt: string; updatedAt: string; publishedAt: string;
}
export type PopReference = { id: string; groupId: string; version: number; code: string; name: string }
export function youtubeId(value: string): string | null {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const h = u.hostname.toLowerCase()
    const parts = u.pathname.split('/').filter(Boolean)
    const id = h === 'youtu.be' ? parts[0] : ['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)
      ? (parts[0] === 'watch' ? u.searchParams.get('v') : ['shorts','embed','live'].includes(parts[0]) ? parts[1] : null) : null
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch { return null }
}
export function popReference(p: PopRecord): PopReference {
  return {id:p.id,groupId:p.groupId,version:p.version,code:p.code,name:p.name}
}
export function latestPops(items: PopRecord[]) {
  const result = new Map<string,PopRecord>()
  for (const p of items) if (!result.has(p.groupId) || result.get(p.groupId)!.version < p.version) result.set(p.groupId,p)
  return [...result.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
}
export function emptyPop(author: string): PopRecord {
  const groupId = crypto.randomUUID(), now = new Date().toISOString()
  return {id:groupId+'-1',groupId,version:1,status:'draft',code:'',name:'',objective:'',materials:'',machine:'',tools:'',needles:'',time:'',skill:'',settings:'',stitch:'',stitchImage:'',quality:'',defects:'',critical:'',guidance:'',safety:'',steps:[],videos:[],author,reviewer:'',approver:'',reason:'Criação do POP',createdAt:now,updatedAt:now,publishedAt:''}
}
export function validatePop(p: PopRecord, publish = false) {
  if (!p.name.trim() || !p.code.trim()) throw new Error('Informe o código e o nome do POP.')
  if (p.videos.some(v=>v.url.trim() && !youtubeId(v.url))) throw new Error('Informe links válidos do YouTube.')
  if (publish && (!p.objective.trim() || !p.steps.some(s=>s.text.trim() || s.title.trim()))) throw new Error('Para publicar, informe o objetivo e pelo menos uma etapa.')
}


import { useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { youtubeId, type PopRecord } from '../domain/popModel'
export function popUrl(id:string) {return window.location.origin+window.location.pathname+'#/pop/'+encodeURIComponent(id)}
function Section({title,children}:{title:string;children:React.ReactNode}) {return <section className="pop-doc-section"><h3>{title}</h3><div>{children}</div></section>}
function Text({value}:{value:string}) {return <p className="pop-doc-text">{value||'Não informado'}</p>}
export default function PopDocument({record,history,onClose}:{record:PopRecord;history:PopRecord[];onClose:()=>void}) {
  const [paper,setPaper]=useState('a4')
  const [compact,setCompact]=useState(false)
  const [video,setVideo]=useState(0)
  const valid=record.videos.filter(v=>youtubeId(v.url))
  const selected=valid[video]??valid[0]
  const id=selected?youtubeId(selected.url):null
  const date=(v:string)=>v?new Date(v).toLocaleDateString('pt-BR'):'—'
  return createPortal(<div className={'pop-document-overlay '+(compact?'pop-compact':'')}>
    <div className="pop-document-toolbar"><strong>Visualização e impressão do POP</strong><div><label>Formato <select value={paper} onChange={e=>setPaper(e.target.value)}><option value="a4">A4</option><option value="a3">A3</option></select></label><label><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/> Resumido</label><button onClick={()=>window.print()}>Imprimir / PDF</button><button onClick={onClose}>Fechar</button></div></div>
    <style>{'@page { size: '+(paper==='a3'?'A3 landscape':'A4 portrait')+'; margin: 10mm; }'}</style>
    <article className={'pop-document-paper '+(paper==='a3'?'pop-paper-wide':'')}>
      <header><div><b>PROCESSO FÁCIL</b><h1>POP — Procedimento Operacional Padrão</h1><small>PADRONIZAÇÃO · QUALIDADE · PRODUTIVIDADE</small></div><div><strong>{record.code}</strong><span>REV {record.version} · {record.status==='published'?'PUBLICADO':'RASCUNHO'}</span><span>{date(record.publishedAt||record.updatedAt)}</span></div></header>
      <div className="pop-doc-title"><h2>{record.name}</h2><p>Máquina: {record.machine||'—'} · Tempo padrão: {record.time||'—'} · Habilidade: {record.skill||'—'}</p></div>
      <div className="pop-doc-columns">
        <div><Section title="Objetivo"><Text value={record.objective}/></Section><Section title="Materiais e aviamentos"><Text value={record.materials}/></Section><Section title="Máquina e acessórios"><Text value={[record.machine,record.tools].filter(Boolean).join('\n')}/></Section><Section title="Agulhas, linhas e fios"><Text value={record.needles}/></Section><Section title="Critérios de qualidade"><Text value={record.quality}/></Section><Section title="Defeitos não aceitos"><Text value={record.defects}/></Section><Section title="Segurança"><Text value={record.safety}/></Section></div>
        <div><Section title="Passo a passo">{record.steps.length?record.steps.map((s,i)=><div className="pop-doc-step" key={s.id}>{s.image&&<img src={s.image} alt={s.title||'Etapa '+(i+1)}/>}<div><b>{i+1}. {s.title||'Etapa'}</b><Text value={s.text}/></div></div>):<Text value=""/>}</Section></div>
        <div><Section title="Vídeo do processo">{id?<><div className="pop-doc-video"><iframe title={selected?.title||'Vídeo demonstrativo'} src={'https://www.youtube-nocookie.com/embed/'+id} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div><div className="pop-doc-video-links">{valid.map((v,i)=><div key={v.id}><button className="pop-doc-video-select" onClick={()=>setVideo(i)}>{v.title||'Vídeo '+(i+1)}</button><a href={'https://www.youtube.com/watch?v='+youtubeId(v.url)} target="_blank" rel="noreferrer">Abrir no YouTube</a></div>)}</div></>:<Text value="Nenhum vídeo cadastrado"/>}<div className="pop-doc-qr">{record.status==='published'?<><QRCodeSVG value={popUrl(record.id)} size={112} level="M" marginSize={2}/><span>Escaneie para consultar esta revisão e assistir aos vídeos.</span></>:<span>Publique para gerar o QR Code de consulta.</span>}</div></Section><Section title="Regulagem da máquina"><Text value={record.settings}/></Section><Section title="Tipo de ponto"><Text value={record.stitch}/>{record.stitchImage&&<img className="pop-doc-stitch" src={record.stitchImage} alt="Tipo de ponto"/>}</Section><Section title="Pontos críticos e orientações"><Text value={[record.critical,record.guidance].filter(Boolean).join('\n')}/></Section></div>
      </div>
      <div className="pop-doc-bottom"><Section title="Aprovações"><div className="pop-doc-approvals"><div>Elaborado por<b>{record.author||'—'}</b></div><div>Revisado por<b>{record.reviewer||'—'}</b></div><div>Aprovado por<b>{record.approver||'—'}</b></div></div></Section><Section title="Histórico de alterações">{(compact?[record]:history).map(p=><p key={p.id}>REV {p.version} · {date(p.publishedAt||p.updatedAt)} · {p.reason||'—'} · {p.author}</p>)}</Section></div>
      <footer>Documento de orientação do trabalho · Verifique sempre a revisão vigente com o responsável.</footer>
    </article>
  </div>,document.body)
}

import type { PopRecord } from './popModel'

const examples = [
  {
    "key": "ombro",
    "name": "Fechar ombros de camiseta",
    "objective": "Unir as partes dianteira e traseira da camiseta pelos ombros, mantendo o alinhamento e a elasticidade da costura.",
    "materials": "Frente e costas cortadas em malha; linha de poliéster; fita de reforço se prevista na ficha técnica.",
    "machine": "Overlock industrial de 4 fios (exemplo)",
    "tools": "Tesoura de arremate, guia de margem e amostra aprovada.",
    "needles": "Agulha ponta bola compatível com a malha e a máquina; linhas de poliéster conforme ficha técnica.",
    "time": "0,65 min/peça — simulação",
    "skill": "Fácil",
    "settings": "Margem, comprimento do ponto, tensão e diferencial conforme ficha técnica e teste em retalho. Não usar valores genéricos como regulagem real.",
    "stitch": "Costura overlock elástica de união.",
    "quality": "Ombros simétricos, bordas alinhadas, pontos regulares, sem enrugamento ou falhas.",
    "defects": "Costura aberta, ponto pulado, tecido cortado indevidamente, ombros com comprimentos diferentes.",
    "critical": "Conferir sentido e tamanho das peças antes de unir; não esticar excessivamente a malha.",
    "guidance": "Separar peças divergentes e pedir conferência da supervisão.",
    "steps": [
      [
        "Separar componentes",
        "Conferir frente, costas, referência e tamanho."
      ],
      [
        "Posicionar",
        "Colocar direito com direito e alinhar as bordas dos ombros."
      ],
      [
        "Conferir amostra",
        "Validar o ponto em retalho com o responsável."
      ],
      [
        "Unir os ombros",
        "Executar a costura seguindo a margem aprovada, sem puxar a malha."
      ],
      [
        "Inspecionar",
        "Conferir simetria, continuidade dos pontos e acabamento."
      ]
    ]
  },
  {
    "key": "gola",
    "name": "Aplicar gola de ribana",
    "objective": "Fixar a ribana no decote da camiseta com distribuição uniforme e acabamento limpo.",
    "materials": "Corpo da camiseta com ombros fechados; ribana cortada; linha compatível.",
    "machine": "Overlock industrial de 4 fios (exemplo)",
    "tools": "Marcador removível, guia de costura, tesoura de arremate.",
    "needles": "Agulha ponta bola e linha adequada à malha, validadas na amostra.",
    "time": "0,95 min/peça — simulação",
    "skill": "Médio",
    "settings": "Comprimento da ribana, margem, tensão e diferencial definidos pela modelagem e amostra aprovada.",
    "stitch": "Overlock elástica de união.",
    "quality": "Gola centralizada, sem torção, com distribuição uniforme e decote sem ondulações excessivas.",
    "defects": "Gola torcida, folga irregular, franzido, pontos rompidos ou costura aberta.",
    "critical": "Respeitar as marcações da ribana e do decote; não forçar o corpo da camiseta.",
    "guidance": "Não assumir uma proporção universal de ribana. Usar a medida da ficha do produto.",
    "steps": [
      [
        "Conferir ribana",
        "Verificar tamanho, cor e medida conforme ficha."
      ],
      [
        "Preparar gola",
        "Unir as extremidades e dobrar a ribana conforme a amostra."
      ],
      [
        "Marcar referências",
        "Identificar pontos de distribuição no decote e na gola."
      ],
      [
        "Posicionar e unir",
        "Distribuir a ribana nas marcações e costurar conforme amostra aprovada."
      ],
      [
        "Revisar decote",
        "Conferir simetria, elasticidade, junção e acabamento."
      ]
    ]
  },
  {
    "key": "mangas",
    "name": "Aplicar mangas de camiseta",
    "objective": "Unir as mangas às cavas mantendo o encaixe, a simetria e a mobilidade da peça.",
    "materials": "Corpo da camiseta; par de mangas cortadas; linha de poliéster compatível.",
    "machine": "Overlock industrial de 4 fios (exemplo)",
    "tools": "Guia de margem, marcações da modelagem, tesoura de arremate.",
    "needles": "Agulha adequada à malha e ao equipamento; linha conforme ficha.",
    "time": "1,20 min/par — simulação",
    "skill": "Médio",
    "settings": "Margem e diferencial de acordo com a ficha técnica e a prova em retalho.",
    "stitch": "Overlock de união.",
    "quality": "Mangas simétricas, encaixe correto das marcações, costura contínua e sem pregas indesejadas.",
    "defects": "Manga invertida, cava franzida, ponta fora da costura ou tecido danificado.",
    "critical": "Identificar frente e costas da manga; conferir marcações antes da costura.",
    "guidance": "Este exemplo pressupõe montagem com cava aberta; seguir a sequência da ficha de cada modelo.",
    "steps": [
      [
        "Separar mangas",
        "Conferir tamanho, lado e marcações."
      ],
      [
        "Posicionar na cava",
        "Alinhar direito com direito e encaixar as referências."
      ],
      [
        "Unir",
        "Costurar a curva seguindo a margem aprovada."
      ],
      [
        "Repetir",
        "Aplicar a segunda manga seguindo o mesmo padrão."
      ],
      [
        "Conferir",
        "Comparar as mangas e verificar a união em toda a cava."
      ]
    ]
  },
  {
    "key": "laterais",
    "name": "Fechar laterais e mangas",
    "objective": "Fechar as laterais do corpo e a parte inferior das mangas da camiseta.",
    "materials": "Corpo com mangas aplicadas; linha compatível.",
    "machine": "Overlock industrial de 4 fios (exemplo)",
    "tools": "Guia de margem, tesoura de arremate e amostra de referência.",
    "needles": "Agulha e linhas conforme tecido e especificação do equipamento.",
    "time": "1,10 min/peça — simulação",
    "skill": "Fácil",
    "settings": "Margem, tensão, diferencial e comprimento do ponto aprovados na amostra.",
    "stitch": "Overlock elástica de união.",
    "quality": "Laterais alinhadas, encontro das costuras da cava correto, comprimento simétrico.",
    "defects": "Degrau nas cavas, costura aberta, torção, diferença entre os lados.",
    "critical": "Conferir encontro das costuras e evitar deslocamento das camadas.",
    "guidance": "Se o modelo exigir abertura lateral, seguir o procedimento específico.",
    "steps": [
      [
        "Preparar corpo",
        "Colocar a peça pelo avesso e alinhar as laterais."
      ],
      [
        "Conferir cavas",
        "Coincidir as costuras das mangas com as referências."
      ],
      [
        "Fechar primeiro lado",
        "Unir a lateral e manga na sequência aprovada."
      ],
      [
        "Fechar segundo lado",
        "Repetir o procedimento sem alterar a margem."
      ],
      [
        "Revisar",
        "Conferir os dois lados e separar defeitos."
      ]
    ]
  },
  {
    "key": "bainha",
    "name": "Fazer bainha da barra",
    "objective": "Dar acabamento à borda inferior da camiseta, mantendo largura e aparência uniformes.",
    "materials": "Camiseta montada; linha e fio compatíveis com o tecido.",
    "machine": "Galoneira industrial (exemplo)",
    "tools": "Guia de dobra, régua de conferência e tesoura de arremate.",
    "needles": "Agulhas e linhas compatíveis com a galoneira e a malha.",
    "time": "0,85 min/peça — simulação",
    "skill": "Médio",
    "settings": "Largura da dobra conforme ficha; bitola, tensão e acabamento conforme amostra. Validar em retalho.",
    "stitch": "Ponto de cobertura (galoneira).",
    "quality": "Dobra uniforme, pontos regulares e borda interna coberta conforme padrão.",
    "defects": "Bainha torcida, dobra irregular, pontos falhados, borda solta.",
    "critical": "Evitar esticar a barra durante a alimentação; conferir início e término.",
    "guidance": "Largura da dobra e bitola variam com o produto e equipamento.",
    "steps": [
      [
        "Conferir barra",
        "Verificar se a borda está limpa e sem danos."
      ],
      [
        "Dobrar",
        "Preparar a dobra conforme a medida definida na ficha."
      ],
      [
        "Testar acabamento",
        "Conferir amostra antes da execução."
      ],
      [
        "Costurar",
        "Manter a dobra alinhada ao guia aprovado."
      ],
      [
        "Inspecionar",
        "Verificar largura, regularidade e acabamento interno."
      ]
    ]
  },
  {
    "key": "inspecao",
    "name": "Inspeção final de camiseta",
    "objective": "Conferir a peça final em relação à ficha técnica e separar itens não conformes antes da embalagem.",
    "materials": "Camiseta acabada; ficha técnica; amostra aprovada; etiquetas de identificação.",
    "machine": "Não se aplica — bancada de inspeção.",
    "tools": "Fita métrica, iluminação adequada, ficha de conferência e recipiente para não conformes.",
    "needles": "Não se aplica.",
    "time": "1,50 min/peça — simulação",
    "skill": "Médio",
    "settings": "Condições de medição e tolerâncias conforme ficha técnica; não inventar limites de aceitação.",
    "stitch": "Não se aplica — verificar os pontos especificados para cada operação.",
    "quality": "Medidas dentro das tolerâncias aprovadas, costuras íntegras, cor e tamanho corretos, peça limpa.",
    "defects": "Furos, manchas, costuras abertas, pontos falhados, etiquetas incorretas, medidas fora da tolerância.",
    "critical": "Não liberar peças sem confirmação da conformidade.",
    "guidance": "Registrar a não conformidade e encaminhar para avaliação conforme fluxo da empresa.",
    "steps": [
      [
        "Identificar",
        "Conferir código, tamanho e cor."
      ],
      [
        "Examinar visualmente",
        "Inspecionar frente, costas, gola, mangas e barra."
      ],
      [
        "Verificar costuras",
        "Conferir continuidade e acabamento."
      ],
      [
        "Medir",
        "Comparar os pontos de medição com a ficha aprovada."
      ],
      [
        "Classificar",
        "Separar conforme/não conforme e registrar a decisão."
      ]
    ]
  }
] as const

export function demoPops(): PopRecord[] {
  const now = new Date().toISOString()
  return examples.map(({key,steps,...data},i) => ({
    ...data, id: 'demo-textil-'+key+'-1', groupId: 'demo-textil-'+key, version: 1, status:'draft',
    code: 'DEMO-'+String(i+1).padStart(3,'0'), name: data.name,
    stitchImage:'', safety: 'Exemplo de treinamento. Operação somente por pessoal capacitado, seguindo o manual do equipamento e as normas de segurança da empresa. Não remover proteções. Ajustes e manutenção somente com equipamento desenergizado, por responsável autorizado.',
    steps: steps.map(([title,text],n)=>({id:key+'-'+(n+1),title,text,image:''})),
    videos:[{id:key+'-video',title:'Vídeo demonstrativo — inserir link',url:''}],
    author:'Exemplo fictício', reviewer:'', approver:'', reason:'DEMONSTRAÇÃO — dados e tempos ilustrativos; validar com responsável técnico antes de uso real.',
    createdAt:now,updatedAt:now,publishedAt:''
  }))
}
export const isDemoPop = (p: Pick<PopRecord,'groupId'>) => p.groupId.startsWith('demo-textil-')

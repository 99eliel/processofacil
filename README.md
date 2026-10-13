# Processo Fácil

O **Processo Fácil** é uma plataforma universal, multiempresa e configurável para padronização, Ficha Técnica, fluxo operacional, produção e qualidade.

A planilha da Koleni foi o caso real que originou a ideia e continua servindo como **referência/template de confecção**. Ela não define o núcleo do produto e nenhuma regra específica daquele processo deve ser obrigatória para outros clientes.

## Status — v0.6.0

A base atual já possui:

- Firebase oficial `processofacil-3f688`;
- autenticação por e-mail e senha;
- recuperação de senha;
- bootstrap seguro da primeira empresa;
- arquitetura multiempresa com troca de empresa;
- filiais/unidades;
- perfis por empresa;
- módulos ativáveis;
- categorias em árvore;
- unidades configuráveis;
- fornecedores;
- materiais reais no Firestore;
- proteção contra códigos/descrições duplicados nos cadastros principais;
- estratégia de código de produto manual, sequencial, segmentada ou externa;
- produtos reais no Firestore;
- Ficha Técnica com rascunho, histórico de revisão, construção e BOM;
- revisão padrão protegida contra edição;
- Workflow editável por empresa;
- Ordem de Produção com vários produtos e variantes;
- congelamento da revisão e do kit de materiais na liberação da OP;
- necessidade bruta calculada a partir da BOM;
- Qualidade com várias amostras, critérios numéricos e checklist;
- reprovação da OP e retorno para retrabalho;
- auditoria de ações críticas;
- regras iniciais de Firestore e Storage isoladas por empresa;
- índices iniciais do Firestore;
- Error Boundary para evitar tela branca silenciosa;
- CI com typecheck e build.

## Firebase oficial

- **Project ID:** `processofacil-3f688`
- **Auth Domain:** `processofacil-3f688.firebaseapp.com`
- **Storage:** `processofacil-3f688.firebasestorage.app`

O projeto antigo `cotacao-78d9f` não deve mais ser usado.

Consulte [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) para ativação dos serviços e publicação das regras.

## Estrutura de dados

```text
usuarios/{uid}/empresas/{empresaId}

empresas/{empresaId}/
  membros/
  configuracoes/
  fornecedores/
  categorias/
  materiais/
  produtos/
    {produtoCodigo}/revisoes/
  fichas/
  ordensProducao/
  inspecoes/
  auditoria/
  contadores/
```

Os documentos operacionais ficam sempre dentro da empresa. A segurança não depende apenas da interface: as regras do Firestore verificam a associação do usuário ao tenant.

## Regras importantes já implementadas

- exclusão física não é usada para dados críticos;
- inspeções são imutáveis;
- revisões publicadas/obsoletas não podem ser alteradas;
- editar uma FT padrão cria uma nova revisão;
- uma OP liberada usa snapshots de revisão e BOM;
- alterações posteriores na FT não alteram uma OP já liberada;
- cada empresa possui seus próprios módulos, unidades, categorias, código e workflow;
- nenhum conceito de confecção é obrigatório no núcleo.

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação:

```bash
npm run check
npm run build
```

## Implantação web

O workflow `.github/workflows/deploy.yml` publica o conteúdo compilado de `dist` no GitHub Pages.

No GitHub, configure:

**Settings > Pages > Build and deployment > Source > GitHub Actions**

Não use **Deploy from a branch**, pois esse modo tenta publicar os arquivos-fonte do Vite/Jekyll e pode resultar em tela branca.

## Próximas evoluções

A arquitetura já foi deixada preparada para as próximas camadas, principalmente:

- upload e gerenciamento de imagens/anexos da FT;
- grade e tabela de medidas totalmente configuráveis;
- importador genérico Excel/CSV com mapeamento de colunas;
- convites e administração avançada de usuários;
- fornecedores alternativos completos por material;
- comparação visual entre revisões;
- PDF oficial de Ficha Técnica;
- notificações;
- PWA reinstalável após estabilização definitiva do deploy/cache;
- dashboards e relatórios avançados;
- estoque e necessidade líquida de compra como módulo futuro.

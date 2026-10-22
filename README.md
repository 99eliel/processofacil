# Processo Fácil

O **Processo Fácil** é uma plataforma universal e configurável para padronização, Ficha Técnica, fluxo operacional, produção e qualidade.

A planilha da Koleni foi o caso real que originou a ideia e continua servindo apenas como **referência/template de confecção**. Nenhuma regra específica daquele processo é obrigatória para os demais clientes.

## Status — v0.7.0

A base atual está sendo tratada como produto operacional, não mais como protótipo.

### Funcionamento real já disponível

- Firebase oficial `processofacil-3f688`;
- entrada direta no sistema, sem tela de login;
- sessão técnica automática e persistente no Firebase;
- workspace real criado automaticamente no primeiro acesso;
- dados isolados por empresa/workspace;
- empresa, matriz e filiais;
- módulos configuráveis;
- categorias em árvore;
- unidades configuráveis;
- fornecedores;
- materiais reais com:
  - múltiplos fornecedores;
  - fornecedor principal;
  - referência por fornecedor;
  - código legado;
  - custo unitário;
  - lead time;
  - lote mínimo;
  - edição controlada;
  - inativação lógica;
- produtos reais com:
  - código manual, sequencial, segmentado ou externo;
  - código imutável após criação;
  - edição de descrição;
  - inativação/reativação;
- Ficha Técnica com:
  - revisões;
  - rascunho, validação, padrão e obsoleta;
  - construção/processo;
  - BOM;
  - consumo;
  - perda;
  - fornecedor congelado na revisão;
  - imagens reais no Firebase Storage;
  - grade/tamanhos;
  - tabela de medidas;
  - tolerâncias;
  - impressão limpa;
- Workflow configurável;
- Ordem de Produção com vários produtos e variantes;
- revisão e kit congelados na liberação da OP;
- necessidade bruta calculada a partir da BOM;
- Qualidade com várias amostras;
- critérios numéricos e checklist;
- reprovação e retorno para retrabalho;
- auditoria de ações críticas;
- inspeções imutáveis;
- revisões publicadas protegidas contra alteração;
- Error Boundary para evitar tela branca silenciosa;
- CI com typecheck e build em Node 24.

## Modo de acesso atual

A autenticação de usuários está **temporariamente fora da interface**.

Para não deixar o Firestore público, o sistema usa por baixo uma **sessão técnica anônima do Firebase Authentication**. Ela é persistida no navegador e serve apenas para identificar o workspace e cumprir as regras de segurança.

Quando a autenticação de usuários voltar, a camada operacional, os dados e os módulos não precisam ser refeitos.

> No Firebase Console, o provedor **Anonymous** precisa estar habilitado durante esta fase.

## Firebase oficial

- **Project ID:** `processofacil-3f688`
- **Auth Domain:** `processofacil-3f688.firebaseapp.com`
- **Storage:** `processofacil-3f688.firebasestorage.app`

O projeto antigo `cotacao-78d9f` não deve mais ser usado.

Consulte [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) para publicação das regras e configuração do ambiente.

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

Firebase Storage:
empresas/{empresaId}/fichas/{produtoCodigo}/revisoes/{numero}/...
```

## Regras de arquitetura

- sem dados de demonstração no fluxo operacional;
- nenhum conceito de confecção hardcoded no núcleo;
- exclusão física evitada em registros críticos;
- código de produto não é alterado por uma edição comum;
- FT padrão nunca é sobrescrita;
- editar FT padrão gera nova revisão;
- OP liberada preserva snapshots da revisão e da BOM;
- mudança posterior na FT não altera OP existente;
- inspeções são imutáveis;
- ações importantes geram auditoria;
- campos opcionais `undefined` não quebram gravações do Firestore;
- imagens e anexos são gravados sob o tenant da empresa.

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

## GitHub Pages

Use:

**Settings > Pages > Build and deployment > Source > GitHub Actions**

Não use **Deploy from a branch**.

O workflow correto é:

```text
main
  -> npm install
  -> typecheck
  -> vite build
  -> dist
  -> GitHub Pages
```

## Próximas camadas

- importador universal CSV/Excel;
- presets reutilizáveis de grade e pontos de medida;
- checklist configurável da FT;
- comparação visual entre revisões;
- relatórios e PDFs oficiais;
- administração de usuários quando o login for reativado;
- App Check antes de abertura pública ampla;
- dashboards avançados;
- estoque e necessidade líquida como módulo futuro.

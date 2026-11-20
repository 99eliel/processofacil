# Processo Fácil

O **Processo Fácil** é uma plataforma universal e configurável para padronização, Ficha Técnica, fluxo operacional, produção e qualidade.

A planilha da Koleni foi o caso real que originou a ideia e continua servindo apenas como **referência/template de confecção**. Nenhuma regra específica daquele processo é obrigatória para os demais clientes.


## Remapeamento 2.0 — ambiente de teste

O sistema tem cinco áreas: **Produtos e Fichas Técnicas**, **Ordens de Produção**, **Planejamento**, **Produção**, **Gestão e Relatórios**. Configurações concentram os cadastros administrativos, o Workflow e o Laboratório.

- A **Ficha Técnica foi preservada** integralmente neste remapeamento.
- Apontamentos parciais, quantidades boas/defeituosas e estornos auditados utilizam as coleções `apontamentos`, `saldosOperacoes` e `estornosApontamentos`.
- Apontamentos validam o saldo disponível e a saída boa da operação anterior. Ajustes que invalidariam peças já consumidas pela etapa seguinte são bloqueados.
- Programação usa `programacoes`; colaboradores usam `colaboradores`; ambos ficam no workspace ativo.
- A seção Gestão exporta CSV e oferece impressão/PDF respeitando os filtros de apontamento. O avanço histórico da OP é separado dos filtros de período.
- A produção por quantidades é independente dos botões antigos de conclusão inteira de operação, que deixaram de ser a navegação principal. Uma futura etapa unificará o ciclo completo de encerramento da OP.
- Foram mantidos os nomes dos campos existentes nas OPs, como `prazo`, para compatibilidade; a interface apresenta **Necessidade**.

**ATENÇÃO — SEGURANÇA DO AMBIENTE ATUAL:** o `SystemProvider.tsx` usa o workspace fixo `principal` com usuário técnico local; o `firestore.rules` aceita leitura e gravação sem verificação de identidade nesse workspace. Não use dados pessoais, dados reais de clientes ou informações confidenciais e não comercialize essa configuração. É obrigatório implementar autenticação real, vínculos de usuários por empresa e regras restritivas antes de produção. A chave de configuração cliente do Firebase não substitui controles de acesso.



## Atualização integrada — 19/11/2026

### Funcionalidades para testar

- **Produção real:** etapas com progresso individual, saldos em boas e defeituosas, apontamentos parciais e estornos sem apagar a origem.
- **Retrabalho:** conversão auditável de defeituosas em boas na mesma operação, inclusive estorno seguro do retrabalho. Não duplica unidades totais.
- **Equipe:** responsável escolhido entre os colaboradores ativos ou digitado manualmente.
- **Planejamento:** Carga Máquina e Carga Mão de Obra consideram as unidades boas realmente registradas; OPs preservam snapshots mesmo após arquivar o cadastro de produto.
- **Cronometragem:** na aba Planejamento, inicie e pare o cronômetro ou inclua medições manuais, registre ritmo e tolerância e salve estudos. Não atualiza automaticamente uma Ficha Técnica publicada.
- **Balanceamento:** simulação opcional por equipe, sem alterar a OP, respeitando atribuições existentes. Sugestões para etapas sem equipe não consideram habilitações ou o calendário real.
- **Relatórios:** produção por responsável, por operação e por OP, retrabalhos, amostragens de qualidade, CSV filtrado e impressão/PDF.
- **Configurações → Diagnóstico:** verificações automáticas em modo somente leitura de vínculos, saldos, OPs, prazos e histórico.
- **Encerramento:** OPs liberadas nesta versão têm o novo `modoProducao: 'quantidade'`; a conclusão no Workflow exige apontamento integral de boas na última operação. OPs antigas mantêm a regra anterior para não quebrar o histórico.
- **CI:** tipagem, testes automatizados com Node 24 e compilação antes do deploy.

### Modelo de dados estendido

Coleções em `empresas/{empresaId}`:

- `apontamentos`, `saldosOperacoes`, `estornosApontamentos`
- `retrabalhosOperacoes`, `estornosRetrabalhos`
- `programacoes`, `colaboradores`, `configuracoesCapacidade`
- `estudosTempos`

**Não é produção comercial:** o workspace `principal` ainda necessita de autenticação real e regras de permissão restritivas. Use dados fictícios. Testes automáticos validam regras puras e compilação, não substituem testes em Firebase nem uma auditoria de segurança.


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

O ambiente atual usa um **usuário técnico local fixo**, sem login. As regras para o workspace `principal` estão abertas e **não garantem proteção de dados**; veja o alerta de segurança acima.

Quando a autenticação de usuários voltar, a camada operacional, os dados e os módulos não precisam ser refeitos.

Para uma versão de produção, configurar Firebase Authentication, controle de membros por empresa e regras adequadas é requisito obrigatório.

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

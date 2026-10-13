# Processo Fácil

O **Processo Fácil** é uma plataforma universal e configurável para empresas que precisam organizar cadastros, produtos, fichas técnicas, aprovações, produção e qualidade sem ficar presas a um único segmento.

A planilha da Koleni foi a origem do caso de uso e serve como **referência/template de confecção**, não como regra fixa do produto.

## Firebase oficial

O projeto Firebase oficial do sistema é:

- **Project ID:** `processofacil-3f688`
- **Auth Domain:** `processofacil-3f688.firebaseapp.com`
- **Storage:** `processofacil-3f688.firebasestorage.app`

Este é o backend oficial para Auth, Firestore, Storage e futuros recursos Firebase do Processo Fácil. O projeto antigo `cotacao-78d9f` não deve mais ser usado pelo sistema.

## Princípios da arquitetura

- Multiempresa no mesmo ambiente, com isolamento por `empresaId`/tenant.
- Um Firebase compartilhado entre os clientes.
- Módulos ativáveis por empresa.
- Filiais/unidades por empresa.
- Perfis configuráveis; um usuário pode ter mais de um perfil.
- Código de produto configurável por árvore/segmentos, com suporte futuro a outras estratégias.
- Categorias e unidades configuráveis.
- Ficha Técnica flexível: BOM, medidas, operações, checklist e outros blocos podem ser opcionais.
- Editar uma FT publicada gera nova revisão; a revisão publicada anterior permanece preservada.
- Workflow configurável por empresa, com aprovação paralela ou sequencial.
- OP pode ter vários produtos e variantes e congela revisão/kit na liberação quando aplicável.
- Qualidade configurável por critérios numéricos, checklist e severidade.
- Exclusão lógica; registros críticos não são apagados fisicamente.
- Auditoria e portabilidade de dados fazem parte da arquitetura.

## Estrutura atual

- `src/App.tsx`: interface da base universal.
- `src/domain/types.ts`: modelos de domínio usados na V1.
- `src/data.ts`: dados demonstrativos neutros, sem dependência de confecção.
- `src/firebase/config.ts`: inicialização do Firebase oficial.
- `src/firebase/tenantRepository.ts`: helpers de persistência com caminhos isolados por empresa.
- `firestore.rules`: regras iniciais de isolamento e perfis.
- `firebase.json`: Firestore + Hosting.
- `.firebaserc`: fixa o projeto Firebase oficial para deploys locais via Firebase CLI.

## Próximas entregas

1. Auth e seleção real de empresa/perfis.
2. Cadastro real de empresa, filiais e wizard persistido.
3. Materiais, fornecedores, categorias e unidades no Firestore.
4. Motor de estratégia de códigos.
5. Produtos e Ficha Técnica configurável.
6. Workflow/aprovações.
7. Importador genérico Excel/CSV.
8. OP e Qualidade.

## Desenvolvimento

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

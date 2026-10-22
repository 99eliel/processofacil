# Configuração do Firebase oficial

Projeto oficial: **processofacil-3f688**

O front-end já está apontando para este projeto.

## 1. Authentication — modo atual

A tela de login está temporariamente desativada.

Para manter o banco protegido, habilite apenas o provedor técnico usado nesta fase:

**Authentication > Sign-in method > Anonymous > Enable**

O sistema cria uma sessão anônima persistente e entra direto no workspace operacional.

Quando o login por usuário voltar, o provedor Anonymous poderá ser desativado depois da migração das sessões/workspaces.

## 2. Firestore Database

Crie o Firestore caso ainda não exista.

Depois publique regras e índices:

```bash
firebase login
firebase use processofacil-3f688
firebase deploy --only firestore:rules,firestore:indexes
```

As regras atuais:

- isolam os dados por empresa;
- exigem sessão Firebase;
- impedem exclusão física de registros críticos;
- tornam inspeções imutáveis;
- protegem revisões publicadas/obsoletas;
- restringem configurações e auditoria.

## 3. Storage

Ative o Firebase Storage e publique as regras:

```bash
firebase deploy --only storage
```

Arquivos da FT ficam em:

```text
empresas/{empresaId}/fichas/{produtoCodigo}/revisoes/{numero}/...
```

O acesso depende da associação da sessão ao workspace.

## 4. Workspace inicial

No primeiro acesso sem dados vinculados à sessão, o sistema cria automaticamente:

- usuário técnico;
- empresa/workspace principal;
- membro administrador;
- matriz;
- configurações gerais;
- unidades padrão.

O nome inicial é:

**Processo Fácil — Ambiente Principal**

Ele pode ser alterado em **Configurações > Empresa**.

## 5. GitHub Pages

No GitHub:

**Settings > Pages > Build and deployment > Source > GitHub Actions**

Não use **Deploy from a branch**, pois esse modo pode publicar o código-fonte em vez do `dist`.

## 6. Desenvolvimento local

```bash
npm install
npm run dev
```

Validação:

```bash
npm run check
npm run build
```

## 7. Antes de abertura pública

Antes de disponibilizar o sistema para clientes reais:

1. reativar autenticação nominal de usuários;
2. migrar/vincular o workspace da sessão técnica ao usuário administrador real;
3. habilitar Firebase App Check;
4. revisar permissões por perfil;
5. criar política de backup/exportação;
6. revisar limites/custos de Firestore e Storage;
7. ativar monitoramento de erros e alertas.

A sessão anônima atual é uma solução de desenvolvimento operacional: remove a barreira de login sem transformar o Firestore em banco público.

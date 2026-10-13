# Configuração do Firebase oficial

Projeto oficial: **processofacil-3f688**

O front-end já está apontando para este projeto. Para os recursos reais funcionarem no ambiente publicado, confirme os serviços abaixo no Console do Firebase.

## 1. Authentication

Em **Authentication > Sign-in method**, habilite:

- Email/Password

O sistema já possui:

- cadastro de usuário;
- login;
- recuperação de senha;
- logout;
- criação da primeira empresa;
- seleção de empresa quando o usuário possuir mais de uma.

## 2. Firestore Database

Crie o banco Firestore caso ainda não exista.

Depois, na raiz do repositório:

```bash
firebase login
firebase use processofacil-3f688
firebase deploy --only firestore:rules,firestore:indexes
```

As regras do projeto implementam isolamento multiempresa, perfis, auditoria, inspeções imutáveis e proteção de revisões publicadas.

## 3. Storage

Ative o Firebase Storage e publique as regras:

```bash
firebase deploy --only storage
```

Os arquivos devem ficar em caminhos iniciados por:

```text
empresas/{empresaId}/...
```

As regras impedem leitura e escrita de arquivos por usuários que não pertençam à empresa.

## 4. GitHub Pages

No GitHub:

**Settings > Pages > Build and deployment > Source**

Selecione:

**GitHub Actions**

Não deixe **Deploy from a branch**, porque esse modo executa Jekyll sobre a raiz do repositório e pode publicar o TypeScript bruto em vez do build do Vite.

Workflow correto:

```text
main
  -> npm install
  -> typecheck
  -> npm run build
  -> dist
  -> GitHub Pages
```

## 5. Desenvolvimento local

```bash
npm install
npm run dev
```

Validação:

```bash
npm run check
npm run build
```

## 6. Estrutura multiempresa

Os dados operacionais são armazenados sob:

```text
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

Cada usuário possui ponteiros para suas empresas em:

```text
usuarios/{uid}/empresas/{empresaId}
```

Isso permite troca de empresa sem misturar os dados dos clientes.

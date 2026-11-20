# Processo Fácil — migração de segurança (pré-requisito para uso real)

## Por que existem dois arquivos de regras?

O ambiente de teste atual usa `firestore.rules` com workspace principal aberto; ele **não oferece confidencialidade nem autenticação individual**. Publicar regras fechadas agora, sem configurar um administrador, bloquearia o sistema. Por isso preparei `firestore.production.rules` e `storage.production.rules` separadamente e o modo de login opcional.

**Não publique dados pessoais ou de clientes enquanto as regras abertas estiverem ativas.**

## Passos de ativação (na mesma janela de manutenção)

1. Em Firebase Authentication, ative **Google** como método de login e autorize o domínio do GitHub Pages.
2. Entre com a conta administrativa para gerar o usuário e obtenha o **UID no Firebase Console**.
3. No Firestore Console, crie manualmente **`empresas/principal/membros/<UID>`** com `ativo: true`, `perfis: ['admin']`, `empresaId: 'principal'`, `nomeFantasia: 'Ambiente Principal'`. Não coloque o UID de outra pessoa.
4. Em GitHub → Settings → Secrets and variables → Actions → Variables, configure `PF_REQUIRE_AUTH` = `true`. O workflow de build passa essa variável para `VITE_REQUIRE_AUTH`. Faça novo deploy com o login ativo.
5. Publique **as duas regras restritivas** `firestore.production.rules` e `storage.production.rules` no Firebase Console (ou configure o CLI para usá-las). Valide antes com emulador da Firebase ou Rules Playground.
6. Em janela anônima, confirme que usuário não autenticado não acessa os dados; usuário sem cadastro em membros não acessa; somente membro ativo acessa.
7. Antes de comercializar, implemente controles administrativos de convites, papéis, múltiplas empresas e validação de permissões de cada operação. Este modelo é um **primeiro degrau de segurança para a empresa principal**, não uma solução comercial multiempresa pronta.

### Compatibilidade importante

- As gravações de auditoria feitas pela interface já utilizam `user.uid`; com Google o UID passa a ser o da conta autenticada.
- Sessões técnicas de teste e dados anteriores continuam no workspace `principal`; revisar acesso e remover dados fictícios antes de uso real.
- Dados com tokens de download antigos de Storage podem exigir verificação adicional, porque URLs públicas com token podem continuar acessíveis enquanto não forem revogadas.
- Equipes, colaboradores e permissões são conceitos diferentes: um colaborador de produção não está automaticamente autorizado a acessar o Firebase.
- O modo autenticado é habilitado **somente pelo build**: editar a variável sem republicar não altera o site já compilado.

Se houver falha de acesso, confirme o UID do membro, o provedor Google, as regras publicadas e a variável de build. Nunca volte às regras públicas em um ambiente com dados reais.

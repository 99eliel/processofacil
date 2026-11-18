# Roteiro de testes — Processo Fácil 2.0

## Antes de começar

- **Ambiente de testes:** as regras atuais do Firebase permitem acesso sem identidade autenticada ao workspace principal. Utilize apenas dados fictícios até que o login e as regras por empresa sejam implementados.
- Preserve o código e a revisão da Ficha Técnica original. A branch de segurança é `backup/pre-remapeamento-2026-11-18`.
- Crie uma OP nova a partir de uma ficha publicada, com pelo menos **duas operações** sequenciais e 10 unidades; opcionalmente outra OP com dois produtos.

## Cenários indispensáveis

- [ ] O novo menu apresenta cinco blocos e a Ficha Técnica existente mantém revisões, anexos, impressão e publicação.
- [ ] Produtos e materiais continuam acessíveis sem perder cadastros existentes.
- [ ] Criar OP, conferir número automático, variantes, valor de necessidade e revisão congelada.
- [ ] Liberar OP e abrir Produção a partir de sua página.
- [ ] Primeira operação: apontar 4 boas e 1 defeituosa. Saldo disponível da segunda operação deve ser **4**.
- [ ] Apontar 2 boas na segunda operação; o saldo de saída da primeira não deve ser consumido duas vezes.
- [ ] Tentar apontar 10 unidades na segunda operação: sistema precisa recusar excesso.
- [ ] Estornar apontamento ainda não consumido na próxima etapa: deve restaurar o saldo.
- [ ] Tentar estornar as 4 boas da primeira operação após consumo pela segunda: deve recusar.
- [ ] Apontar todas as unidades boas na última etapa de uma OP de 10, sem Workflow pendente, e concluir a OP.
- [ ] Em Planejamento, cadastrar duas equipes, renomear uma, cadastrar máquina e vincular colaborador.
- [ ] Programar OP com data e prioridade; editar e remover sem excluir a OP.
- [ ] Em Gestão, filtrar apontamentos por OP/período, exportar CSV e imprimir; o relatório deve conter apenas registros filtrados.
- [ ] Qualidade continua registrando inspeções e retrabalhos.
- [ ] Verificar em celular/tablet sem cortes no menu e nos formulários.
- [ ] Confirmar que dados antigos continuam íntegros após as alterações.

## Limitações conhecidas

- Cronometragem detalhada, balanceamento automático e custos não fazem parte desta entrega enxuta.
- O Workflow preexistente ainda pode concluir OPs pelo fechamento de etapas, independentemente dos novos saldos. Para testar a conclusão baseada em quantidade, use uma OP sem Workflow pendente.
- Cada apontamento informa o responsável manualmente, porque ainda não existe autenticação individual de operadores.
- Os indicadores novos consideram os apontamentos criados neste módulo; não inventam produção retroativa para OPs antigas.
- Apontamentos com defeito reduzem a quantidade boa transferível à próxima etapa. Planeje retrabalho/reposição para alcançar o total de boas esperado.
- Programação inicial mantém data, prioridade, equipe e máquina; não é um otimizador automático de calendário.

## Segurança antes de uso real

Configurar Firebase Authentication, autorização por empresa, regras do Firestore/Storage restritivas e auditoria associada a usuários reais. **Não cadastrar informações confidenciais no workspace aberto.**

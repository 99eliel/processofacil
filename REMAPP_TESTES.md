# Checklist rápido para o teste de amanhã — Processo Fácil

A Ficha Técnica publicada já existente foi preservada nesta atualização. **Use dados fictícios**, pois o workspace principal ainda não está protegido por autenticação individual.

## Teste principal (fluxo completo)

1. **Produtos e Fichas Técnicas:** abra uma ficha publicada e confirme as operações e os tempos-padrão. Não precisa editá-la.
2. **Ordens de Produção:** crie uma OP de exemplo com 10 unidades e duas operações; libere-a. A nova OP fica marcada para conclusão por quantidade.
3. **Produção:** escolha a OP, primeira etapa; registre **7 boas e 3 defeituosas**. Na segunda etapa, o saldo inicial disponível deve ser 7.
4. **Produção → Recuperar peças:** na primeira etapa, informe **3 recuperadas**, responsável e motivo. O saldo deve virar 10 boas e 0 defeituosas, sem criar unidades extras.
5. **Produção:** aponte 10 boas na segunda etapa. Volte à OP e conclua-a após finalizar aprovações configuradas, se houver.
6. **Planejamento:** confira a carga de horas da equipe/máquina. Progresso parcial deve reduzir a demanda restante. Experimente também Cronometragem e Balanceamento.
7. **Gestão e Relatórios:** filtre a OP; confira apontamentos, retrabalho, produção por responsável e exportação CSV/PDF.
8. **Configurações → Diagnóstico:** verifique se há erros ou pendências. O aviso de segurança do workspace principal é esperado nesta fase.

## Falhas que os testes automatizados já verificam

- Quantidade da próxima etapa limitada a **boas** na anterior.
- Progresso de acabados baseado na **última** operação, não na soma das etapas.
- Carga de horas reduzida pelo apontamento parcial.
- Produto arquivado não deve remover o snapshot da OP do cálculo de capacidade.
- Balanceamento respeita equipe já atribuída e sinaliza excedentes.

## Limitações conhecidas e próximos passos

- O balanceamento é apenas uma sugestão, não transfere equipe nem verifica habilitações individuais.
- Cronometragem não sobrescreve tempos de revisões publicadas; é material para nova revisão.
- Controle completo de estoque, faturamento, premiações e autenticação por empresa ainda não está incluído.
- Para ativar uso real por clientes, é obrigatório refazer o login, a autorização por empresa e as regras do Firestore/Storage.

---

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

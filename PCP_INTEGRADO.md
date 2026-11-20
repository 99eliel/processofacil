# Processo Fácil — PCP integrado (Carga Máquina e Mão de Obra)

## Escopo da evolução

A Ficha Técnica e o Passaporte publicado continuam preservados. As mudanças são aditivas, compatíveis com OPs antigas e concentram a execução em **Planejamento** e **Produção**.

### Operação como unidade de programação

Uma OP pode conter vários produtos e operações diferentes. Cada operação agora pode receber:

- Data planejada e turno (dia inteiro, manhã, tarde ou noite)
- Equipe e máquina por **identificador estável** (não pelo texto do nome)
- Prioridade e observações
- Programação independente dos demais processos da OP

Coleção: `empresas/{empresaId}/programacaoOperacoes/{taskId}`. As programações antigas em `programacoes/{opId}` continuam como fallback até a operação ser reprogramada; a Ficha Técnica congelada permanece íntegra.

### Capacidade de máquina e equipe

O cálculo usa:

- Horas disponíveis: quantidade de máquinas ou colaboradores × horas por dia × dias trabalhados × eficiência.
- **Equipe nominal**: se existirem colaboradores cadastrados para uma equipe, conta somente os ativos; sem cadastro nominal, conserva a quantidade manual existente.
- **Indisponibilidade**: férias, faltas, folgas ou manutenção registradas por período; desconta máquinas, equipes ou colaboradores no calendário.
- Dias de trabalho escolhidos no cadastro da máquina/equipe; turnos dividem a jornada cadastrada, não a duplicam.
- Horas demandadas: unidades boas ainda pendentes × tempo-padrão congelado na operação.
- Horas reais: sessões de cronômetro encerradas; tempo do fluxo antigo aparece somente quando ainda não existe cronometragem nova.
- **OPs concluídas não geram demanda pendente**.

A visão consolidada compara toda a carteira pendente com a semana selecionada. O calendário de carga apresenta o excedente por data e turno. Um apontamento de uma operação inteira em um dia não é dividido automaticamente.

### Cronometragem efetiva (diferente do estudo de tempos)

Na aba Produção, escolha a OP e a operação e informe o responsável. No painel **Registro de tempo real**, pode iniciar, pausar, retomar e encerrar a sessão. Só sessões encerradas entram nas horas reais dos relatórios e da carga.

Um operador pode apontar quantidade sem abrir o cronômetro. A medição depende do relógio do dispositivo; não deve ser tomada como registro legal de jornada.

### Balanceamento e estimativa de prazo

O Balanceamento compara **todas as OPs ativas** ou uma OP, usando equipes disponíveis naquela semana e respeitando as atribuições de recursos já salvas. Não grava sugestões sozinho.

O Calendário mostra **Previsão estimada de conclusão** para operações pendentes com tempos válidos. A simulação distribui a demanda restante sobre a capacidade disponível, conforme as prioridades informadas e a sequência do item. Sem equipamento/equipe ou tempo válido, informa ausência de previsão.

Essa previsão é exploratória, não garante prazo e não inclui todos os deslocamentos, setups, troca de máquina, retrabalho futuro, feriados, competências por pessoa nem entregas parciais entre fases.

## Um roteiro de teste rápido

1. **Equipe e máquina:** em Planejamento → Carga Máquina, cadastre uma máquina de 8 h/dia e configure turnos/dias úteis. Em Carga Mão de Obra, cadastre uma equipe. Em Colaboradores, vincule duas pessoas ativas.
2. **OP:** libere uma OP fictícia com 10 unidades, duas operações e tempos-padrão no Passaporte. OP sem operações deve ser rejeitada na liberação.
3. **Programação:** programe cada operação com sua data, máquina e equipe; mantenha recursos distintos se necessário. Verifique o calendário nas duas cargas.
4. **Falta e manutenção:** em Disponibilidade, bloqueie uma das pessoas por um dia e uma máquina por outro. Confira queda na capacidade e alertas de sobrecarga.
5. **Produção:** registre algumas unidades boas e defeituosas. Confira se a demanda de cada operação diminui somente pelas boas.
6. **Tempo real:** informe o operador, inicie o cronômetro, pause, retome e encerre. Verifique as horas registradas em Gestão e na Carga.
7. **Balanceamento:** abra Ferramentas técnicas → Balanceamento e compare todas as OPs ativas; as equipes vinculadas não devem ser trocadas.
8. **Previsão:** no calendário das Cargas, expanda Previsão estimada de conclusão; confira se manutenção e sobrecarga podem adiar a data.
9. **Legado:** confirme que uma OP antiga, mesmo com cadastro de produto arquivado, permanece disponível como histórico e mantém seu Passaporte congelado.

## Incompatibilidades evitadas

- Não renomear IDs já existentes quando a máquina/equipe muda de nome.
- Não apagar dados de OPs, revisões, apontamentos ou programações antigas.
- Não criar OP sem operações.
- Não concluir OP nova sem a quantidade boa final exigida.
- Não alterar silenciosamente tempos-padrão de revisões publicadas.
- Não alterar o status da OP quando se registra somente programação ou indisponibilidade.

## Segurança

O login Google + associação por membro está **preparado, mas desativado por padrão** para não interromper o ambiente de teste. As regras Firestore/Storage de produção estão em arquivos separados; **não foram ativadas**. Leia `SEGURANCA_MIGRACAO.md` antes de usar dados reais. Não use dados confidenciais no workspace atualmente aberto.

## Limitações de implantação

- A interface do planejamento ainda agenda **uma data por operação**. A previsão pode distribuir virtualmente horas entre vários dias, mas não grava essa divisão no calendário.
- Feriados e paradas específicas por turno precisam de evolução adicional, além das indisponibilidades por dia.
- A disponibilidade é calculada com a jornada, o turno e as equipes cadastradas; não valida competências de colaboradores por máquina.
- Regras restritivas de produção exigem configurar Firebase Authentication, administrador por UID e variáveis de build antes da publicação.
- Testes automáticos verificam matemática e tipagem; Firestore ao vivo, impressão e dispositivos precisam de testes manuais.

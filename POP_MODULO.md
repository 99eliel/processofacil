# POP — módulo 02
Biblioteca independente por empresa; documentos em empresas/{empresaId}/pops/{groupId}-{version}. Rascunhos editáveis, publicação bloqueia edição pelo aplicativo; nova versão cria documento separado. Fichas em rascunho podem vincular a revisão publicada pela aba de operações ou pela biblioteca. A versão vinculada é fixa. O QR abre a revisão publicada usando a rota #/pop/id. Fotos no Storage; vídeos são links YouTube. A impressão possui documento próprio, A4 ou A3.

## Validação
- Criar e salvar rascunho, adicionar etapa com foto e vídeo, publicar.
- Vincular em uma operação de ficha em rascunho, salvar e reabrir a ficha.
- Testar impressão, leitura de QR e vídeo no celular; testar nova revisão sem alterar a anterior.
- Regras do repositório foram atualizadas; a publicação no Firebase é uma etapa separada. O ambiente de teste atual é aberto e não deve receber conteúdo confidencial. Para produção, usar autenticação e regras privadas. Vídeos não listados não são privados.

## Criação por produto
Ao criar um POP, o usuário escolhe entre um procedimento independente (sem produto obrigatório) e a criação a partir de produto e operação em ficha técnica em rascunho. POPs independentes são publicados na biblioteca e podem ser vinculados posteriormente a várias peças. O produto de origem é persistido no POP e exibido no documento. Dados técnicos existentes são sugeridos. A primeira publicação cria o vínculo na mesma transação; revisões posteriores e outros produtos continuam com vínculo explícito. Uma ficha publicada só recebe POP por nova revisão em rascunho.

- Validar as duas opções de criação: independente, sem origem obrigatória; e a partir de uma ficha em rascunho, com vínculo automático na primeira publicação.

## Exemplos de treinamento
Na biblioteca, clique em Carregar exemplos fictícios para importar seis POPs independentes (rascunhos). IDs estáveis impedem duplicatas e substituição de edições. Vídeos e fotos ficam sem links/arquivos. Os dados e tempos são ilustrativos; não servem como instruções aprovadas de produção. A indicação de demonstração também aparece na prévia e impressão.

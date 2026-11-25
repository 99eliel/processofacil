# POP — módulo 02
Biblioteca independente por empresa; documentos em empresas/{empresaId}/pops/{groupId}-{version}. Rascunhos editáveis, publicação bloqueia edição pelo aplicativo; nova versão cria documento separado. Fichas em rascunho podem vincular a revisão publicada pela aba de operações ou pela biblioteca. A versão vinculada é fixa. O QR abre a revisão publicada usando a rota #/pop/id. Fotos no Storage; vídeos são links YouTube. A impressão possui documento próprio, A4 ou A3.

## Validação
- Criar e salvar rascunho, adicionar etapa com foto e vídeo, publicar.
- Vincular em uma operação de ficha em rascunho, salvar e reabrir a ficha.
- Testar impressão, leitura de QR e vídeo no celular; testar nova revisão sem alterar a anterior.
- Regras do repositório foram atualizadas; a publicação no Firebase é uma etapa separada. O ambiente de teste atual é aberto e não deve receber conteúdo confidencial. Para produção, usar autenticação e regras privadas. Vídeos não listados não são privados.

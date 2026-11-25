# Roteiro oficial do Processo Fácil

A partir de 25/11/2026, a imagem do roteiro original passa a ser a referência para a ordem dos módulos, com uma decisão importante: **Ficha Técnica primeiro, POP segundo**.

| Etapa | Módulo | Estado |
|---|---|---|
| 1 | Ficha Técnica | Único módulo ativo |
| 2 | POP (Procedimento Operacional Padrão) | Próximo a desenvolver |
| 3 | Oficinas | Planejado |
| 4 | Ordem de Produção | Planejado |
| 5 | Carga Máquina e Mão de Obra | Planejado |
| 6 | Qualidade | Planejado |
| 7 | Realidade Aumentada | Planejado |
| 8 | Busca Avançada | Planejado |
| 9 | Favoritos | Planejado |
| 10 | Atualizações | Planejado |

A Ficha Técnica continua sendo o **único módulo ativo**. Exibir este roteiro não ativa os outros módulos. O que foi implementado anteriormente fica preservado no código e no Firebase para referência; não deve ser reativado automaticamente.

## Forma de trabalho

Cada etapa será **definida em conjunto, implementada e testada** antes de iniciar a próxima. O sistema deve continuar **universal e configurável**, não vinculado a uma empresa específica.

## Próxima etapa: POP

Antes de implementar, precisamos definir com o usuário a finalidade e o fluxo do POP, aproveitando os dados já existentes em **Operações de produção** da Ficha Técnica. Pontos para definir, não requisitos fechados:

1. Se o POP pertence a uma operação da ficha, a um produto ou pode ser reutilizado entre produtos.
2. Quais instruções, ferramentas, fotos, vídeos e verificações são obrigatórios.
3. Como se relaciona à revisão e à publicação da Ficha Técnica.
4. Como a pessoa executando o processo deve visualizar o POP no celular ou imprimir.
5. Como validar um primeiro fluxo simples antes de acrescentar mais funcionalidades.

Não adicionar coleções, migrações ou regras de segurança nesta etapa de organização.

## Segurança e reversão

A versão anterior com todos os módulos permanece em `backup/antes-foco-ficha-tecnica-2026-11-25`. O estado anterior ao registro deste roteiro está em `backup/antes-roteiro-original-2026-11-25`.

Este ajuste não altera documentos do Firestore, regras de Storage ou Firestore, nem configurações de autenticação.

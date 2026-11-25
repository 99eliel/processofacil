# Processo Fácil — Etapa 1: Ficha Técnica

O Processo Fácil está **intencionalmente focado em um único módulo**: **Ficha Técnica**.

O objetivo desta fase é construir e estabilizar o sistema por etapas, com testes reais e decisões conjuntas antes de reintroduzir outros módulos.

## O que está disponível agora

- Listagem e abertura de Fichas Técnicas existentes.
- Cadastro de novo produto diretamente dentro da Ficha Técnica (com criação de revisão inicial).
- Revisões em rascunho, validação, publicação, histórico e comparação.
- Campos técnicos, materiais (com cadastro rápido), medidas, operações, fotos, vídeos e anexos.
- Visualização e impressão da Ficha Técnica em PDF.

## O que saiu da navegação

Ordens de Produção, Planejamento, Carga Máquina, Carga Mão de Obra, Produção, Qualidade, Relatórios, Administração ampla, Workflow separado, Simulador, Diagnósticos e dashboard geral.

**Atenção:** essas áreas **não foram apagadas do repositório ou do Firebase**. O código anterior permanece versionado e os registros das coleções existentes não foram excluídos. O snapshot de segurança está em \`backup/antes-foco-ficha-tecnica-2026-11-25\`.

O cadastro de produtos e o de materiais continuam acessíveis **dentro da Ficha Técnica**, de forma simplificada. Cadastros administrativos avançados não fazem parte desta primeira etapa.

## O que não foi alterado

- Nenhum documento do Firebase foi apagado ou migrado.
- As chaves de dados, revisões e estruturas técnicas continuam compatíveis.
- As regras de Firestore e Storage permanecem como estavam.
- O modo de autenticação não foi alterado.

**Aviso de segurança:** a configuração atual de testes ainda não exige autenticação individual no workspace principal. Não utilize dados reais de clientes ou informações confidenciais até configurar autenticação e regras restritivas.

## Próximas fases

Cada módulo será planejado, implementado e testado separadamente, a partir das necessidades do usuário. Nenhum módulo novo será exposto na interface antes de estar aprovado.

## Ordem oficial dos módulos

A referência atual para a evolução é [ROTEIRO_OFICIAL.md](./ROTEIRO_OFICIAL.md): **Ficha Técnica → POP → Oficinas → Ordem de Produção → Carga Máquina e Mão de Obra → Qualidade → Realidade Aumentada → Busca Avançada → Favoritos → Atualizações**. Essa sequência é apenas de desenvolvimento; nenhum módulo futuro foi reativado.

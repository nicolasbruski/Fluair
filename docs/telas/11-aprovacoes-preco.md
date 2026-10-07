# Tela de Aprovações de preço

## Identificação

- Rota: `/aprovacoes/precos`
- Acesso administrativo: papel `ADMINISTRATOR`
- Estado: sino pessoal/administrativo, painel de pendências, fila completa, detalhe, aprovação e reprovação implementados

## Sino, painel de pendências e fila completa

Todo usuário autenticado vê o sino de aprovações, posicionado à direita do controle **Ocultar
preços** no cabeçalho. Para usuários comuns, o painel mostra somente as três solicitações próprias
mais recentes realizadas nos últimos sete dias. Ele permite consultar o resultado, cancelar uma
pendência e retomar o carrinho fotografado. Essas solicitações não aparecem abaixo do carrinho.

Para administradores, o sino apresenta a fila global `PENDING`. Uma bolinha vermelha sem número
aparece no canto inferior direito quando existe pendência aplicável ao usuário; o nome acessível do
botão informa a quantidade exata. O indicador desaparece quando o total é zero. Não existe item
textual **Aprovações** no menu.

Ao acionar o sino, um painel não modal abre logo abaixo do ícone e apresenta as primeiras pendências,
das mais antigas para as mais novas. O painel possui carregamento, vazio, erro recuperável, fechamento
por botão, clique externo e `Escape`. Cada item inteiro é acionável por mouse ou teclado; selecioná-lo
fecha o painel e abre o detalhe em modal no centro da tela, sem botão intermediário **Analisar**. O
link **Ver histórico completo** preserva o acesso à rota `/aprovacoes/precos`.

A fila completa é paginada no servidor. Pendências aparecem das mais antigas para as mais novas; os
demais estados usam atualização recente. É possível filtrar por estado, período e código. Cada resumo
apresenta cliente, solicitante, espera, quantidade de exceções, total solicitado, impacto e resultado.
Solicitações decididas informam se foram aprovadas ou reprovadas, o revisor e a data da decisão. A
visão completa inicia em **Todos** para que a decisão continue visível após sair das pendências.

## Detalhe e decisão

O detalhe usa o snapshot persistido, mas apresenta somente os dados necessários para a decisão:
cliente, solicitante, data, quantidade de itens e exceções, justificativa, quantidade e faixa de cada
item, preços unitários e diferença por item. O modal não repete um resumo financeiro geral acima dos
itens. Identificadores
técnicos de origem, e-mail do solicitante, campos vazios e subtotais duplicados não são exibidos.
Texto vindo da API é inserido como texto, não como HTML.

Aprovar aceita uma observação opcional. Reprovar exige motivo. O backend exige o papel
`ADMINISTRATOR`, independentemente de concessões individuais de permissão, e resolve o revisor pela
sessão, impede autoavaliação e aplica a transição somente se estado e versão ainda coincidirem. Se
outro administrador decidir primeiro, a tela informa o conflito e recarrega o estado vencedor.

Uma aprovação vale por sete dias por padrão, configuráveis por
`ORDER_PRICE_APPROVAL_VALIDITY_DAYS`. Ela cobre o conteúdo integral, não permite aprovação parcial
e pode ser consumida por um único pedido. Decidir não cria pedido, número ou entrega de e-mail.

## Auditoria e operação

Solicitação, substituição, cancelamento, aprovação, reprovação, expiração e consumo geram eventos
de auditoria. O contador usa índice por estado; a expiração oportunista é condicional e idempotente.
Logs operacionais usam `requestId` e identificadores, sem registrar carrinho ou justificativa
completos.

## Critérios funcionais

- acesso direto sem permissão recebe bloqueio seguro;
- o sino aparece para todo usuário autenticado;
- usuários comuns veem somente registros próprios, limitados a três e aos últimos sete dias;
- o histórico pessoal não aparece no carrinho;
- pendências administrativas não desaparecem da fila por terem mais de sete dias;
- somente o papel `ADMINISTRATOR` pode aprovar ou reprovar;
- o sino nunca mostra contagem numérica visual e usa a bolinha vermelha somente quando há pendências;
- o painel fecha por clique externo e `Escape`, e o modal devolve o foco ao sino;
- selecionar qualquer área de uma notificação abre diretamente o modal de detalhe;
- aprovar ou reprovar remove a solicitação das notificações pendentes e preserva resultado e revisor
  no histórico completo;
- solicitante e revisor precisam ser pessoas diferentes;
- somente a primeira decisão concorrente altera o registro;
- aprovação e reprovação ficam visíveis ao solicitante;
- a aprovação exige nova cotação e só libera usuário, cliente e conteúdo exatos;
- a interface funciona por teclado e em resolução móvel, com mensagens em `aria-live`.

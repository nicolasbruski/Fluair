# Tela de Aprovações de preço

## Identificação

- Rota: `/aprovacoes/precos`
- Permissão: `order.price-approval.manage`
- Estado: fila, detalhe, aprovação, reprovação e badge implementados

## Fila e badge

Somente usuários autorizados veem a entrada **Aprovações**. O badge consulta periodicamente apenas
o total de solicitações `PENDING`, possui nome acessível e desaparece quando o total é zero. A tela
mostra carregamento, vazio, erro recuperável e sucesso sem expor a fila a usuários sem permissão.

A fila é paginada no servidor. Pendências aparecem das mais antigas para as mais novas; os demais
estados usam atualização recente. É possível filtrar por estado, período e código. Cada resumo
apresenta cliente, solicitante, espera, quantidade de exceções, total solicitado e impacto.

## Detalhe e decisão

O detalhe usa o snapshot persistido do carrinho completo: justificativa, cliente, origens, versões,
faixas, quantidade, mínimo, preço solicitado, diferenças e totais. Texto vindo da API é inserido
como texto, não como HTML.

Aprovar aceita uma observação opcional. Reprovar exige motivo. O backend resolve o revisor pela
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
- solicitante e revisor precisam ser pessoas diferentes;
- somente a primeira decisão concorrente altera o registro;
- aprovação e reprovação ficam visíveis ao solicitante;
- a aprovação exige nova cotação e só libera usuário, cliente e conteúdo exatos;
- a interface funciona por teclado e em resolução móvel, com mensagens em `aria-live`.

# Especificação — Aprovação de preço abaixo do mínimo no pedido

## 1. Status do documento

- Status: especificação funcional e técnica pronta para decomposição em tarefas.
- Data: 2026-09-30.
- Escopo: solicitação, notificação administrativa, decisão, liberação e consumo de aprovação para
  preços negociados abaixo do mínimo.
- Próxima etapa: criar `tasks.md` e tarefas de implementação a partir desta especificação.
- Documento relacionado: `spec-envio-pedidos-email/spec.md`.

Esta especificação resolve a decisão comercial que permanecia aberta na seção de preço negociado da
especificação de registro e envio de pedidos. Em caso de conflito, este documento prevalece somente
para o fluxo de preço abaixo do mínimo e sua aprovação.

## 2. Objetivo

Permitir que um usuário solicite uma exceção comercial ao informar, em uma linha do carrinho, um
preço unitário negociado abaixo do mínimo aplicável, garantindo que:

1. o pedido não possa ser gerado enquanto a exceção não for aprovada;
2. administradores autorizados sejam notificados no menu do sistema;
3. um administrador possa consultar o contexto e aprovar ou reprovar a solicitação;
4. a decisão seja persistida e auditável;
5. a aprovação valha somente para o usuário, cliente, itens, quantidades, preços, listas, faixas e
   versões que foram efetivamente analisados;
6. o backend continue sendo a única fonte de verdade para preços, mínimos e autorização;
7. uma aprovação não possa ser reutilizada para outro carrinho ou mais de um pedido.

## 3. Contexto atual

- A tela `/pedidos/novo` mantém cliente, carrinho, preços negociados e observação no navegador.
- `POST /api/v1/orders/quote` recarrega e valida cliente, listas, versões, faixas, produtos, kits e
  preços no servidor.
- Produtos avulsos identificam a origem por `productCode` e `priceListVersionId`.
- Kits identificam a origem por `calculationId` e `priceReference`.
- O frontend permite editar o preço unitário da linha.
- O backend atualmente rejeita qualquer produto ou kit abaixo do mínimo com
  `ORDER_NEGOTIATED_PRICE_BELOW_MINIMUM`.
- Uma cotação válida recebe um `quoteToken` assinado e de curta duração.
- O pedido só é persistido na confirmação final e sua criação já é idempotente.
- Pedido, itens, primeira entrega de e-mail e auditoria são criados em transação.
- Existe a permissão `price.override`, mas o fluxo atual de pedidos não a aplica ao campo editável nem
  às rotas de cotação e criação.
- Não existe entidade de solicitação de aprovação, fila administrativa, badge no menu ou mecanismo
  geral de notificações em tempo real.

## 4. Decisões confirmadas

1. Preço igual ou superior ao mínimo continua no fluxo normal e não exige aprovação.
2. Preço abaixo do mínimo não deve gerar pedido sem decisão administrativa favorável.
3. O mínimo de um produto avulso é o valor da lista/faixa especificamente selecionada para aquela
   linha, e não o menor valor encontrado entre outras listas ou faixas compatíveis.
4. Uma faixa diferente, mesmo para o mesmo produto, é outra origem comercial e não participa da
   validação da linha selecionada.
5. Para usar outra faixa, o usuário deve selecioná-la explicitamente e a quantidade deve ser
   compatível com seus limites.
6. A solicitação será persistida antes da criação do pedido.
7. Administradores autorizados terão uma área de aprovações no menu, com contador de pendências.
8. O administrador poderá aprovar ou reprovar a solicitação completa.
9. Somente uma solicitação aprovada, válida e correspondente ao carrinho atual libera a geração do
   pedido.
10. A aprovação não é uma permissão genérica para vender abaixo do mínimo; ela é vinculada ao
    conteúdo exato submetido.
11. Alterações relevantes no carrinho invalidam a liberação anterior.
12. O pedido definitivo e seu e-mail continuam sendo criados somente após a confirmação final.

## 5. Decisões técnicas adotadas para a primeira versão

1. A solicitação será enviada por ação explícita **Solicitar aprovação**, e não a cada tecla digitada
   no campo de preço.
2. O sistema destacará a exceção assim que ela for identificada, mas notificará os administradores
   somente depois da confirmação da solicitação pelo usuário.
3. A justificativa comercial do solicitante será obrigatória.
4. A reprovação exigirá um motivo; uma observação na aprovação será opcional.
5. A aprovação será do carrinho completo, sem aprovação parcial de linhas na primeira versão.
6. Um administrador não poderá decidir a própria solicitação. A decisão exige outro administrador
   autorizado.
7. A notificação inicial será implementada como fila canônica mais badge de pendências no menu, sem
   tabela genérica de notificações e sem estado individual de lida/não lida.
8. O contador será atualizado ao entrar no sistema, ao retornar o foco para a página, depois de uma
   decisão e por consulta periódica de aproximadamente 30 segundos.
9. WebSocket, Server-Sent Events e e-mail de aprovação ficam fora da primeira versão.
10. A aprovação terá prazo configurável. O valor inicial recomendado é de sete dias após a decisão,
    sem afastar as invalidações por mudança de conteúdo ou fonte comercial.
11. Depois da aprovação, o usuário deverá obter uma nova cotação. O `quoteToken` original não será
    conservado nem estendido durante a espera.
12. Os nomes físicos serão `order_price_approval_requests` e `order_price_approval_items`; as rotas
    ficarão sob `/api/v1/order-price-approvals`, com operações administrativas no segmento `/admin`.
13. A validade será configurada por `ORDER_PRICE_APPROVAL_VALIDITY_DAYS`, com padrão de sete dias e
    validação no início da aplicação.
14. A expiração será oportunista nas leituras e operações que consultam solicitações, por atualização
    condicional e idempotente; uma rotina periódica poderá ser adicionada sem mudar o contrato.
15. **Minhas solicitações** ficará inicialmente dentro da tela de pedidos, preservando o carrinho e o
    contexto comercial na mesma experiência.
16. A criação da solicitação recalculará integralmente o payload do carrinho no servidor. Não haverá
    token específico de cotação de exceção na primeira versão.

O prazo inicial e o intervalo de atualização podem ser ajustados por configuração durante a
implementação sem alterar as regras de segurança desta especificação.

## 6. Glossário

### 6.1 Preço negociado

Valor unitário informado pelo usuário para uma linha do carrinho. É separado dos preços de
referência e participa do subtotal e do total do pedido.

### 6.2 Preço mínimo aplicável

Valor mínimo calculado pelo backend para a origem comercial escolhida:

- produto avulso: `unitPrice` do `PriceListItem` pertencente ao `priceListVersionId` selecionado,
  cuja lista/faixa seja permitida para o cliente e compatível com a quantidade da linha;
- kit: `catalogMinimumPrice`, quando definido, ou `minimumTotal` da versão de cálculo selecionada.

Para produto avulso, preços existentes em outras listas ou faixas não reduzem o mínimo da linha
selecionada.

### 6.3 Linha em exceção

Linha em que `negotiatedUnitPrice < minimumUnitPrice`, usando comparação decimal no servidor.

### 6.4 Solicitação de aprovação

Registro persistente contendo o carrinho cotado, suas fontes, mínimos, preços solicitados,
justificativa, solicitante, cliente, hash de conteúdo e decisão administrativa.

### 6.5 Aprovação consumida

Aprovação que já foi utilizada na criação de um pedido. Não pode liberar outro pedido.

## 7. Estados e transições

### 7.1 Estados

- `PENDING`: aguardando decisão administrativa;
- `APPROVED`: aprovada, dentro da validade e ainda não utilizada;
- `REJECTED`: reprovada por um administrador;
- `CANCELLED`: cancelada pelo solicitante antes da decisão;
- `SUPERSEDED`: substituída por outra solicitação do mesmo fluxo após alteração relevante;
- `EXPIRED`: prazo de uso encerrado ou fontes comerciais incompatíveis com a aprovação;
- `CONSUMED`: usada com sucesso para criar exatamente um pedido.

### 7.2 Transições permitidas

```text
PENDING  -> APPROVED
PENDING  -> REJECTED
PENDING  -> CANCELLED
PENDING  -> SUPERSEDED
PENDING  -> EXPIRED
APPROVED -> CONSUMED
APPROVED -> SUPERSEDED
APPROVED -> EXPIRED
```

Estados terminais não voltam para `PENDING` ou `APPROVED`. Uma nova tentativa deve criar uma nova
solicitação, preservando o histórico anterior.

### 7.3 Concorrência de decisão

A decisão administrativa deve atualizar condicionalmente apenas uma solicitação ainda `PENDING`.
Se dois administradores decidirem ao mesmo tempo, apenas a primeira transição será efetivada. A
segunda requisição receberá conflito e o estado atual.

## 8. Escopo

### 8.1 Incluído

- detecção server-side de linhas abaixo do mínimo;
- apresentação estruturada das exceções na cotação;
- justificativa e criação idempotente da solicitação;
- snapshot completo do carrinho analisado;
- fila administrativa paginada;
- contador de pendências no menu;
- detalhe da solicitação;
- aprovação e reprovação integral;
- consulta do estado pelo solicitante;
- bloqueio da geração enquanto não houver aprovação válida;
- nova cotação depois da aprovação;
- validação do vínculo entre aprovação e carrinho;
- consumo transacional da aprovação junto com a criação do pedido;
- autorização, auditoria, observabilidade e testes do fluxo crítico.

### 8.2 Fora de escopo

- aprovação parcial de itens;
- níveis ou alçadas diferentes por percentual/valor;
- múltiplas etapas de aprovação;
- delegação ou atribuição manual a um administrador específico;
- comentários em formato de conversa;
- anexos na solicitação;
- notificação por e-mail, SMS, push ou aplicativo externo;
- atualização em tempo real por WebSocket ou Server-Sent Events;
- estado individual lida/não lida por administrador;
- aprovação permanente por cliente ou produto;
- alteração de pedido já criado;
- uso retroativo de aprovação em outro pedido.

## 9. Fluxo funcional do solicitante

### 9.1 Montagem e detecção

1. O usuário seleciona cliente, produto/kit, origem comercial e quantidade.
2. O usuário informa o preço negociado.
3. A interface pode sinalizar preliminarmente um valor abaixo da referência conhecida, mas essa
   sinalização não constitui validação nem solicitação.
4. Ao acionar a ação principal, o frontend envia o carrinho para cotação.
5. O backend resolve o mínimo aplicável de cada linha.
6. Se não houver exceção, o fluxo normal de revisão do pedido continua.
7. Se houver exceção, a cotação retorna `approval.required = true` e as violações estruturadas.
8. A revisão de pedido definitivo permanece bloqueada.

### 9.2 Solicitação

1. A interface mostra todas as linhas em exceção.
2. Para cada linha, mostra código, origem, faixa, quantidade, mínimo, valor solicitado, diferença em
   reais e diferença percentual.
3. O usuário informa uma justificativa comercial.
4. O usuário confirma **Solicitar aprovação**.
5. O frontend envia a solicitação com chave idempotente.
6. O backend recalcula novamente o carrinho, cria o snapshot e devolve o número/identificador da
   solicitação e o estado `PENDING`.
7. A interface passa a mostrar **Aguardando aprovação** e bloqueia **Gerar pedido**.

### 9.3 Enquanto aguarda

- O usuário pode consultar o estado da solicitação.
- O usuário pode cancelar uma solicitação ainda pendente.
- Se alterar cliente, item, origem, versão, faixa, quantidade ou preço, a liberação local é removida.
- O frontend deve tentar marcar a solicitação anterior como `SUPERSEDED` quando ela for substituída,
  mas a segurança não pode depender desse pedido do navegador.
- Solicitações abandonadas permanecem seguras porque o hash não corresponderá a outro carrinho e
  porque expiram.

### 9.4 Aprovação

1. Ao receber `APPROVED`, a tela informa quem aprovou, quando e a validade.
2. O botão **Gerar pedido** é liberado visualmente para aquele carrinho.
3. O frontend solicita uma nova cotação; não reutiliza o token anterior.
4. A nova cotação revalida fontes, mínimos, cliente, quantidades e conteúdo aprovado.
5. A revisão final identifica que há uma aprovação vinculada.
6. **Confirmar e enviar pedido** envia também `approvalRequestId`.
7. O backend cria o pedido e consome a aprovação na mesma transação.

### 9.5 Reprovação ou expiração

- `REJECTED`: mostrar o motivo e manter a geração bloqueada;
- `EXPIRED`: informar que é necessário cotar e solicitar novamente;
- `CANCELLED` ou `SUPERSEDED`: não permitir reutilização;
- o usuário pode ajustar o carrinho e criar uma nova solicitação.

## 10. Fluxo funcional administrativo

### 10.1 Notificação no menu

Usuários com permissão de decisão verão o item **Aprovações** no menu. O item deve conter um badge
com a quantidade atual de solicitações `PENDING`.

O badge:

- fica oculto ou apresenta zero quando não houver pendências;
- não aparece para usuários sem a permissão;
- possui rótulo acessível, por exemplo, “3 aprovações de preço pendentes”;
- é atualizado ao carregar a sessão, ao recuperar visibilidade, periodicamente e após decisões.

### 10.2 Fila

A tela administrativa deve permitir filtros por:

- estado;
- solicitante;
- cliente;
- período;
- código de produto ou kit, quando viável na primeira entrega.

A listagem deve mostrar pelo menos:

- identificador curto;
- solicitante;
- cliente;
- data e tempo em espera;
- quantidade de linhas em exceção;
- total solicitado;
- impacto total abaixo do mínimo;
- estado.

Pendências devem aparecer inicialmente da mais antiga para a mais nova, tornando visível o tempo de
espera. Outros estados podem usar ordem decrescente de atualização.

### 10.3 Detalhe e decisão

O detalhe deve apresentar:

- solicitante e e-mail;
- cliente e classificações relevantes;
- justificativa;
- todos os itens do carrinho, destacando as exceções;
- lista, faixa e versões de cada item;
- quantidades;
- preço mínimo aplicável;
- preço solicitado;
- diferença monetária e percentual;
- subtotais mínimo e solicitado;
- impacto total;
- datas e validade;
- histórico da decisão, quando existente.

O administrador pode:

- **Aprovar solicitação**, com observação opcional;
- **Reprovar solicitação**, com motivo obrigatório.

Depois da decisão, os controles ficam inativos e a tela mostra o estado persistido. A interface não
deve assumir sucesso antes da resposta do servidor.

## 11. Regra de preço mínimo

### 11.1 Produto avulso

Para cada linha de produto avulso, o backend deve:

1. receber `productCode`, `priceListVersionId`, quantidade e preço negociado;
2. localizar o item nessa versão exata;
3. localizar a lista dona da versão;
4. confirmar que a lista está ativa, é de produto avulso e é permitida para o segmento do cliente;
5. confirmar que a quantidade da linha pertence à faixa da lista;
6. usar o `unitPrice` daquele item como `minimumUnitPrice`;
7. comparar o preço negociado com esse mínimo.

Exemplo:

```text
Produto: P-001
Lista/faixa selecionada: Atacado 50–99
Quantidade: 60
Mínimo aplicável: R$ 100,00
Preço solicitado: R$ 92,00
Diferença: R$ 8,00 / 8%
```

Mesmo que outra lista ou faixa ofereça o produto por R$ 85,00, esse valor não autoriza R$ 92,00 na
linha selecionada. O usuário deve selecionar formalmente a outra origem e atender sua faixa.

### 11.2 Kit

Para cada linha de kit, o backend deve:

1. receber `calculationId`, `priceReference`, quantidade e preço negociado;
2. recarregar a versão de cálculo atual e visível;
3. confirmar compatibilidade com cliente e classe;
4. usar `catalogMinimumPrice` ou, na ausência, `minimumTotal` como `minimumUnitPrice`;
5. comparar o preço negociado com esse mínimo.

### 11.3 Precisão

- Comparações e totais devem usar `Prisma.Decimal` ou aritmética decimal equivalente.
- Não converter valores monetários para `number` no backend.
- Valores devem respeitar até quatro casas decimais nos contratos persistentes atuais.
- Percentuais apresentados podem ser arredondados para exibição, sem participar da autorização.

### 11.4 Apresentação no carrinho

O rótulo genérico de mínimo para produto avulso deve ser ajustado para deixar clara a origem:

- **Mínimo da faixa selecionada**;
- nome da lista;
- faixa, como `50–99` ou `100+`;
- versão usada.

Outras listas podem continuar visíveis para comparação, mas não devem ser apresentadas como o
mínimo autorizador da linha selecionada.

## 12. Vinculação da aprovação ao conteúdo

### 12.1 Conteúdo protegido

O hash da solicitação deve cobrir, em representação canônica e determinística:

- versão do formato do hash;
- identificador do solicitante;
- identificador do cliente;
- para cada linha, em ordem estável:
  - tipo;
  - código;
  - identificadores das fontes;
  - `priceListVersionId`;
  - versão da lista;
  - faixa mínima e máxima da lista, quando houver;
  - versão de cálculo, quando houver;
  - `priceReference`, quando houver;
  - quantidade;
  - preço mínimo;
  - preço de referência;
  - preço negociado;
  - subtotal;
- total da cotação.

A observação do pedido não precisa fazer parte da autorização de preço, mas a justificativa da
solicitação é persistida separadamente e não pode ser alterada depois do envio.

### 12.2 Mudanças que invalidam

Exigem nova solicitação:

- troca de cliente;
- adição ou remoção de item;
- troca de produto, kit, cálculo, lista, faixa ou versão;
- alteração de quantidade;
- alteração de preço negociado;
- alteração do mínimo aplicável;
- mudança de classificação que retire a compatibilidade;
- desativação ou substituição de fonte necessária.

Mudanças somente na observação final do pedido não invalidam a aprovação de preço.

### 12.3 Ordenação

O hash não deve depender acidentalmente da ordem visual se o mesmo conjunto de linhas puder ser
reordenado sem mudar o negócio. A implementação deve definir uma chave canônica por linha e impedir
duplicidades de origem como já ocorre na cotação.

## 13. Modelo de dados conceitual

Os nomes finais podem seguir as convenções Prisma existentes, desde que preservem as regras.

### 13.1 Enum `OrderPriceApprovalStatus`

- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `SUPERSEDED`
- `EXPIRED`
- `CONSUMED`

### 13.2 `OrderPriceApprovalRequest`

- `id` UUID;
- `status`;
- `requestedByUserId`;
- snapshots de nome e e-mail do solicitante;
- `customerId`;
- snapshots de código, razão social e classificações do cliente;
- `justification`;
- `contentHash`;
- `hashVersion`;
- `totalQuantity`;
- `minimumTotalAmount`;
- `requestedTotalAmount`;
- `exceptionAmount`;
- `idempotencyKey`, única no escopo do solicitante;
- `requestedAt`;
- `reviewedByUserId` opcional;
- snapshots do revisor;
- `reviewNote` opcional;
- `reviewedAt` opcional;
- `approvedUntil` opcional;
- `consumedOrderId` opcional e único;
- `consumedAt` opcional;
- `version` para concorrência otimista;
- `createdAt`, `updatedAt`.

Índices mínimos:

- estado e data da solicitação;
- solicitante, estado e data;
- cliente e data;
- revisor e data;
- hash de conteúdo;
- pedido consumido.

### 13.3 `OrderPriceApprovalItem`

O snapshot deve conter todas as linhas do carrinho, incluindo as que não exigem exceção, para que o
administrador compreenda o pedido completo e para que o hash possa ser reproduzido.

Campos sugeridos:

- `id`, `approvalRequestId`, `lineNumber`;
- `kind`;
- `requiresApproval`;
- identificadores de produto, kit, cálculo, lista e versão aplicáveis;
- snapshots de código, descrição, referência, lista e versões;
- snapshots dos limites da faixa;
- `priceReference`;
- `quantity`;
- `referenceUnitPrice`;
- `minimumUnitPrice`;
- `negotiatedUnitPrice`;
- `minimumSubtotal`;
- `negotiatedSubtotal`;
- `exceptionUnitAmount`;
- `exceptionTotalAmount`;
- impostos informativos aplicáveis;
- `createdAt`.

Restrições e índices:

- chave única por solicitação e número da linha;
- quantidades positivas;
- valores monetários não negativos;
- pelo menos uma linha da solicitação deve possuir `requiresApproval = true`, validado no serviço;
- índices das principais fontes para rastreabilidade.

### 13.4 Relação com `Order`

O pedido deve possuir relação opcional com a solicitação consumida, ou a solicitação deve possuir
`consumedOrderId` único. A constraint deve impedir que uma aprovação seja ligada a dois pedidos.

Pedidos sem exceção continuam sem aprovação relacionada.

### 13.5 Migração

A migration deve ser aditiva:

- não alterar preços ou pedidos históricos;
- não recriar pedidos existentes;
- criar enums, tabelas, chaves estrangeiras, constraints e índices;
- usar `ON DELETE RESTRICT` para entidades comerciais e usuários necessários à auditoria;
- seguir nomes físicos em `snake_case` e precisão decimal já adotada pelo projeto.

## 14. Permissões e autorização

### 14.1 Solicitante

- `order.access`: acessar e montar pedidos;
- `price.view`: visualizar e cotar preços;
- `price.override`: informar preço diferente da referência e solicitar preço abaixo do mínimo.

Usuário sem `price.override` deve visualizar o preço como não editável ou ser impedido de enviar
valor divergente. A validação é obrigatória também no backend.

### 14.2 Administrador aprovador

Adicionar permissão específica:

- `order.price-approval.manage`: listar, consultar, aprovar e reprovar solicitações.

A permissão deve fazer parte do papel Administrador no seed. Usar uma permissão específica permite
futura criação de um papel de gerência comercial sem mudar o domínio.

### 14.3 Separação de responsabilidade

O backend deve rejeitar a decisão quando `reviewedByUserId === requestedByUserId`, mesmo que o
usuário tenha a permissão administrativa.

### 14.4 Privacidade da consulta

- O solicitante consulta somente solicitações próprias.
- O aprovador consulta solicitações administrativas conforme sua permissão.
- IDs conhecidos não podem permitir acesso cruzado sem autorização.
- Respostas não devem expor hashes internos de sessão, senhas ou dados técnicos desnecessários.

## 15. Contratos HTTP propostos

Os caminhos finais podem ser refinados nas tarefas, mantendo separação clara entre ações do
solicitante e ações administrativas.

### 15.1 Cotar carrinho

`POST /api/v1/orders/quote`

A entrada permanece compatível com o contrato atual. A resposta deve acrescentar:

```json
{
  "approval": {
    "required": true,
    "violations": [
      {
        "line": 1,
        "kind": "STANDALONE_PRODUCT",
        "code": "P-001",
        "priceListVersionId": "uuid",
        "priceListName": "Atacado 50–99",
        "minimumOrderQuantity": 50,
        "maximumOrderQuantity": 99,
        "quantity": 60,
        "minimumUnitPrice": "100.0000",
        "negotiatedUnitPrice": "92.0000",
        "unitDifference": "8.0000",
        "totalDifference": "480.0000",
        "differencePercentage": "8.00"
      }
    ]
  }
}
```

Quando `approval.required` for verdadeiro, a resposta pode conter os demais dados da cotação, mas
não deve emitir um token utilizável para criar pedido sem aprovação. Uma solução aceitável é emitir
token somente depois que a aprovação for validada em nova cotação.

### 15.2 Criar solicitação

`POST /api/v1/order-price-approvals`

Entrada conceitual:

- mesmo cliente e linhas usados na cotação;
- justificativa;
- chave idempotente em header ou campo dedicado;
- identificador/fingerprint opaco da cotação de exceção, caso adotado.

O backend deve recalcular tudo; mínimos, diferenças, totais e snapshots enviados pelo navegador
devem ser ignorados como fonte de verdade.

Resposta `201` na criação e `200` em replay idempotente:

- identificador;
- estado;
- data da solicitação;
- resumo das exceções;
- indicador `replayed`.

Se não houver mais preço abaixo do mínimo, responder erro de domínio e orientar o fluxo normal.

### 15.3 Listar solicitações próprias

`GET /api/v1/order-price-approvals/mine?status=&page=&pageSize=`

Retorna somente registros do usuário autenticado, com paginação e resumo da decisão.

### 15.4 Consultar solicitação própria

`GET /api/v1/order-price-approvals/:id`

Retorna snapshot, estado, decisão pública, validade e eventual pedido gerado.

### 15.5 Cancelar solicitação própria

`POST /api/v1/order-price-approvals/:id/cancel`

Somente `PENDING` pode ser cancelada pelo solicitante.

### 15.6 Contador administrativo

`GET /api/v1/order-price-approvals/admin/count`

Resposta:

```json
{ "data": { "pending": 3 } }
```

### 15.7 Fila administrativa

`GET /api/v1/order-price-approvals/admin?status=PENDING&page=1&pageSize=20`

Exige `order.price-approval.manage` e devolve paginação, resumo e tempo de espera.

### 15.8 Detalhe administrativo

`GET /api/v1/order-price-approvals/admin/:id`

Exige a permissão administrativa e devolve o snapshot completo.

### 15.9 Aprovar

`POST /api/v1/order-price-approvals/admin/:id/approve`

Entrada:

- observação opcional e limitada;
- versão esperada ou outro mecanismo de concorrência.

### 15.10 Reprovar

`POST /api/v1/order-price-approvals/admin/:id/reject`

Entrada:

- motivo obrigatório e limitado;
- versão esperada ou outro mecanismo de concorrência.

### 15.11 Criar pedido

`POST /api/v1/orders`

Acrescentar `approvalRequestId` opcional. Se a nova cotação detectar exceção:

- o campo passa a ser obrigatório;
- a solicitação deve estar `APPROVED`;
- o solicitante deve ser o usuário autenticado;
- o conteúdo deve corresponder integralmente;
- a validade não pode ter terminado;
- a solicitação não pode estar consumida.

Enviar `approvalRequestId` em um pedido sem exceção não deve conceder nenhum benefício e deve ser
rejeitado ou ignorado de forma explicitamente definida nas tarefas; recomenda-se rejeitar para
evitar vínculos acidentais.

## 16. Erros de domínio esperados

- `ORDER_PRICE_APPROVAL_REQUIRED`: o carrinho contém preço abaixo do mínimo e não possui aprovação;
- `ORDER_PRICE_APPROVAL_NOT_FOUND`: solicitação inexistente ou não visível ao ator;
- `ORDER_PRICE_APPROVAL_NOT_PENDING`: tentativa de decidir/cancelar estado incompatível;
- `ORDER_PRICE_APPROVAL_NOT_APPROVED`: tentativa de usar solicitação sem aprovação;
- `ORDER_PRICE_APPROVAL_SELF_REVIEW`: tentativa de decidir a própria solicitação;
- `ORDER_PRICE_APPROVAL_CONTENT_MISMATCH`: carrinho não corresponde ao conteúdo aprovado;
- `ORDER_PRICE_APPROVAL_EXPIRED`: validade encerrada ou fontes incompatíveis;
- `ORDER_PRICE_APPROVAL_ALREADY_CONSUMED`: aprovação já usada;
- `ORDER_PRICE_APPROVAL_IDEMPOTENCY_CONFLICT`: chave reutilizada com conteúdo diferente;
- `ORDER_PRICE_APPROVAL_CONCURRENT_DECISION`: outro administrador já decidiu;
- `ORDER_PRICE_OVERRIDE_FORBIDDEN`: usuário sem permissão tentou negociar valor diferente;
- `ORDER_PRICE_APPROVAL_NOT_REQUIRED`: solicitação enviada sem nenhuma linha abaixo do mínimo.

Mensagens públicas devem orientar a ação possível sem revelar detalhes internos.

## 17. Alterações no serviço de cotação e pedido

### 17.1 Cotação

A cotação deve separar:

- erros que tornam a linha inválida, como fonte inexistente, lista incompatível ou quantidade fora da
  faixa;
- exceção comercial aprovável, limitada a preço negociado abaixo do mínimo.

Somente a segunda categoria deve produzir `approval.required`.

### 17.2 Criação da solicitação

O serviço deve reutilizar a mesma resolução de preços da cotação. Não devem existir duas
implementações divergentes da regra de mínimo.

### 17.3 Nova cotação depois da aprovação

A cotação deve aceitar o contexto da solicitação aprovada ou permitir que a criação valide a
aprovação separadamente. Em ambos os desenhos:

- o token continua ligado ao ator e ao fingerprint atual;
- o token permanece de curta duração;
- a aprovação persistida não substitui a revalidação;
- fontes desativadas ou incompatíveis continuam bloqueando o pedido.

### 17.4 Criação transacional

Na confirmação final, uma única transação deve:

1. reservar/validar a aprovação ainda `APPROVED`;
2. gerar o número do pedido;
3. criar pedido e itens;
4. criar a primeira entrega de e-mail;
5. marcar a aprovação como `CONSUMED` e vinculá-la ao pedido;
6. criar auditorias correspondentes.

Se qualquer etapa falhar, nenhuma delas deve permanecer confirmada.

### 17.5 Idempotência

A idempotência existente do pedido deve ser preservada. Em replay do mesmo pedido:

- retornar o pedido existente;
- não tentar consumir novamente a aprovação;
- confirmar que o conteúdo é o mesmo.

Uma mesma aprovação não pode ser associada a chaves idempotentes diferentes que resultem em dois
pedidos.

## 18. Interface do solicitante

### 18.1 Linha do carrinho

Quando o preço estiver abaixo do mínimo conhecido, mostrar:

- destaque visual não dependente apenas de cor;
- texto **Abaixo do mínimo da faixa selecionada**;
- preço mínimo e preço informado;
- diferença monetária e percentual;
- lista, faixa e versão selecionadas.

A indicação local deve informar que a confirmação depende da validação do servidor.

### 18.2 Ação principal

- sem exceção: **Gerar pedido**;
- exceção ainda não solicitada: **Solicitar aprovação**;
- pendente: botão bloqueado e texto **Aguardando aprovação**;
- aprovada e correspondente ao carrinho: **Gerar pedido**;
- reprovada: geração bloqueada e ação para ajustar/solicitar novamente;
- expirada ou divergente: geração bloqueada e nova solicitação necessária.

### 18.3 Modal de solicitação

Deve conter:

- cliente;
- itens em exceção;
- contexto de lista/faixa;
- mínimos e valores solicitados;
- impacto total;
- campo obrigatório de justificativa;
- ações **Cancelar** e **Enviar para aprovação**;
- prevenção de duplo envio;
- estados acessíveis de carregamento, sucesso e erro.

### 18.4 Retomada

A primeira versão deve permitir recuperar solicitações próprias por API e apresentar ao menos o
estado da solicitação associada ao carrinho atual. Uma seção **Minhas solicitações** pode ser criada
na tela de pedidos ou como rota própria, conforme a decomposição de interface no `tasks.md`.

Não se deve depender apenas da memória da página, pois o usuário pode recarregar, sair ou aguardar a
decisão em outro momento.

## 19. Interface administrativa

Adicionar:

- rota protegida, recomendada `/aprovacoes/precos`;
- item **Aprovações** na navegação;
- badge de pendências;
- tela de lista, filtros e paginação;
- detalhe completo;
- confirmação antes da decisão;
- motivo obrigatório na reprovação;
- feedback de conflito quando outro administrador decidir primeiro;
- atualização do contador após cada ação.

A tela deve funcionar em resoluções móveis existentes, manter navegação por teclado, foco previsível,
`aria-live` para mudanças de estado e nomes acessíveis para o badge e botões.

## 20. Auditoria

Registrar pelo menos:

- `ORDER_PRICE_APPROVAL_REQUESTED`;
- `ORDER_PRICE_APPROVAL_APPROVED`;
- `ORDER_PRICE_APPROVAL_REJECTED`;
- `ORDER_PRICE_APPROVAL_CANCELLED`;
- `ORDER_PRICE_APPROVAL_SUPERSEDED`;
- `ORDER_PRICE_APPROVAL_EXPIRED`;
- `ORDER_PRICE_APPROVAL_CONSUMED`.

Metadados mínimos:

- solicitante;
- revisor, quando houver;
- cliente;
- estado anterior e novo;
- hash e versão do hash;
- quantidade de linhas e de exceções;
- impacto monetário;
- motivo/observação sanitizados;
- pedido vinculado, quando consumida;
- `requestId` da operação.

O audit log complementa, mas não substitui, o snapshot comercial persistido.

## 21. Observabilidade e operação

- Logs estruturados devem usar IDs de solicitação, pedido e `requestId`.
- Não registrar o carrinho completo ou justificativas em logs comuns quando IDs e métricas forem
  suficientes.
- Métricas futuras podem medir pendências, tempo de decisão, taxa de aprovação e impacto aprovado.
- O contador do menu deve usar consulta indexada e retornar somente agregados necessários.
- A paginação administrativa não pode carregar todas as solicitações em memória.
- Uma rotina oportunista pode marcar aprovações vencidas ao consultá-las; se houver rotina periódica,
  ela deve ser idempotente.

## 22. Segurança

1. Nunca confiar em mínimo, diferença, total, usuário ou estado enviados pelo navegador.
2. Resolver o ator exclusivamente pela sessão autenticada.
3. Aplicar permissões no backend e usar o frontend apenas para apresentação.
4. Normalizar e limitar justificativa, motivo e observação.
5. Escapar conteúdo textual na interface e em qualquer comunicação futura.
6. Usar comparação decimal para preços.
7. Assinar tokens/fingerprints opacos quando enviados ao cliente.
8. Impedir enumeração de solicitações próprias de outros usuários.
9. Proteger endpoints mutáveis com as mesmas políticas de origem/CSRF já usadas pelo sistema.
10. Aplicar idempotência à criação da solicitação e à criação do pedido.
11. Consumir aprovação com atualização condicional e constraint única.
12. Não permitir autoaprovação.

## 23. Compatibilidade com e-mail e pedido

- Nenhum `Order` ou `OrderEmailDelivery` é criado em `PENDING`, `APPROVED` ou `REJECTED` da
  solicitação.
- O número do pedido só é consumido na confirmação final.
- O worker de e-mail existente não será usado para avisar administradores sobre aprovações.
- Depois da criação, o e-mail do pedido usa normalmente o preço negociado aprovado e o snapshot do
  pedido.
- O pedido deve manter referência opcional à aprovação para auditoria.
- Falha posterior no e-mail não desfaz o pedido nem reabre a aprovação.

## 24. Estratégia de testes

### 24.1 Testes unitários

- comparação decimal igual, acima e abaixo do mínimo;
- produto usa mínimo da versão/lista/faixa selecionada;
- outra faixa mais barata não reduz o mínimo da linha;
- kit usa `catalogMinimumPrice` com fallback para `minimumTotal`;
- cálculo de diferença unitária, total e percentual;
- serialização canônica e hash estável;
- mudança de campo protegido altera o hash;
- reordenação semanticamente irrelevante mantém o hash, se adotada;
- estados e transições permitidas;
- autoaprovação bloqueada;
- expiração;
- schemas de justificativa e decisão.

### 24.2 Testes de migration e repositório

- migration contém tabelas, enums, índices, constraints e chaves estrangeiras;
- dados existentes permanecem intactos;
- criação transacional do snapshot;
- idempotência da solicitação;
- conflito de chave com conteúdo diferente;
- duas decisões concorrentes resultam em uma decisão;
- consumo único;
- rollback do pedido também preserva a aprovação como não consumida;
- replay idempotente do pedido não cria segundo consumo.

### 24.3 Testes de serviço

- cotação sem exceção segue o fluxo normal;
- cotação com produto abaixo retorna violação estruturada;
- cotação com kit abaixo retorna violação estruturada;
- item inválido continua sendo erro, não solicitação aprovável;
- criação de solicitação exige pelo menos uma exceção;
- backend ignora mínimos e totais forjados pelo navegador;
- aprovação válida libera exatamente o mesmo conteúdo;
- cliente, quantidade, preço, origem ou versão divergente bloqueiam;
- fonte desativada após aprovação bloqueia;
- aprovação rejeitada, cancelada, expirada, substituída ou consumida bloqueia;
- usuário diferente bloqueia;
- alteração somente da observação do pedido não invalida;
- usuário sem `price.override` não solicita exceção;
- usuário sem permissão administrativa não lista nem decide.

### 24.4 Testes de integração HTTP

- autenticação e permissões de todos os endpoints;
- validação Zod e limites dos textos;
- códigos HTTP `200`, `201`, `400`, `403`, `404`, `409` e `422` conforme o domínio;
- consultas próprias não vazam registros;
- contador retorna somente pendências;
- filtros e paginação;
- decisão inclui ator autenticado e `requestId`;
- `POST /orders` exige aprovação quando necessário;
- pedido e aprovação são vinculados na mesma transação.

### 24.5 Testes E2E

- preço normal abre a revisão sem aprovação;
- preço abaixo destaca a linha e muda a ação principal;
- justificativa obrigatória;
- envio cria estado pendente sem criar pedido;
- badge aparece para administrador e não para usuário comum;
- administrador abre detalhes e aprova;
- administrador reprova com motivo;
- solicitante visualiza aprovação ou reprovação;
- aprovação libera nova cotação e geração;
- reprovação mantém geração bloqueada;
- alterar quantidade ou preço depois da aprovação invalida a liberação;
- trocar de faixa invalida a aprovação anterior;
- outra faixa mais barata não autoriza a selecionada;
- dois administradores recebem feedback correto em decisão concorrente;
- aprovação é consumida e não pode gerar segundo pedido;
- fluxo final continua criando entrega de e-mail somente depois do pedido.

## 25. Critérios de aceite

1. Um carrinho sem preço abaixo do mínimo continua funcionando sem etapa adicional.
2. O mínimo de produto avulso é sempre o valor da lista/faixa selecionada e validada no servidor.
3. Preço de outra lista/faixa não autoriza desconto na linha selecionada.
4. Preço abaixo do mínimo não cria pedido nem agenda e-mail antes de aprovação.
5. O usuário envia uma solicitação com justificativa e recebe estado rastreável.
6. A solicitação aparece na fila e no contador de administradores autorizados.
7. Usuários sem permissão não veem nem operam a fila administrativa.
8. Um administrador não consegue decidir a própria solicitação.
9. A primeira decisão concorrente prevalece e a segunda não sobrescreve o resultado.
10. Uma reprovação mantém o pedido bloqueado e apresenta o motivo ao solicitante.
11. Uma aprovação libera somente o mesmo usuário, cliente e conteúdo aprovado.
12. Alterar item, quantidade, preço, lista, faixa, versão ou mínimo exige nova aprovação.
13. A nova cotação é obrigatória após a aprovação; token antigo não é reutilizado.
14. O backend revalida as fontes atuais antes da criação do pedido.
15. Pedido e consumo da aprovação ocorrem atomicamente.
16. Uma aprovação gera no máximo um pedido.
17. Repetir a confirmação idempotente retorna o mesmo pedido, sem novo consumo ou e-mail.
18. Todas as ações relevantes ficam auditadas com ator, data e entidade.
19. O badge e as telas possuem estados acessíveis de carregamento, vazio, erro e sucesso.
20. Testes unitários, de migration/repositório, integração e E2E cobrem o fluxo crítico.

## 26. Áreas prováveis de alteração

### Banco e domínio compartilhado

- `prisma/schema.prisma`;
- nova migration em `prisma/migrations/`;
- `prisma/seed.ts`;
- `src/shared/auth.ts`;
- `src/shared/orders.ts` ou novo contrato compartilhado de aprovações.

### Backend

- `src/server/modules/orders/orders.schemas.ts`;
- `src/server/modules/orders/orders.service.ts`;
- `src/server/modules/orders/orders.repository.ts`;
- `src/server/modules/orders/orders.routes.ts`;
- novo módulo `src/server/modules/order-price-approvals/`, recomendado para schemas, serviço,
  repositório e rotas da fila;
- `src/server/app.ts` e `src/server/server.ts` para composição do novo serviço, se separado.

### Frontend

- `src/web/services/orders-api.ts` ou serviço específico de aprovações;
- `src/web/orders-page.ts`;
- nova página administrativa de aprovações;
- `src/web/main.ts`;
- `src/web/prototype-transform.ts`;
- documentação da tela de pedidos e da nova tela administrativa.

### Testes

- testes unitários de cotação, hash, estados e repositório;
- testes de migration;
- testes de integração das rotas de pedidos e aprovações;
- testes E2E do solicitante, badge e decisão administrativa.

## 27. Direção para o futuro `tasks.md`

O plano deve ser dividido em recortes implementáveis e verificáveis, preferencialmente nesta ordem:

1. contratos de domínio, permissão e definição canônica do hash;
2. migration, modelos e testes estruturais;
3. repositório e máquina de estados da aprovação;
4. refatoração da resolução de preço mínimo para uso compartilhado;
5. resposta estruturada de exceções na cotação;
6. criação e consulta de solicitações próprias;
7. fila, contador e decisão administrativa;
8. validação da aprovação na nova cotação e criação do pedido;
9. consumo transacional e idempotência;
10. interface do solicitante;
11. menu, badge e interface administrativa;
12. auditoria, observabilidade e expiração;
13. testes E2E, documentação e quality gate.

Cada tarefa deverá indicar:

- objetivo e comportamento observável;
- dependências;
- arquivos prováveis;
- migrations ou contratos afetados;
- testes obrigatórios;
- critérios objetivos de conclusão;
- comandos de verificação.

## 28. Pendências não bloqueadoras para decomposição

As seguintes escolhas podem ser fechadas durante a geração das tarefas sem alterar o fluxo:

- nome final das tabelas e rotas;
- se o prazo inicial de sete dias será constante ou configuração de ambiente;
- localização exata de **Minhas solicitações**;
- formato visual final do badge;
- estratégia interna para expiração oportunista ou periódica;
- se o token de cotação de exceção será específico ou se a criação recalculará somente pelo payload.

Não há pendência sobre a regra de mínimo: para produto avulso, ela é o valor da lista/faixa
especificamente selecionada e validada para a linha.

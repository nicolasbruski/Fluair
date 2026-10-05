# Tasks — Aprovação de preço abaixo do mínimo no pedido

## 1. Objetivo

Implementar `spec-aprovacao-preco-pedido/spec.md` em sete entregas coesas e verificáveis, sem
fragmentar o trabalho em dezenas de microtarefas.

O fluxo final deve:

1. calcular o mínimo de produto pela lista/faixa especificamente selecionada;
2. identificar preços negociados abaixo desse mínimo no backend;
3. permitir ao usuário solicitar uma exceção com justificativa;
4. notificar administradores autorizados por fila e badge no menu;
5. permitir aprovação ou reprovação auditável e concorrente;
6. liberar somente o carrinho exato que foi aprovado;
7. criar um único pedido e consumir a aprovação na mesma transação.

Este arquivo concentra todo o planejamento. Não devem ser criados arquivos separados por endpoint,
tabela, componente ou caso de teste. Novas tarefas só devem ser adicionadas se surgir uma entrega
realmente independente e a justificativa for registrada aqui.

## 2. Convenções

- `[ ]`: não iniciada;
- `[~]`: em andamento;
- `[x]`: concluída e verificada;
- `[!]`: bloqueada por decisão ou dependência externa;
- referências de seção apontam para o `spec.md` desta pasta;
- cada tarefa deve entregar um recorte revisável e integrado;
- correções descobertas que pertençam ao escopo devem permanecer na tarefa responsável;
- ao concluir uma tarefa, registrar resultado, comandos executados, testes e eventuais desvios em
  uma subseção **Resultado e evidências** dentro da própria tarefa.

## 3. Decisões obrigatórias durante a execução

As decisões funcionais principais já estão fechadas na especificação. A implementação não pode
reinterpretá-las:

- para produto avulso, o mínimo é o `unitPrice` da versão/lista/faixa selecionada;
- outra lista ou faixa mais barata não autoriza a linha atual;
- a solicitação nasce somente após ação explícita **Solicitar aprovação**;
- a aprovação cobre o carrinho completo e não permite aprovação parcial na primeira versão;
- justificativa é obrigatória, reprovação exige motivo e aprovação aceita observação opcional;
- autoaprovação é proibida;
- a aprovação vale para um único pedido e para o conteúdo exato aprovado;
- uma nova cotação é obrigatória depois da aprovação;
- nenhuma solicitação cria pedido, número de pedido ou entrega de e-mail antecipadamente;
- a primeira versão usa fila e badge com polling, sem WebSocket, SSE ou e-mail de aprovação.

Antes de implementar o trecho correspondente, fechar e registrar no `spec.md` somente estas escolhas
técnicas não bloqueadoras:

1. nomes físicos finais das tabelas e rotas;
2. forma de configuração do prazo inicial recomendado de sete dias;
3. forma interna de expiração oportunista ou periódica;
4. localização final de **Minhas solicitações**;
5. uso de token específico de cotação de exceção ou recálculo integral na criação da solicitação.

## 4. Definição global de pronto

Uma tarefa só pode ser marcada como `[x]` quando:

1. todo o trabalho listado no recorte estiver implementado ou explicitamente justificado como não
   aplicável;
2. autenticação, autorização, validação, idempotência, concorrência e auditoria aplicáveis estiverem
   cobertas no backend;
3. nenhum preço, mínimo, total, usuário ou estado recebido do navegador for tratado como fonte de
   verdade;
4. cálculos monetários no backend usarem aritmética decimal;
5. migrations forem aditivas e preservarem pedidos, cálculos, listas e usuários existentes;
6. erros de domínio forem estáveis, acionáveis e não vazarem dados de outros usuários;
7. testes previstos da tarefa passarem e regressões relacionadas forem corrigidas;
8. formatação, lint e typecheck dos arquivos afetados passarem;
9. contratos compartilhados, documentação e comportamento não se contradisserem;
10. o resultado e as evidências forem registrados nesta lista.

## 5. Ordem e dependências

```text
TASK-001 Fundação de domínio, dados e segurança
    ↓
TASK-002 Cotação de exceção e ciclo do solicitante no backend
    ├── TASK-003 Fila, decisão e expiração administrativa no backend
    │       ↓
    │   TASK-004 Liberação e consumo transacional no pedido
    │       ├── TASK-005 Experiência do solicitante no frontend
    │       └── TASK-006 Menu, badge e tela administrativa
    │                    ↓
    └──────────────── TASK-007 Integração, documentação e quality gate
```

- `TASK-003` depende dos registros e contratos estabilizados na `TASK-002`.
- `TASK-004` depende das decisões persistentes da `TASK-003`.
- `TASK-005` pode iniciar parcialmente após a `TASK-002`, mas só pode ser concluída após a
  `TASK-004`.
- `TASK-006` pode iniciar após a `TASK-003` e deve respeitar os contratos administrativos já
  estabilizados.
- `TASK-007` depende de todas as tarefas anteriores.

## 6. Tarefas

### [x] TASK-001 — Construir a fundação de domínio, persistência e autorização

- Dependências: nenhuma.
- Seções principais: 5 a 7, 12 a 14, 20 e 22.
- Entrega: modelos, migration, contratos, permissões, hash canônico e repositório básico capazes de
  persistir uma solicitação completa e segura, ainda sem interface.

#### Trabalho incluído

1. Definir os nomes finais e criar no Prisma:
   - enum de estados `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `SUPERSEDED`, `EXPIRED` e
     `CONSUMED`;
   - entidade de solicitação com solicitante, cliente, snapshots, justificativa, totais, impacto,
     hash/versionamento, idempotência, decisão, validade, consumo e timestamps;
   - entidade de itens contendo todas as linhas do carrinho e o marcador `requiresApproval`;
   - relação opcional e única com o pedido consumido;
   - relações separadas de solicitante e revisor com `User`;
   - índices de fila, solicitante, cliente, revisor, conteúdo e consumo.
2. Criar migration aditiva com:
   - FKs restritivas para preservar histórico;
   - unicidade por solicitante/chave idempotente;
   - unicidade do vínculo com pedido;
   - constraints de quantidade, linha e valores não negativos viáveis no MySQL;
   - precisão decimal compatível com pedidos existentes.
3. Adicionar `order.price-approval.manage` aos contratos de autenticação, seed e papel
   Administrador, preservando overrides individuais existentes.
4. Formalizar o uso de `price.override`:
   - preço editável/negociado diferente da referência exige a permissão;
   - solicitações abaixo do mínimo exigem a permissão;
   - a regra será aplicada pelo backend nas tarefas seguintes.
5. Criar contratos compartilhados sem expor tipos Prisma:
   - status e snapshots;
   - resumo e detalhe do solicitante;
   - resumo e detalhe administrativo;
   - violações de preço;
   - entradas de criação, decisão e cancelamento;
   - paginação e contador.
6. Implementar uma representação canônica versionada e testável para o conteúdo protegido:
   - incluir ator, cliente, origens, versões, faixas, quantidade, mínimos, preços e totais;
   - excluir a observação final do pedido;
   - impedir duplicidade de linha;
   - definir ordenação estável sem depender acidentalmente da ordem visual.
7. Criar repositório com operações mínimas e condicionais:
   - criar solicitação e itens atomicamente;
   - recuperar por idempotência;
   - consultar por ID respeitando o escopo do chamador no serviço;
   - preparar atualização por estado/versão;
   - usar relógio e IDs injetáveis quando necessários a testes determinísticos.
8. Registrar auditoria `ORDER_PRICE_APPROVAL_REQUESTED` na mesma transação da criação, com metadados
   sanitizados e `requestId`.

#### Arquivos prováveis

- `prisma/schema.prisma`;
- nova migration em `prisma/migrations/`;
- `prisma/seed.ts`;
- `src/shared/auth.ts`;
- `src/shared/orders.ts` ou novo `src/shared/order-price-approvals.ts`;
- novo módulo `src/server/modules/order-price-approvals/`;
- helpers e testes unitários/de migration/repositório.

#### Testes e verificações

- Prisma valida o schema e gera o client;
- migration contém tabelas, enum, índices, constraints e FKs esperadas;
- migration não altera nem remove pedidos e dados atuais;
- snapshot misto de produto e kit preserva quatro casas decimais;
- pelo menos uma linha precisa ser de exceção no nível do serviço;
- mesma chave e mesmo conteúdo recuperam a solicitação;
- mesma chave com conteúdo diferente produz conflito;
- hash é estável para o mesmo conteúdo e muda nos campos protegidos;
- observação final do pedido não muda o hash;
- nova permissão existe e é concedida ao Administrador pelo seed;
- falha na auditoria desfaz a criação completa.

#### Concluída quando

O domínio consegue persistir e recuperar atomicamente uma solicitação completa, idempotente,
auditável e preparada para decisões concorrentes, sem depender de valores calculados no frontend.

#### Resultado e evidências

- Criados o enum, as tabelas físicas `order_price_approval_requests` e
  `order_price_approval_items`, relações restritivas, índices, constraints e vínculo único com
  pedido em migration exclusivamente aditiva.
- Adicionada `order.price-approval.manage` ao contrato e ao seed do papel Administrador, sem tocar
  nos overrides individuais; o uso obrigatório de `price.override` permanece formalizado para
  aplicação nas rotas da `TASK-002`.
- Criados contratos compartilhados, máquina de estados, hash SHA-256 canônico versão 1 com
  normalização decimal em quatro casas, ordenação semântica e rejeição de origens duplicadas.
- Criados serviço e repositório com validação de exceção, escopo de leitura própria, idempotência,
  conflito por conteúdo, atualização condicional por estado/versão, relógio/IDs injetáveis e
  auditoria transacional sanitizada.
- Verificações executadas: `npx prisma format`, `npx prisma validate`, `npm run db:generate`,
  `npm run typecheck`, ESLint dos arquivos afetados e `npm test`.
- Resultado final: schema Prisma válido, client gerado, typecheck e lint sem erros, e 55 arquivos de
  teste com 234 testes aprovados. Uma regressão nominal detectada pelo teste legado de `Product` foi
  corrigida mantendo a FK e o nome físico da tabela.

---

### [x] TASK-002 — Implementar cotação de exceção e ciclo do solicitante no backend

- Dependências: `TASK-001`.
- Seções principais: 6, 9, 11, 12, 14.1, 14.4, 15.1 a 15.5, 16 e 17.1 a 17.3.
- Entrega: uma única resolução server-side de preços identifica exceções, cria solicitações e permite
  ao usuário acompanhar ou cancelar somente os próprios registros.

#### Trabalho incluído

1. Refatorar a resolução de preço do pedido para uma função/regra reutilizável por cotação,
   solicitação e criação final, sem manter comparações divergentes.
2. Para produto avulso:
   - localizar exatamente `productCode` em `priceListVersionId`;
   - validar lista ativa, tipo, segmento do cliente e faixa da quantidade da linha;
   - usar o `unitPrice` daquela origem como mínimo;
   - nunca usar o menor preço de outra lista/faixa como autorizador.
3. Para kit:
   - validar cálculo atual, visibilidade, cliente/classe e versões;
   - usar `catalogMinimumPrice` com fallback para `minimumTotal`.
4. Separar indisponibilidade/entrada inválida de exceção aprovável:
   - fonte, cliente, lista, faixa ou quantidade inválidos continuam retornando erro;
   - somente `negotiatedUnitPrice < minimumUnitPrice` gera violação de aprovação.
5. Evoluir `POST /api/v1/orders/quote` para:
   - aplicar `price.override` quando houver preço negociado diferente;
   - devolver `approval.required` e violações estruturadas;
   - informar mínimo, solicitado, diferenças, origem e faixa;
   - manter o fluxo atual e o `quoteToken` normal quando não houver exceção;
   - impedir que uma cotação de exceção, sozinha, autorize a criação do pedido.
6. Implementar `POST /api/v1/order-price-approvals`:
   - autenticação, `order.access`, `price.view` e `price.override`;
   - justificativa obrigatória, normalizada e limitada;
   - chave idempotente e hash do conteúdo recalculado;
   - recálculo integral de mínimos, diferenças, subtotais e totais;
   - rejeição quando não existir mais nenhuma linha abaixo do mínimo;
   - criação do snapshot completo via repositório da `TASK-001`.
7. Implementar consultas do solicitante:
   - lista paginada `mine` com filtros limitados e ordem definida;
   - detalhe somente do próprio usuário;
   - estado, decisão pública, validade e pedido vinculado quando existir;
   - resposta `404` para ID inexistente ou pertencente a outro usuário.
8. Implementar cancelamento próprio:
   - somente o solicitante;
   - somente em `PENDING`;
   - transição condicional para evitar corrida com decisão;
   - auditoria `ORDER_PRICE_APPROVAL_CANCELLED`.
9. Implementar substituição segura:
   - nova solicitação para conteúdo alterado pode marcar a anterior como `SUPERSEDED` quando
     explicitamente relacionada;
   - segurança não depende de o navegador cancelar a anterior;
   - auditoria de substituição.
10. Definir erros de domínio estáveis e mapear status HTTP sem revelar registros de terceiros.

#### Arquivos prováveis

- `src/server/modules/orders/orders.service.ts`;
- `src/server/modules/orders/orders.schemas.ts`;
- `src/server/modules/orders/orders.routes.ts`;
- módulo novo de aprovações;
- contratos compartilhados;
- `src/server/app.ts` e `src/server/server.ts` se o módulo tiver serviço próprio;
- testes unitários e de integração HTTP.

#### Testes e verificações

- preço igual ou superior segue o fluxo atual sem aprovação;
- produto abaixo do mínimo retorna violação da faixa selecionada;
- outra faixa mais barata não muda o mínimo;
- limites e lista escolhida são revalidados;
- kit usa o fallback correto;
- fonte incompatível continua sendo erro e não exceção aprovável;
- usuário sem `price.override` não envia preço divergente nem cria solicitação;
- mínimos, diferenças e totais forjados pelo cliente são ignorados;
- criação sem exceção retorna `ORDER_PRICE_APPROVAL_NOT_REQUIRED`;
- justificativa inválida é rejeitada;
- replay idempotente não duplica itens nem auditoria;
- consultas próprias não vazam registros;
- cancelamento e substituição respeitam estados concorrentes.

#### Concluída quando

Um usuário autorizado consegue cotar, solicitar, listar, consultar e cancelar sua exceção, e todos
os valores comerciais são recalculados por uma única regra no backend.

#### Resultado e evidências

- A resolução autoritativa usada por Pedidos passou a classificar preço abaixo do mínimo como
  exceção aprovável, preservando como erro lista, versão, público, faixa, quantidade ou fonte
  incompatível. Produtos usam exclusivamente o `unitPrice` da versão/lista/faixa selecionada; kits
  usam `catalogMinimumPrice` com fallback para `minimumTotal`.
- `POST /api/v1/orders/quote` agora exige `price.override` para preço negociado divergente, devolve
  `approval.required` e violações estruturadas e omite o `quoteToken` utilizável quando houver
  exceção. A criação normal do pedido responde `ORDER_PRICE_APPROVAL_REQUIRED` nesse cenário.
- Foram implementados `POST /api/v1/order-price-approvals`,
  `GET /api/v1/order-price-approvals/mine`, `GET /api/v1/order-price-approvals/:id` e
  `POST /api/v1/order-price-approvals/:id/cancel`, com schemas estritos, paginação, escopo pelo
  usuário autenticado e `404` indistinguível para registros alheios.
- A criação recalcula preços, mínimos, diferenças e totais no servidor, gera o hash canônico e grava
  o snapshot completo com idempotência. A substituição explícita da solicitação anterior e a criação
  da nova solicitação ocorrem na mesma transação e registram auditoria; cancelamento usa estado e
  versão esperados e audita na mesma transação.
- Verificações executadas: `npm run typecheck`, ESLint dos arquivos afetados, testes focados de
  cotação, serviço, repositório e HTTP, e `npm test`. Resultado final: 58 arquivos de teste e 243
  testes aprovados, sem falhas.

---

### [x] TASK-003 — Implementar fila, decisão, concorrência e expiração administrativa

- Dependências: `TASK-002`.
- Seções principais: 7, 10, 14.2 a 14.4, 15.6 a 15.10, 16, 20 e 21.
- Entrega: APIs administrativas completas para contador, fila, detalhe, aprovação, reprovação e
  expiração, com separação de responsabilidade e auditoria.

#### Trabalho incluído

1. Implementar contador indexado de solicitações `PENDING`, retornando somente o agregado necessário
   ao menu.
2. Implementar fila paginada com:
   - filtros permitidos por estado, período, solicitante, cliente e código quando previsto;
   - validação de `page` e `pageSize`;
   - pendências mais antigas primeiro;
   - resumo de quantidade de exceções, total solicitado, impacto e tempo de espera;
   - demais estados ordenados por atualização recente.
3. Implementar detalhe administrativo completo com snapshot do carrinho, justificativa, fontes,
   faixas, versões, mínimos, solicitados, diferenças, totais, validade e decisão.
4. Proteger contador, fila, detalhe e decisões com `order.price-approval.manage` no backend.
5. Implementar aprovação:
   - somente `PENDING`;
   - impedir `revisor === solicitante`;
   - observação opcional, normalizada e limitada;
   - calcular `approvedUntil` conforme configuração decidida;
   - persistir snapshots do revisor;
   - auditoria `ORDER_PRICE_APPROVAL_APPROVED`.
6. Implementar reprovação:
   - somente `PENDING`;
   - impedir autoavaliação;
   - motivo obrigatório, normalizado e limitado;
   - auditoria `ORDER_PRICE_APPROVAL_REJECTED`.
7. Usar atualização condicional por estado e versão:
   - somente uma decisão vence;
   - segunda decisão recebe conflito e o estado atual;
   - decisão não sobrescreve cancelamento ou substituição concorrente.
8. Implementar expiração conforme decisão técnica:
   - marcar `PENDING` ou `APPROVED` vencida como `EXPIRED` quando aplicável;
   - operação idempotente e segura em múltiplas instâncias;
   - auditoria sem duplicação;
   - não criar pedido ou notificação externa.
9. Adicionar logs estruturados com IDs e métricas resumidas, sem registrar o carrinho inteiro ou
   textos comerciais desnecessariamente.

#### Arquivos prováveis

- repositório, serviço, schemas e rotas do módulo de aprovações;
- configuração de ambiente, caso o prazo seja configurável;
- `.env.example`;
- composição da aplicação;
- testes unitários, de repositório e integração.

#### Testes e verificações

- contador considera somente `PENDING` e usa permissão;
- paginação e filtros não vazam campos internos;
- usuário comum recebe `403` nas rotas administrativas;
- autoaprovação e autorreprovação são bloqueadas;
- reprovação sem motivo é rejeitada;
- duas aprovações/reprovações concorrentes produzem uma única decisão;
- cancelamento concorrente não é sobrescrito;
- validade é calculada com relógio injetável;
- expiração é idempotente e auditada uma única vez;
- histórico preserva solicitante, revisor, decisão e `requestId`.

#### Concluída quando

Administradores autorizados possuem uma API completa e concorrente para enxergar e decidir a fila,
sem autoaprovação, perda de histórico ou sobrescrita de outra decisão.

#### Resultado e evidências

- Implementados contador, fila paginada, filtros por estado, período, solicitante, cliente e código,
  detalhe completo e rotas separadas de aprovação e reprovação sob `/admin`, todas protegidas por
  `order.price-approval.manage`.
- Pendências são ordenadas da mais antiga para a mais nova, demais estados pela atualização mais
  recente, e o resumo administrativo informa `waitingSeconds`, contagens, total solicitado e impacto.
- Aprovação e reprovação usam versão esperada, atualização condicional e auditoria na mesma
  transação; autoavaliação é bloqueada e a operação perdedora recebe
  `ORDER_PRICE_APPROVAL_CONCURRENT_DECISION` com estado e versão atuais.
- A validade usa `ORDER_PRICE_APPROVAL_VALIDITY_DAYS`, com padrão de sete dias. Aprovações vencidas
  são expiradas oportunisticamente em lotes limitados, com índice `(status, approved_until)`,
  atualização condicional e auditoria idempotente.
- Logs estruturados registram `requestId`, ID da solicitação, revisor, estado e métricas resumidas,
  sem carrinho ou textos comerciais.
- Verificações executadas: `npx prisma format`, `npx prisma validate`, `npm run db:generate`,
  `npm run lint`, `npm run typecheck` e suíte Vitest completa. Resultado final: schema válido, client
  Prisma gerado, lint e typecheck sem erros, e 121 suítes/256 testes aprovados sem falhas.

---

### [x] TASK-004 — Integrar aprovação à cotação final e consumir no pedido atomicamente

- Dependências: `TASK-003`.
- Seções principais: 7, 9.4, 12, 13.4, 15.11, 16, 17.3 a 17.5 e 23.
- Entrega: somente uma aprovação válida e correspondente libera a criação; pedido, e-mail, auditoria
  e consumo são confirmados em uma única transação idempotente.

#### Trabalho incluído

1. Acrescentar `approvalRequestId` opcional ao contrato e schema de criação do pedido.
2. Depois de uma aprovação, exigir nova cotação e novo `quoteToken`:
   - não prolongar nem reutilizar o token anterior;
   - recalcular cliente, fontes, versões, faixas, mínimos, preços e totais;
   - associar o token atual ao ator e ao fingerprint atual.
3. Ao detectar linhas abaixo do mínimo na criação:
   - exigir a solicitação;
   - confirmar solicitante igual ao ator;
   - confirmar estado `APPROVED` e validade;
   - confirmar não consumo;
   - reproduzir e comparar o hash canônico;
   - rejeitar qualquer divergência de cliente, linha, quantidade, preço, origem, versão, faixa ou
     mínimo;
   - continuar bloqueando fonte desativada ou incompatível, mesmo que antes aprovada.
4. Rejeitar vínculo de aprovação em pedido que já não possui exceção, evitando consumo acidental.
5. Refatorar o repositório transacional existente para, quando houver aprovação:
   - reservar/atualizar condicionalmente `APPROVED`;
   - criar número, pedido, itens e primeira entrega de e-mail;
   - vincular o pedido à aprovação;
   - marcar `CONSUMED` e `consumedAt`;
   - registrar `ORDER_SUBMITTED` e `ORDER_PRICE_APPROVAL_CONSUMED`;
   - desfazer tudo se qualquer etapa falhar.
6. Preservar a idempotência atual do pedido:
   - replay com mesma chave e conteúdo retorna o mesmo pedido;
   - replay não tenta consumir novamente nem cria outra entrega;
   - outra chave não consegue reutilizar a aprovação;
   - duas confirmações concorrentes resultam em um único pedido.
7. Manter pedidos sem exceção compatíveis com o comportamento atual e sem relação de aprovação.
8. Incluir a referência e o resumo da aprovação no detalhe do pedido quando permitido, sem expor
   dados administrativos desnecessários ao e-mail.

#### Arquivos prováveis

- `src/shared/orders.ts` e contratos de aprovação;
- `src/server/modules/orders/orders.schemas.ts`;
- `src/server/modules/orders/orders.service.ts`;
- `src/server/modules/orders/orders.repository.ts`;
- repositório/serviço de aprovações;
- renderer de detalhe somente se necessário;
- testes unitários, transacionais e de integração.

#### Testes e verificações

- pedido abaixo do mínimo sem aprovação é bloqueado;
- pendente, rejeitada, cancelada, substituída, expirada ou consumida são bloqueadas;
- aprovação de outro usuário ou cliente é indistinguível de não autorizada;
- mudança de quantidade, preço, lista, faixa, versão ou mínimo bloqueia;
- alteração somente da observação final não invalida;
- fonte desativada depois da decisão bloqueia;
- aprovação válida cria pedido e vira `CONSUMED` no mesmo commit;
- falha em item, e-mail pendente ou auditoria reverte o consumo;
- concorrência e replay produzem um pedido e uma entrega;
- aprovação não pode ser ligada a dois pedidos;
- fluxo normal sem exceção permanece aprovado nas suítes existentes.

#### Concluída quando

Não existe caminho HTTP capaz de criar um pedido abaixo do mínimo sem uma aprovação válida do
carrinho exato, e o uso dessa aprovação é único, transacional e idempotente.

#### Resultado e evidências

- `approvalRequestId` foi adicionado ao contrato estrito de criação. A cotação de exceção agora
  emite token curto, assinado, ligado ao ator e ao fingerprint recalculado; a criação exige que ele
  tenha sido emitido depois da decisão, impedindo o reaproveitamento do token anterior à aprovação.
- A criação recalcula cliente, fontes, versões, faixas, mínimos e totais, reproduz o hash canônico e
  valida solicitante, cliente, estado, validade, consumo e conteúdo. Aprovação em carrinho normal é
  rejeitada explicitamente e fontes desativadas continuam bloqueadas pela cotação autoritativa.
- O repositório reserva a aprovação por estado e versão dentro da mesma transação que gera número,
  pedido, itens, entrega pendente, vínculo e auditorias `ORDER_SUBMITTED` e
  `ORDER_PRICE_APPROVAL_CONSUMED`. Qualquer falha reverte também a reserva.
- O hash idempotente do pedido inclui a aprovação somente quando presente, preservando replays de
  pedidos normais anteriores. Replay exato retorna o mesmo pedido sem novo consumo; outra tentativa
  não reserva uma aprovação já usada.
- O detalhe autorizado do pedido inclui referência e resumo público da aprovação consumida, sem
  incorporar justificativa ou metadados administrativos ao e-mail.
- Verificações executadas: `npm run lint`, `npm run typecheck`, suíte Vitest completa e
  `npm run build`. Resultado final: 58 arquivos de teste e 268 testes aprovados, sem falhas; build de
  produção concluído com sucesso.

---

### [x] TASK-005 — Entregar a experiência completa do solicitante no frontend

- Dependências: `TASK-002` e `TASK-004`.
- Seções principais: 9, 11.4, 18 e critérios de aceite 1 a 5, 10 a 17 e 19.
- Entrega: carrinho sinaliza exceções, coleta justificativa, acompanha decisão e só libera a revisão
  final quando a aprovação atual corresponder ao conteúdo.

#### Trabalho incluído

1. Aplicar `price.override` na interface:
   - campo editável somente para usuário autorizado;
   - estado somente leitura para os demais;
   - não depender dessa proteção para segurança do backend.
2. Corrigir a apresentação de produto avulso:
   - mostrar **Mínimo da faixa selecionada**;
   - informar lista, limites e versão escolhidos;
   - manter outras faixas apenas como comparação, sem apresentá-las como autorizadoras.
3. Tratar a resposta estruturada da cotação:
   - destacar cada exceção sem depender apenas de cor;
   - mostrar mínimo, solicitado, diferença unitária/total e percentual;
   - preservar erros reais de indisponibilidade separadamente;
   - trocar a ação principal conforme o estado.
4. Criar modal acessível de solicitação com:
   - cliente e resumo do carrinho;
   - todas as linhas em exceção;
   - contexto de lista/faixa/versão;
   - impacto total;
   - justificativa obrigatória;
   - cancelamento, confirmação, bloqueio de duplo clique e feedback.
5. Gerar e reutilizar corretamente a chave idempotente da tentativa lógica de solicitação.
6. Manter e recuperar o estado da solicitação:
   - `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `SUPERSEDED`, `EXPIRED`, `CONSUMED`;
   - mostrar motivo público de reprovação, revisor, datas e validade permitidos;
   - consultar a API depois de recarregar a página;
   - implementar **Minhas solicitações** no local decidido, com estados vazio, carregando e erro.
7. Invalidar imediatamente a liberação local quando mudar:
   - cliente;
   - item;
   - quantidade;
   - preço;
   - origem, lista ou faixa;
   - versão retornada pela nova cotação.
8. Após `APPROVED`:
   - habilitar **Gerar pedido** somente para o carrinho correspondente;
   - fazer nova cotação;
   - abrir a revisão final atual;
   - enviar `approvalRequestId` na confirmação;
   - tratar aprovação vencida/divergente sem perder o carrinho.
9. Após sucesso:
   - manter a mensagem atual de pedido registrado e envio em processamento;
   - refletir a aprovação consumida;
   - limpar o carrinho sem permitir segunda submissão acidental.
10. Garantir foco, teclado, `aria-live`, layout responsivo e mensagens acionáveis em todo o fluxo.

#### Arquivos prováveis

- `src/web/orders-page.ts`;
- `src/web/services/orders-api.ts` ou serviço de aprovações;
- `src/web/prototype-transform.ts`;
- contratos compartilhados;
- testes unitários de transformação e E2E de pedidos.

#### Testes e verificações

- usuário sem `price.override` não edita preço;
- preço normal abre a revisão existente;
- preço abaixo muda para **Solicitar aprovação**;
- mínimo exibido é o da faixa selecionada;
- justificativa e clique único são obrigatórios;
- envio pendente não cria pedido;
- reload recupera o estado próprio;
- aprovação libera nova cotação e revisão;
- reprovação mostra motivo e mantém bloqueio;
- expiração e divergência orientam nova solicitação;
- alteração posterior do carrinho remove a liberação;
- troca para outra faixa cria outro contexto;
- sucesso consome a aprovação e mantém o comportamento do e-mail;
- fluxo é operável por teclado e nas larguras suportadas.

#### Concluída quando

O solicitante consegue percorrer todo o ciclo sem ambiguidade, inclusive após recarregar a página, e
a interface nunca apresenta um carrinho divergente como liberado.

#### Resultado e evidências

- A tela de Pedidos passou a respeitar `price.override` na edição do preço e a identificar cada
  exceção com texto, borda, mínimo da faixa selecionada, lista, limites, versão, diferenças unitária,
  total e percentual, preservando as demais faixas apenas como comparação.
- Foi criado um modal acessível de solicitação com resumo do cliente/carrinho, todas as violações,
  impacto total, justificativa obrigatória, foco contido, bloqueio durante envio e chave idempotente
  reutilizada na mesma tentativa lógica.
- **Minhas solicitações** foi incluído no rodapé do próprio carrinho, com carregamento, vazio, erro,
  atualização, cancelamento e apresentação dos sete estados, decisão, revisor, datas, validade,
  motivo de reprovação e pedido consumido. A solicitação ativa é recuperada via API e
  `sessionStorage`, sem armazenar conteúdo comercial no navegador.
- Alterações de cliente, linha, quantidade, preço ou origem invalidam imediatamente a liberação
  local. Carrinhos recuperados são reconstruídos do snapshot do servidor; uma aprovação somente
  abre a revisão após nova cotação, e `approvalRequestId` só é enviado na confirmação do carrinho
  aprovado.
- Após o pedido, a aprovação é refletida como consumida, o carrinho é limpo e o comportamento já
  existente de pedido registrado e envio de e-mail em processamento foi preservado.
- Criado serviço web dedicado às APIs próprias de aprovação e cobertura de contrato para
  idempotência/paginação. Adicionado cenário E2E que percorre solicitação, estado pendente, aprovação,
  nova cotação, revisão, consumo único e vínculo do pedido.
- Verificações executadas: `npm run typecheck`, ESLint dos arquivos afetados, 20 testes focados,
  `npm test` (59 arquivos e 270 testes aprovados), `npm run build`, seis cenários E2E de regressão de
  Pedidos e o novo cenário E2E completo de aprovação. Todas as verificações terminaram sem falhas; o
  build manteve apenas o aviso já conhecido de chunks grandes do Vite.

---

### [x] TASK-006 — Entregar menu, badge e tela administrativa de aprovações

- Dependências: `TASK-003`; integração final depende da `TASK-004`.
- Seções principais: 10, 14.2, 19, 21 e critérios de aceite 6 a 9 e 19.
- Entrega: administradores autorizados recebem a notificação no menu e decidem solicitações em uma
  interface completa, acessível e resistente a concorrência.

#### Trabalho incluído

1. Adicionar rota protegida recomendada `/aprovacoes/precos`, tela e item **Aprovações** na
   navegação, visíveis somente com `order.price-approval.manage`.
2. Implementar badge acessível:
   - carregar após a sessão autenticada;
   - atualizar ao voltar a visibilidade/foco;
   - atualizar aproximadamente a cada 30 segundos enquanto aplicável;
   - atualizar imediatamente após decisão;
   - limpar timer no logout ou ciclo apropriado;
   - ocultar ou apresentar zero conforme o padrão visual escolhido;
   - não quebrar a navegação se o contador falhar.
3. Criar fila paginada com filtros, ordenação e estados:
   - pendências mais antigas primeiro;
   - solicitante, cliente, data/tempo de espera, exceções, total e impacto;
   - carregando, vazia, erro recuperável e retry;
   - suporte responsivo.
4. Criar detalhe administrativo:
   - solicitante e cliente;
   - justificativa;
   - carrinho completo e destaque das exceções;
   - origens, faixas e versões;
   - mínimos, solicitados, diferenças, subtotais e totais;
   - validade e histórico da decisão.
5. Implementar decisão:
   - confirmação explícita antes de aprovar;
   - observação opcional de aprovação;
   - motivo obrigatório de reprovação;
   - desabilitar ações durante envio;
   - exibir conflito e recarregar quando outro administrador decidir primeiro;
   - impedir visualmente autoavaliação e tratar a rejeição definitiva do backend;
   - atualizar fila e badge depois do sucesso.
6. Integrar a nova página ao roteamento, controle de permissões, navegação e inicialização existentes.
7. Garantir acessibilidade:
   - badge com quantidade anunciável;
   - foco inicial/restauração em modal;
   - operação por teclado;
   - títulos, tabelas/cards e estados semânticos;
   - decisão não comunicada apenas por cor.

#### Arquivos prováveis

- nova página em `src/web/`;
- novo serviço HTTP ou extensão do serviço de pedidos;
- `src/web/main.ts`;
- `src/web/prototype-transform.ts`;
- contratos compartilhados;
- testes de transformação, navegação e E2E administrativos.

#### Testes e verificações

- link e badge aparecem somente com a nova permissão;
- contador inicial, por foco, periódico e pós-decisão é atualizado sem timers duplicados;
- falha do contador não encerra a sessão nem quebra o menu;
- fila pagina, filtra e ordena corretamente;
- detalhe exibe todos os dados necessários à decisão;
- aprovação e reprovação exigem confirmação adequada;
- reprovação sem motivo não é enviada;
- conflito concorrente mostra o estado decidido por outro administrador;
- autoavaliação permanece bloqueada no backend e é explicada na UI;
- navegação por teclado e layout móvel funcionam;
- usuários sem permissão não acessam rota nem APIs por URL direta.

#### Concluída quando

Um administrador autorizado percebe pendências pelo menu, analisa o contexto completo e registra uma
única decisão confiável, enquanto usuários não autorizados não veem nem acessam a capacidade.

#### Resultado e evidências

- Adicionada a rota protegida `/aprovacoes/precos`, o item **Aprovações** condicionado a
  `order.price-approval.manage` e o badge acessível de pendências. O contador é carregado após a
  sessão, atualizado a cada 30 segundos, ao recuperar foco/visibilidade e imediatamente após uma
  decisão; a configuração centralizada elimina timers duplicados e os remove no logout ou na perda
  da permissão.
- Implementada a fila administrativa paginada com estado, código do item e intervalo de datas,
  estados de carregamento/vazio/erro com retry, totais, impacto, espera e adaptação para telas
  móveis. Falhas isoladas do contador não afetam a sessão ou a navegação.
- Implementados detalhe completo e seguro do snapshot, destaque textual das exceções, origens,
  faixas, versões, valores e histórico. Aprovação e reprovação usam confirmação explícita,
  observação opcional ou motivo obrigatório, bloqueio durante o envio, prevenção visual de
  autoavaliação e recarga após conflito concorrente.
- Modais possuem foco inicial e restauração, contenção de foco, fechamento por teclado, regiões
  `aria-live`, nomes acessíveis e estados que não dependem apenas de cor.
- Verificações executadas: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` e
  `npm run test:e2e -- tests/e2e/admin-price-approvals.spec.ts`. Resultado: build aprovado, 59
  arquivos/271 testes Vitest aprovados e 3 cenários E2E administrativos aprovados em desktop e
  mobile.

---

### [x] TASK-007 — Consolidar integração, documentação, migração e quality gate

- Dependências: `TASK-001` a `TASK-006`.
- Seções principais: 20 a 28 e todos os critérios de aceite.
- Entrega: fluxo integrado, documentação coerente, migration ensaiada e evidências de que todos os
  critérios funcionais, de segurança e regressão foram atendidos.

#### Trabalho incluído

1. Revisar rastreabilidade entre especificação, tarefas, código e testes:
   - todos os estados e transições;
   - todos os erros de domínio;
   - todos os endpoints e permissões;
   - todos os eventos de auditoria;
   - todos os 20 critérios de aceite.
2. Completar testes integrados de ponta a ponta cobrindo:
   - fluxo normal sem aprovação;
   - produto abaixo do mínimo da faixa selecionada;
   - outra faixa mais barata sem efeito autorizador;
   - kit abaixo do mínimo;
   - solicitação, badge, aprovação, nova cotação e pedido;
   - reprovação, cancelamento, substituição e expiração;
   - autoaprovação;
   - decisão e criação concorrentes;
   - alteração de cada campo protegido;
   - consumo único e replay idempotente;
   - criação da entrega de e-mail somente após o pedido.
3. Ensaiar a migration em banco MySQL descartável ou cópia segura e representativa:
   - aplicar migrations do zero;
   - aplicar sobre o estado anterior com dados;
   - reconciliar contagens de usuários, listas, cálculos e pedidos;
   - verificar índices e constraints;
   - registrar duração, resultado e eventual plano operacional de rollback.
4. Revisar observabilidade:
   - logs possuem `requestId`, approval ID e order ID quando aplicável;
   - textos sensíveis e carrinho completo não aparecem indevidamente;
   - contador e fila usam consultas indexadas;
   - expiração não duplica auditoria.
5. Atualizar documentação:
   - `README.md` com fluxo, permissões e rotas relevantes;
   - `CLAUDE.md` se continuar sendo documentação operacional do projeto;
   - `docs/telas/08-pedidos.md`;
   - novo documento da tela administrativa ou índice de telas;
   - `spec-envio-pedidos-email/spec.md` para remover a decisão antiga já resolvida, sem apagar o
     histórico útil;
   - `spec-aprovacao-preco-pedido/spec.md` somente se a implementação exigir decisão registrada.
6. Executar revisão de segurança manual:
   - chamadas diretas sem permissão;
   - troca de IDs entre usuários;
   - payload com mínimo/total forjado;
   - tentativa de reutilizar aprovação;
   - XSS em justificativa/motivo;
   - clique duplo e retry após timeout.
7. Executar o quality gate completo e corrigir somente regressões relacionadas ao escopo.
8. Registrar neste arquivo:
   - comandos e resultados;
   - quantidade de testes;
   - limitações externas reais;
   - qualquer desvio aprovado da especificação;
   - evidência objetiva de cada critério de aceite.

#### Arquivos prováveis

- testes unitários, de migration, repositório, integração e E2E;
- `README.md`;
- `CLAUDE.md`;
- `docs/telas/README.md`;
- `docs/telas/08-pedidos.md`;
- novo documento da tela administrativa;
- specs relacionadas;
- scripts de verificação sem dados sensíveis, se necessários.

#### Testes e comandos mínimos

- `npm run format:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- `npm run test`;
- `npm run test:integration`;
- `npm run test:e2e`;
- `npx prisma validate`;
- `npm run db:generate`;
- ensaio real da migration em MySQL descartável quando a infraestrutura estiver disponível.

Se algum comando agregado repetir suítes, o registro pode indicar a execução equivalente sem ocultar
falhas. Testes externos indisponíveis devem ser marcados `[!]`, com causa e impacto concretos; isso
não autoriza marcar a tarefa como concluída sem evidência alternativa proporcional.

#### Concluída quando

Todos os critérios da especificação possuem implementação e evidência automatizada ou operacional,
a migration foi ensaiada com segurança, a documentação reflete o comportamento real e o quality
gate aplicável está aprovado.

#### Resultado e evidências

- A rastreabilidade final confirmou os sete estados, as transições condicionais, os 12 erros de
  domínio previstos, os 11 endpoints de cotação/pedido/aprovação, as três permissões do fluxo e os
  sete eventos `ORDER_PRICE_APPROVAL_*`. Contador e fila usam índices e paginação no banco;
  expiração, decisão e consumo usam atualizações condicionais e auditoria transacional.
- O teste do hash canônico passou a alterar individualmente ator, cliente, classificações, tipo,
  código, todas as origens e versões, faixa, referência, quantidade, preços, subtotais, totais e
  inclusão/remoção de item. A observação final continua deliberadamente fora do hash.
- A revisão manual de segurança confirmou autorização server-side, consulta própria indistinguível
  por `404`, rejeição de mínimo/total forjado pelo schema estrito, textos inseridos com
  `textContent`, bloqueio de autoaprovação, versão esperada nas decisões, idempotência e consumo
  único. Testes E2E cobrem foco, clique duplo, retry, rota sem permissão e layout móvel.
- A documentação foi consolidada no `README.md`, `CLAUDE.md`, `docs/telas/08-pedidos.md`, índice de
  telas e novo `docs/telas/11-aprovacoes-preco.md`. A decisão histórica de bloqueio absoluto em
  `spec-envio-pedidos-email/spec.md` agora aponta para esta especificação sem apagar o contexto.
- O primeiro ensaio MySQL 8.4 revelou erro real `1059`: três nomes automáticos de índices excediam
  o limite de 64 caracteres. A migration e o schema Prisma receberam nomes físicos estáveis, e um
  teste de regressão agora verifica o limite de todos os índices e constraints da migration.
- Ensaio do zero em container MySQL 8.4 descartável: 23 migrations aplicadas em 18,62 s; duas
  tabelas de aprovação, 10 FKs, 4 checks e maior nome de índice com 62 caracteres. Ensaio de upgrade:
  21 migrations até `orders_foundation`, fixtures com 1 usuário, 1 lista, 1 cálculo e 1 pedido, e as
  duas migrations de aprovação aplicadas em 1,31 s; as quatro contagens permaneceram `1` e nenhuma
  aprovação artificial foi criada. O container sem volume foi removido após a verificação.
- Plano operacional de rollback: manter as migrations aditivas aplicadas, desabilitar o código novo
  em caso de incidente e restaurar a aplicação anterior; não remover tabelas nem vínculos comerciais.
  Antes de produção, manter backup restaurável e aplicar `prisma migrate deploy` em etapa controlada.
- Quality gate executado após as correções: `npm run format:check`, `npm run lint`,
  `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:integration`,
  `npm run test:e2e`, `npx prisma validate` e `npm run db:generate`. Resultado: 59 arquivos/273
  testes Vitest, 10 arquivos/78 testes de integração e 32 testes Playwright aprovados; build e
  validações sem erro. O aviso de chunks grandes do Vite permanece pré-existente e não bloqueante.

#### Evidência objetiva dos critérios de aceite

| Critério | Evidência final                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1–3      | `order-price-approval-quote.test.ts` e `orders-multi-list.test.ts`: fluxo normal e mínimo exclusivo da lista/faixa selecionada. |
| 4–6      | E2E de Pedidos e Administração: solicitação não cria pedido, aparece em Minhas solicitações, fila e badge.                      |
| 7–10     | Integração HTTP, serviço e E2E administrativo: permissão dedicada, autoavaliação, corrida e reprovação com motivo.              |
| 11–14    | Testes do hash e de liberação: ator/cliente/conteúdo exatos, todos os campos protegidos, token posterior e fontes revalidadas.  |
| 15–17    | `orders.repository.test.ts`, teste de liberação e E2E: transação única, consumo único e replay sem segundo pedido/e-mail.       |
| 18       | Testes de repositório cobrem solicitação, substituição, decisão, cancelamento, expiração e consumo auditados.                   |
| 19       | E2E cobre carregamento/erro/sucesso, badge acessível, foco previsível, bloqueio de rota e resolução móvel.                      |
| 20       | Suítes unitária, migration/repositório, integração HTTP e E2E aprovadas no quality gate final.                                  |

## 7. Matriz resumida de cobertura

| Capacidade                                     | Tarefa principal        | Validação final        |
| ---------------------------------------------- | ----------------------- | ---------------------- |
| Schema, snapshots, estados e permissionamento  | `TASK-001`              | `TASK-007`             |
| Mínimo por lista/faixa selecionada             | `TASK-002`              | `TASK-007`             |
| Solicitação, idempotência e consultas próprias | `TASK-002`              | `TASK-005`, `TASK-007` |
| Fila, contador, decisão e expiração            | `TASK-003`              | `TASK-006`, `TASK-007` |
| Nova cotação e vínculo exato                   | `TASK-004`              | `TASK-005`, `TASK-007` |
| Consumo único, transação e replay              | `TASK-004`              | `TASK-007`             |
| Experiência do solicitante                     | `TASK-005`              | `TASK-007`             |
| Menu, badge e experiência administrativa       | `TASK-006`              | `TASK-007`             |
| Auditoria, segurança e observabilidade         | `TASK-001` a `TASK-004` | `TASK-007`             |
| Documentação, migration real e quality gate    | `TASK-007`              | `TASK-007`             |

## 8. Regra para mudanças de escopo

Durante a implementação:

- correções necessárias para cumprir esta especificação entram na tarefa correspondente;
- melhorias opcionais devem ser registradas como fora de escopo, sem ampliar silenciosamente uma
  tarefa;
- aprovação parcial, múltiplas alçadas, comentários, notificações externas e tempo real não devem
  ser adicionados sem nova decisão de produto;
- qualquer mudança na definição do mínimo exige atualização explícita da especificação antes do
  código;
- não criar microtarefas adicionais apenas para aumentar granularidade; usar os subtópicos já
  existentes como checklist de execução.

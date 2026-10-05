# Tasks — Registro e envio de pedidos por e-mail

## 1. Objetivo

Implementar a especificação de `spec-envio-pedidos-email/spec.md` em cinco entregas verticais,
coesas e verificáveis.

O fluxo final deve:

1. validar o carrinho no servidor;
2. abrir uma confirmação completa sem produzir efeito persistente;
3. registrar o pedido somente após confirmação explícita;
4. enviar o e-mail de forma assíncrona e idempotente;
5. destinar a mensagem ao usuário emissor e ao endereço operacional configurado;
6. preservar pedido e histórico mesmo diante de falhas do provedor.

Este planejamento concentra todo o detalhamento neste arquivo. Não devem ser criados arquivos de
microtarefas por tabela, endpoint, componente ou categoria de teste.

## 2. Convenções

- `[ ]`: não iniciada;
- `[~]`: em andamento;
- `[x]`: concluída e verificada;
- `[!]`: bloqueada por decisão ou dependência externa;
- requisitos `RF-*` e `RNF-*` referenciam o `spec.md` desta pasta;
- cada tarefa entrega uma capacidade completa e revisável;
- descobertas pertencentes ao escopo devem ser incorporadas à tarefa responsável;
- uma sexta tarefa só pode ser criada se surgir uma entrega realmente independente e a justificativa
  for registrada neste arquivo.

## 3. Decisões e padrões de execução

Antes da implementação que dependa deles, confirmar e registrar no `spec.md`:

1. provedor inicial de e-mail;
2. `EMAIL_FROM` e, se necessário, `EMAIL_REPLY_TO`;
3. formato definitivo do número legível do pedido;
4. política comercial para preço negociado abaixo do mínimo;
5. inclusão de webhook de entrega/bounce já na primeira publicação.

Enquanto não houver decisão diferente, aplicar os padrões seguros definidos na especificação:

- bloquear preço negociado abaixo do menor valor permitido;
- usar corpo HTML e texto simples, sem anexos;
- usar `nicolasbruski7@gmail.com` em `ORDER_NOTIFICATION_RECIPIENTS`;
- enviar também ao e-mail snapshot do usuário que confirmou;
- deduplicar destinatários;
- não afirmar entrega final apenas porque o provedor aceitou a mensagem;
- manter entrega real desabilitada por padrão fora de produção autorizada.

Decisões tomadas durante as tarefas devem atualizar a seção 25 do `spec.md`, e não ficar registradas
somente em código ou conversa.

## 4. Definição global de pronto

Uma tarefa só pode ser marcada como `[x]` quando:

1. a capacidade estiver implementada de ponta a ponta dentro do recorte da tarefa;
2. validação, autenticação, autorização, idempotência e auditoria aplicáveis estiverem cobertas;
3. nenhum valor monetário ou identidade de usuário confiar no navegador como fonte de verdade;
4. migrações forem aditivas e preservarem os dados existentes;
5. testes unitários, de integração e/ou E2E previstos estiverem aprovados;
6. erros esperados forem apresentados de forma acionável e sem vazamento de dados;
7. formatação, lint, typecheck e testes afetados estiverem aprovados;
8. documentação não contradisser o comportamento entregue;
9. nenhuma chave, destinatário de produção ou conteúdo sensível estiver fixado no código;
10. o resultado e eventuais desvios da especificação estiverem registrados neste arquivo.

## 5. Ordem resumida

```text
TASK-001 Fundação e persistência segura
    ↓
TASK-002 Criação idempotente e contratos do pedido
    ├── TASK-003 Confirmação completa no frontend
    └── TASK-004 Entrega assíncrona por e-mail
             ↓
TASK-005 Integração, operação segura e entrega final
```

`TASK-003` e `TASK-004` podem avançar em paralelo após a estabilização dos contratos da `TASK-002`,
desde que mudanças nos contratos compartilhados sejam coordenadas. A `TASK-005` depende de todas as
anteriores.

## 6. Tarefas

### [x] TASK-001 — Construir a fundação persistente e auditável do pedido

- Dependências: nenhuma.
- Requisitos principais: `RF-PED-001` a `RF-PED-008`, `RF-DLV-001`, `RNF-001`, seções 13, 15 e 16.
- Entrega: schema, migration e domínio mínimo capazes de preservar pedido, itens e primeira entrega
  de e-mail na mesma transação, ainda sem envio real.

#### Trabalho incluído

1. Fechar e documentar as decisões que afetam diretamente o modelo:
   - formato do número legível;
   - precisão monetária;
   - estados iniciais de pedido e entrega;
   - política provisória ou definitiva de preço negociado;
   - retenção mínima dos snapshots.
2. Modelar no Prisma:
   - `Order`;
   - `OrderItem`;
   - `OrderEmailDelivery`;
   - enums necessários;
   - relações restritivas com cliente e usuário;
   - índices de consulta e unicidade;
   - campos de idempotência, hash de conteúdo, tentativas e reserva do worker.
3. Incluir snapshots suficientes para reproduzir o pedido:
   - cliente, classificação e localização;
   - usuário emissor;
   - origem, lista e versões de cada item;
   - código, descrição, referência e quantidades;
   - preço de referência, preço negociado, impostos e subtotal;
   - observação, quantidade total e total monetário;
   - destinatários, remetente e versão do template na entrega.
4. Criar migration aditiva com:
   - constraints monetárias e de quantidade viáveis no MySQL;
   - unicidade da numeração e chaves idempotentes;
   - índices para busca de entregas processáveis;
   - exclusões em cascata somente onde não eliminem histórico comercial.
5. Criar contratos e tipos de domínio compartilhados sem expor modelos Prisma diretamente ao web.
6. Criar repositório transacional que grave:
   - pedido;
   - itens;
   - primeira entrega `PENDING`;
   - `AuditLog` `ORDER_SUBMITTED`;
   - tudo em um único commit.
7. Implementar gerador testável do número do pedido e estratégia segura contra colisão.
8. Preparar geradores/relógio injetáveis nos pontos necessários para testes determinísticos.

#### Arquivos prováveis

- `prisma/schema.prisma`;
- nova migration em `prisma/migrations/`;
- `src/shared/orders.ts`;
- novos tipos e repositório em `src/server/modules/orders/`;
- helpers de teste e testes de migration/domínio.

#### Testes e verificações

- migration cria tabelas, constraints e índices esperados;
- pedido misto preserva todos os snapshots;
- decimais não perdem precisão;
- falha em qualquer gravação desfaz toda a transação;
- alteração posterior de cliente, usuário, produto ou lista não modifica o snapshot;
- número e chave idempotente não podem colidir silenciosamente;
- nenhum pedido atual ou fluxo existente sofre regressão.

#### Concluída quando

É possível criar atomicamente, por serviço/repositório testado, um pedido completo e uma entrega
pendente reproduzível, sem chamar provedor externo e sem depender de dados mutáveis posteriores.

#### Resultado e evidências (2026-09-29)

- criados schema e migration aditivos para `Order`, `OrderItem`, `OrderEmailDelivery` e sequência
  anual, com FKs restritivas, constraints monetárias/quantitativas, unicidades e índices do worker;
- contratos compartilhados usam strings decimais e não expõem modelos do Prisma ao frontend;
- `PrismaOrdersRepository.createWithFirstDelivery` grava pedido misto, itens, entrega `PENDING` e
  auditoria `ORDER_SUBMITTED` dentro de uma única transação;
- relógio, IDs e gerador de número são injetáveis; a sequência usa operação atômica do MySQL e
  as unicidades impedem colisão silenciosa;
- `prisma validate`, geração do client, lint, typecheck, build e 197 testes passaram;
- os testes novos cobrem migration, formato/limite/reserva da numeração, snapshots mistos,
  precisão decimal e rollback da transação diante de falha de auditoria;
- o daemon Docker local não estava ativo, portanto a migration não foi aplicada a uma instância
  descartável nesta tarefa; a consistência foi verificada por `prisma validate`, `prisma migrate diff`
  e inspeção automatizada do SQL. O ensaio com banco preenchido permanece previsto na `TASK-005`.

---

### [x] TASK-002 — Implementar a submissão idempotente e a validação definitiva

- Dependências: `TASK-001`.
- Requisitos principais: `RF-CON-002`, `RF-CON-004`, `RF-CON-005`, `RF-PED-001` a `RF-PED-009`,
  seção 10 e seção 14.
- Entrega: contratos HTTP e serviço de aplicação que transformam uma cotação revisada em exatamente
  um pedido persistido, sem ainda exigir que o provedor esteja disponível.

#### Trabalho incluído

1. Evoluir `POST /api/v1/orders/quote` para suportar a revisão final:
   - receber os preços negociados necessários à confirmação;
   - continuar resolvendo todas as fontes de verdade no servidor;
   - devolver preço de referência e negociado separadamente;
   - devolver destinatários previstos;
   - devolver `quoteToken` ou fingerprint opaco com validade curta;
   - informar diferenças e avisos de forma estruturada.
2. Implementar `POST /api/v1/orders`:
   - exigir sessão e permissões `order.access` e `price.view`;
   - exigir `Idempotency-Key` com formato e tamanho limitados;
   - obter usuário exclusivamente da sessão;
   - validar cliente, itens, versões, listas, faixas e vínculos novamente;
   - validar preço negociado segundo a política registrada;
   - normalizar e limitar observação;
   - calcular quantidade, subtotais e total com decimal no backend;
   - calcular hash canônico da submissão;
   - criar pedido e entrega por meio da transação da `TASK-001`.
3. Implementar semântica idempotente:
   - mesma chave, mesmo usuário e mesmo conteúdo retornam o pedido existente;
   - mesma chave com conteúdo diferente retorna conflito;
   - concorrência de duas requisições produz um único pedido;
   - timeout depois do commit pode ser recuperado repetindo a requisição.
4. Detectar cotação desatualizada:
   - alteração de lista, versão, classificação, faixa, item ou referência bloqueia a criação;
   - retornar erro específico, sem criar pedido ou entrega;
   - fornecer dados suficientes para a interface solicitar nova revisão.
5. Resolver destinatários no backend:
   - e-mail snapshot do usuário autenticado;
   - `ORDER_NOTIFICATION_RECIPIENTS` validado na configuração;
   - normalização e deduplicação sem diferenciar caixa;
   - bloqueio antes do commit se não houver destinatário válido.
6. Criar `GET /api/v1/orders/:id` com o acesso mínimo necessário:
   - criador consulta o próprio pedido;
   - administrador consulta qualquer pedido;
   - retorno contém snapshot e resumo de entregas, nunca segredos ou erros internos brutos.
7. Integrar configurações não secretas e validações no carregamento da aplicação.
8. Registrar erros e auditoria com `requestId`, `orderId` e `deliveryId`, sem corpo completo.

#### Arquivos prováveis

- `src/server/config/env.ts` e `.env.example`;
- `src/server/modules/orders/orders.schemas.ts`;
- `src/server/modules/orders/orders.routes.ts`;
- `src/server/modules/orders/orders.service.ts`;
- repositório de pedidos;
- `src/shared/orders.ts`;
- `src/web/services/orders-api.ts` apenas para os contratos, sem finalizar a interface;
- testes unitários e de integração de pedidos.

#### Testes e verificações

- criação válida devolve `201`, número e entrega `PENDING`;
- repetição idêntica devolve o mesmo pedido;
- chave reutilizada com outro conteúdo retorna conflito;
- duas submissões concorrentes não duplicam;
- preço ou versão alterados exigem nova confirmação;
- preço abaixo do permitido é bloqueado;
- preço negociado e referência são persistidos separadamente;
- total adulterado no navegador é ignorado;
- usuário inativo, sem permissão ou sessão é rejeitado;
- e-mail do usuário inválido/configuração inválida bloqueia antes do commit;
- destinatários repetidos são deduplicados;
- consulta não permite acessar pedido de outro usuário sem autorização;
- falha controlada não cria registros parciais.

#### Concluída quando

Uma submissão autenticada e válida cria exatamente um pedido auditável e sua entrega pendente; uma
submissão inválida, desatualizada ou repetida nunca cria efeitos duplicados.

#### Resultado e evidências (2026-09-30)

- a cotação final recebe preços negociados, resolve novamente cliente, listas, versões, faixas e
  itens, devolve referências separadas, destinatários deduplicados e token assinado de curta duração;
- `POST /api/v1/orders` exige sessão, `order.access`, `price.view` e `Idempotency-Key`, revalida a
  cotação e grava o snapshot pela transação da `TASK-001`, sem confiar em totais ou identidade do
  navegador;
- repetição com a mesma chave e conteúdo recupera o pedido; conteúdo divergente gera conflito e a
  unicidade por usuário protege submissões concorrentes;
- observações são normalizadas e limitadas, preço abaixo do mínimo é bloqueado e destinatários vêm
  do usuário autenticado mais `ORDER_NOTIFICATION_RECIPIENTS`;
- `GET /api/v1/orders/:id` retorna somente snapshots e resumo sanitizado de entregas; o criador
  consulta o próprio pedido e o administrador consulta qualquer pedido, enquanto acesso indevido
  responde como pedido inexistente;
- typecheck, lint, build, 217 testes Vitest e 28 testes E2E passaram; os testes adicionados cobrem
  permissões da consulta, encaminhamento da identidade autenticada e isolamento criador/admin.

---

### [x] TASK-003 — Entregar a confirmação completa e segura na tela de Pedidos

- Dependências: `TASK-002`.
- Requisitos principais: `RF-CON-001` a `RF-CON-006`, `RF-DLV-006`, `RNF-002`, `RNF-006` e
  `RNF-007`.
- Entrega: novo fluxo visual **Gerar pedido → revisar → confirmar e enviar**, integrado à API real e
  sem persistência antes da confirmação final.

#### Trabalho incluído

1. Alterar o comportamento de **Gerar pedido**:
   - impedir ação sem cliente ou carrinho;
   - desabilitar enquanto cota;
   - usar a cotação server-side atualizada;
   - não exibir “Pedido gerado” antes da submissão;
   - não criar registro nesta primeira ação.
2. Criar confirmação compatível com a identidade visual existente, contendo:
   - cliente;
   - nome e e-mail do emissor;
   - destinatários efetivos;
   - itens, origens/listas e versões legíveis;
   - quantidades, referências e preços negociados;
   - impostos informativos;
   - subtotais e total;
   - observação;
   - avisos da cotação.
3. Incluir ações:
   - **Confirmar e enviar pedido**;
   - **Voltar e revisar**;
   - fechamento seguro por botão, clique externo conforme padrão do projeto e `Esc`;
   - bloqueio de clique duplo e feedback durante a submissão.
4. Invalidar a confirmação se, depois de aberta, mudar:
   - cliente;
   - item;
   - quantidade;
   - preço negociado;
   - imposto editável aplicável;
   - observação.
5. Gerar uma chave idempotente por tentativa lógica de confirmação e reutilizá-la em retry de rede
   do mesmo conteúdo, sem reaproveitá-la depois de mudanças.
6. Tratar resposta de cotação alterada:
   - não perder o carrinho;
   - atualizar referências retornadas;
   - explicar o que mudou;
   - exigir que o usuário abra e confirme novamente.
7. Tratar sucesso:
   - mostrar número do pedido;
   - informar **pedido registrado; envio em processamento**;
   - não afirmar entrega final;
   - impedir nova submissão acidental do mesmo carrinho;
   - oferecer retorno coerente ao fluxo de origem.
8. Tratar falhas:
   - erro antes do commit mantém carrinho e observação;
   - resposta idempotente após timeout mostra o pedido existente;
   - mensagens técnicas não são exibidas diretamente.
9. Garantir acessibilidade:
   - foco inicial e restauração de foco;
   - contenção de foco;
   - rótulos e títulos semânticos;
   - operação completa por teclado;
   - anúncio de carregamento, erro e sucesso.
10. Atualizar transformação do protótipo e testes que hoje esperam apenas cotação.

#### Arquivos prováveis

- `src/web/orders-page.ts`;
- `src/web/services/orders-api.ts`;
- `src/web/prototype-transform.ts`;
- `src/shared/orders.ts`;
- testes de transformação e E2E da tela de Pedidos.

#### Testes e verificações

- **Gerar pedido** abre confirmação e não chama criação antes do botão final;
- modal exibe cliente, itens, observação, total e ambos os destinatários;
- **Voltar e revisar**, `Esc` e fechamento não criam pedido;
- alteração de qualquer dado invalida revisão antiga;
- clique duplo dispara uma única submissão lógica;
- mudança server-side força nova revisão;
- sucesso mostra número e estado pendente;
- timeout seguido de retry recupera o mesmo pedido;
- erro mantém o carrinho editável;
- foco e teclado funcionam;
- layout funciona nas larguras já suportadas pela aplicação;
- comportamento existente de catálogo, fotos, faixas e troca de cliente permanece íntegro.

#### Concluída quando

O usuário consegue revisar exatamente os dados e destinatários do pedido, cancelar sem efeito e
confirmar uma única criação real com feedback correto e acessível.

#### Resultado e evidências (2026-09-29)

- **Gerar pedido** envia preços negociados para a cotação autoritativa, atualiza as referências e
  abre uma revisão sem criar pedido; a mensagem prematura “Pedido gerado” foi removida;
- a revisão mostra cliente, emissor, destinatários, origens e versões, quantidades, referências,
  preços negociados, impostos, subtotais, total, observação e avisos usando apenas nós de texto;
- o modal possui fechamento por botão, clique externo e `Esc`, restauração e contenção de foco,
  anúncio de estados e layout responsivo;
- alterações de cliente, carrinho, quantidade, preço, imposto ou observação invalidam a revisão;
- cada tentativa lógica recebe uma chave idempotente criptograficamente aleatória, preservada após
  falha de rede e substituída depois de alteração ou nova revisão;
- **Confirmar e enviar pedido** chama `POST /api/v1/orders`, bloqueia clique duplo, preserva o
  carrinho diante de falha e, no sucesso, limpa a montagem e informa número e “envio em
  processamento”, sem afirmar entrega final;
- para tornar a integração real utilizável, foram concluídos os trechos mínimos da dependência
  `TASK-002`: cotação com emissor/destinatários/token, rota de criação autenticada e ligação com o
  repositório transacional. A consulta detalhada e a matriz restante de autorização foram concluídas
  posteriormente e estão registradas no resultado da `TASK-002`;
- `lint`, `typecheck`, build, 198 testes Vitest e os 6 cenários E2E de Pedidos passaram; o E2E cobre
  cancelamento sem criação, falha de rede com retry da mesma chave, bloqueio de clique duplo e
  sucesso com entrega `PENDING`.

---

### [x] TASK-004 — Implementar renderização e entrega assíncrona confiável

- Dependências: `TASK-002` e decisões de provedor/remetente.
- Requisitos principais: `RF-EML-001` a `RF-EML-008`, `RF-DLV-001` a `RF-DLV-007`, `RNF-003` a
  `RNF-005`, seções 16 a 20.
- Entrega: template, abstração do provedor, worker persistente, retentativas e acompanhamento do
  envio, sem bloquear a criação do pedido.

#### Trabalho incluído

1. Confirmar o provedor, documentar a decisão e instalar somente a dependência oficial necessária.
2. Criar interface `EmailProvider` pequena e independente do fornecedor:
   - enviar HTML e texto;
   - destinatários, remetente, `Reply-To`, assunto e chave idempotente;
   - resultado normalizado com identificador externo;
   - erros classificados em transitórios e permanentes.
3. Criar adaptadores:
   - adaptador real do provedor;
   - adaptador em memória/controlável para testes;
   - opção segura de entrega desabilitada.
4. Implementar `OrderEmailRenderer` versionado:
   - renderizar exclusivamente a partir do snapshot persistido;
   - assunto sanitizado;
   - HTML com estilos inline simples;
   - versão texto equivalente;
   - cliente, pedido, emissor, itens, quantidades, preços, total e observação;
   - escape de todo conteúdo variável;
   - ausência de JavaScript, imagens remotas e anexos.
5. Implementar `OrderEmailWorker`:
   - polling não bloqueante;
   - busca por entregas processáveis;
   - reserva atômica com prazo;
   - prevenção de concorrência;
   - chave idempotente estável por entrega;
   - persistência de `ACCEPTED` e identificador externo;
   - classificação de falhas;
   - no máximo cinco tentativas em 24 horas, salvo decisão registrada diferente;
   - backoff crescente com jitter;
   - recuperação de reservas expiradas;
   - shutdown coordenado com o servidor.
6. Persistir auditoria operacional:
   - `ORDER_EMAIL_ACCEPTED`;
   - `ORDER_EMAIL_FAILED` ao esgotar ou diante de erro permanente;
   - metadados mínimos e sanitizados.
7. Integrar configuração segura:
   - `EMAIL_PROVIDER`;
   - `EMAIL_API_KEY` sem exemplo real;
   - `EMAIL_FROM`;
   - `EMAIL_REPLY_TO` opcional;
   - `ORDER_NOTIFICATION_RECIPIENTS` com exemplo inicial autorizado;
   - `EMAIL_DELIVERY_ENABLED` desabilitado por padrão em desenvolvimento;
   - allowlist de endereços/domínios em não produção;
   - validação fatal de configuração incompleta quando envio estiver habilitado.
8. Se webhook fizer parte da primeira publicação:
   - criar rota com corpo/tipo limitados;
   - validar assinatura conforme documentação oficial;
   - deduplicar eventos;
   - atualizar `DELIVERED` e `BOUNCED` de forma monotônica e idempotente;
   - auditar transições sem registrar payload bruto desnecessário.
9. Se webhook for adiado:
   - documentar que `ACCEPTED` é o estado terminal observável da primeira versão;
   - não mostrar ou implementar estados falsamente inferidos.

#### Arquivos prováveis

- `package.json` e lockfile;
- `src/server/config/env.ts` e `.env.example`;
- novos módulos de e-mail/entrega em `src/server/modules/`;
- inicialização e shutdown em `src/server/server.ts`;
- logging/redaction em `src/server/config/logger.ts`;
- rotas de webhook, quando incluídas;
- templates e testes unitários/de integração.

#### Testes e verificações

- HTML escapa descrição, cliente e observação maliciosos;
- texto simples contém os mesmos valores essenciais;
- destinatários são usuário emissor mais `nicolasbruski7@gmail.com`, sem duplicidade;
- remetente só vem da configuração;
- worker envia uma entrega uma única vez sob concorrência;
- provedor recebe chave idempotente estável;
- erro transitório reagenda com limite;
- erro permanente não entra em loop;
- reinício recupera pendências e reservas expiradas;
- sucesso grava identificador e auditoria;
- envio desabilitado não contata rede;
- allowlist impede destinatário não autorizado em teste/homologação;
- logs não contêm chave, corpo completo ou headers de autorização;
- webhook inválido é recusado e repetição válida é idempotente, quando aplicável.

#### Concluída quando

Uma entrega pendente pode ser renderizada e enviada com segurança ao usuário emissor e ao endereço
operacional, sobrevivendo a concorrência, falhas e reinicializações sem duplicar nem perder pedidos.

#### Resultado e evidências (2026-09-29)

- Resend foi definido como provedor inicial e encapsulado por `EmailProvider`; o adaptador usa o SDK
  oficial, envia HTML e texto e repassa a chave idempotente persistida em todas as tentativas;
- foram incluídos adaptadores Resend, em memória e desabilitado, além de proteção por allowlist de
  endereços/domínios fora de produção;
- o template `order-v1` é produzido somente a partir do snapshot persistido, possui HTML com estilos
  inline e texto equivalente, escapa conteúdo variável e não inclui JavaScript, imagens ou anexos;
- o worker reserva a entrega atomicamente, recupera reservas expiradas, limita o processamento a
  cinco tentativas, aplica backoff crescente com jitter e persiste `ACCEPTED` ou reagendamento/
  `FAILED` sem alterar o pedido;
- aceitação e falha terminal geram `ORDER_EMAIL_ACCEPTED` e `ORDER_EMAIL_FAILED` com metadados
  mínimos; logs e configuração ocultam credenciais e não registram os corpos renderizados;
- o worker inicia somente com `EMAIL_DELIVERY_ENABLED=true` e configuração completa, e seu shutdown
  aguarda a tentativa ativa antes de desconectar o Prisma;
- o webhook foi adiado: nesta versão, `ACCEPTED` é o estado terminal positivo observável e não é
  apresentado como entrega final;
- `format:check`, `lint`, `typecheck`, build e os 212 testes Vitest passaram; os 14 testes novos
  cobrem escape e equivalência do template, allowlist, chave estável, concorrência, recuperação de
  reserva, retry, limite de tentativas, falha permanente e validação fatal da configuração;
- nenhum envio externo foi realizado sem credenciais; o teste real autorizado permanece na
  `TASK-005`.

---

### [!] TASK-005 — Validar o fluxo integral e preparar a operação segura

- Dependências: `TASK-001` a `TASK-004`.
- Requisitos principais: todos os critérios de aceite da seção 23, implantação e rollback da seção
  24 e consistência documental.
- Entrega: fluxo completo testado, documentação atualizada, piloto controlado e quality gate final.

#### Trabalho incluído

1. Integrar os estados finais na experiência do usuário:
   - pedido registrado com envio pendente;
   - envio aceito, quando consultado;
   - falha sem perda do pedido;
   - entrega/bounce quando webhook estiver incluído;
   - mensagens que diferenciem registro, aceitação e entrega.
2. Finalizar autorização de consulta e qualquer ação operacional incluída:
   - criador visualiza o próprio pedido;
   - administrador visualiza qualquer pedido;
   - se houver reenvio nesta versão, criar nova entrega e exigir permissão específica;
   - nunca apagar ou sobrescrever tentativa anterior.
3. Cobrir o cenário integral em integração/E2E:
   - carrinho misto;
   - preço negociado permitido;
   - observação com caracteres especiais;
   - confirmação e cancelamento;
   - mudança de cotação;
   - clique duplo;
   - timeout após commit;
   - provedor indisponível;
   - recuperação após reinício;
   - destinatário duplicado;
   - usuário sem permissão;
   - isolamento entre usuários.
4. Atualizar documentação:
   - `README.md` com configuração, execução do worker e rotas;
   - `CLAUDE.md` removendo afirmações de que pedido/e-mail estão fora do escopo;
   - `docs/telas/08-pedidos.md` com confirmação, persistência e estados;
   - `.env.example` sem segredos;
   - `spec.md` com decisões finais e eventuais desvios justificados;
   - este arquivo com status e evidências de conclusão.
5. Ensaiar migration em banco descartável ou cópia segura:
   - aplicar em banco com dados existentes;
   - conferir índices, constraints e tempo;
   - validar que nenhum dado atual foi alterado;
   - confirmar estratégia não destrutiva de rollback.
6. Preparar implantação controlada:
   - publicar inicialmente com envio desabilitado;
   - validar criação, fila e renderização com adaptador de teste;
   - configurar domínio/remetente autorizado;
   - configurar `ORDER_NOTIFICATION_RECIPIENTS=nicolasbruski7@gmail.com`;
   - configurar allowlist do piloto;
   - habilitar worker/envio;
   - acompanhar erros, retentativas, bounce e duplicidade.
7. Executar teste real autorizado:
   - usuário de teste com e-mail válido;
   - produto e kit no mesmo pedido, quando disponíveis;
   - conferir assunto, HTML, texto, destinatários, observação e valores;
   - guardar apenas evidência não sensível.
8. Definir procedimento operacional curto:
   - como pausar envios sem perder pedidos;
   - como identificar entrega falha;
   - como retomar pendências;
   - como trocar o destinatário para a futura conta da Fluair;
   - como rotacionar a chave do provedor.
9. Executar quality gate completo e corrigir somente problemas relacionados ao escopo.

#### Arquivos prováveis

- testes unitários, integração e E2E;
- `README.md`;
- `CLAUDE.md`;
- `docs/telas/08-pedidos.md`;
- `.env.example`;
- `spec-envio-pedidos-email/spec.md`;
- `spec-envio-pedidos-email/tasks.md`;
- eventuais scripts de verificação sem dados sensíveis.

#### Testes e verificações

- `npm run format:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- `npm run test`;
- `npm run test:integration`;
- `npm run test:e2e`;
- inspeção visual da confirmação em desktop e viewport reduzido;
- inspeção do HTML e texto recebidos no teste real autorizado;
- confirmação de que nenhuma credencial ou dado sensível foi versionado;
- reconciliação: cada pedido confirmado possui exatamente uma primeira entrega;
- evidência dos 20 critérios de aceite da especificação.

#### Concluída quando

O fluxo completo está aprovado, documentado e implantável de forma reversível; um pedido confirmado
é persistido uma vez, enviado aos destinatários corretos e permanece recuperável e auditável mesmo
quando o serviço de e-mail falha.

#### Resultado, evidências e bloqueios (2026-09-30)

- foi concluída a consulta protegida do pedido e dos estados reais de entrega, sem expor erro
  técnico, remetente interno ou identificador do provedor; a regra é criador ou administrador;
- README, CLAUDE, documentação da tela, ambiente de exemplo, especificação e este plano agora
  descrevem confirmação, persistência, worker, estados, pausa, retomada, troca de destinatário,
  rotação de chave, implantação gradual e rollback não destrutivo;
- o quality gate local passou: `format:check`, lint, typecheck, build, 217 testes Vitest e 28 E2E;
  `prisma validate`, geração do client, diff estrutural e `git diff --check` também passaram;
- a suíte automatizada cobre os 20 critérios por contratos, migration, repositório transacional,
  confirmação E2E, idempotência, snapshots, renderer, allowlist, concorrência do worker, retries,
  recuperação de reserva, autorização e estados verdadeiros;
- a busca por padrões de credencial nos arquivos textuais versionáveis não encontrou chave de
  provedor; `.env.example` contém apenas campos vazios/exemplos não secretos;
- o ensaio visual automatizado passou em desktop e viewport reduzido nos cenários E2E de Pedidos;
- **bloqueio externo:** o Docker Desktop está instalado, mas o daemon não está ativo; por isso a
  migration ainda não pôde ser aplicada a um MySQL descartável com dados existentes;
- **bloqueio externo:** não há credencial Resend, remetente/domínio autorizado nem autorização de
  envio real no ambiente; nenhum e-mail externo foi disparado. O piloto real e a inspeção da mensagem
  recebida devem ocorrer somente após esses itens serem fornecidos e `EMAIL_DELIVERY_ENABLED=true`.

A tarefa permanece `[!]` porque o ensaio MySQL e o teste real autorizado são critérios explícitos de
conclusão e não podem ser substituídos por evidência simulada. Todo o trabalho local e automatizável
está concluído; os passos externos estão documentados no `README.md`.

## 7. Matriz de cobertura

| Área                            | Tarefa principal        | Validação final |
| ------------------------------- | ----------------------- | --------------- |
| Schema, snapshots e transação   | `TASK-001`              | `TASK-005`      |
| Cotação final e preço negociado | `TASK-002`              | `TASK-005`      |
| Idempotência de criação         | `TASK-002`              | `TASK-005`      |
| Confirmação e acessibilidade    | `TASK-003`              | `TASK-005`      |
| Template e destinatários        | `TASK-004`              | `TASK-005`      |
| Worker, retry e recuperação     | `TASK-004`              | `TASK-005`      |
| Webhook, se incluído            | `TASK-004`              | `TASK-005`      |
| Segurança e observabilidade     | `TASK-001` a `TASK-004` | `TASK-005`      |
| Documentação e implantação      | `TASK-005`              | `TASK-005`      |

## 8. Controle de escopo

Não criar tarefas separadas para:

- instalar uma dependência;
- adicionar uma variável de ambiente;
- criar uma tabela ou migration isolada;
- criar um endpoint isolado;
- criar o modal sem sua integração;
- escrever apenas o template HTML;
- adicionar uma categoria de teste;
- atualizar um documento;
- corrigir falha encontrada dentro de uma tarefa ainda aberta.

Esses trabalhos pertencem às entregas verticais já definidas. Se uma descoberta exigir uma tarefa
adicional, registrar antes:

1. por que ela é independente;
2. por que não cabe nas cinco tarefas existentes;
3. dependências;
4. risco de adiar;
5. impacto no escopo e nos critérios de aceite.

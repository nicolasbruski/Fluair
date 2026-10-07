# Especificação — Registro e envio de pedidos por e-mail

## 1. Status do documento

- Status: implementação local concluída; piloto real e ensaio em MySQL descartável bloqueados por infraestrutura externa.
- Data: 2026-09-30.
- Próxima etapa: ativar o Docker para o ensaio da migration e fornecer credenciais/remetente autorizado para o piloto controlado.
- Escopo entregue: confirmação, persistência idempotente, consulta protegida, fila, renderer e worker; webhook permanece adiado.

## 2. Objetivo

Evoluir a tela de Pedidos para que a ação **Gerar pedido**:

1. revalide o carrinho no servidor;
2. apresente uma confirmação completa antes de produzir qualquer efeito;
3. registre um pedido definitivo, rastreável e imutável;
4. agende o envio do pedido por e-mail sem depender da disponibilidade imediata do provedor;
5. entregue o e-mail ao usuário autenticado que gerou o pedido e ao destinatário operacional
   configurado;
6. mostre ao usuário o número do pedido e o estado real do envio.

A implementação deve privilegiar simplicidade operacional, segurança, prevenção de duplicidades e
recuperação após falhas.

## 3. Contexto atual

- A tela `/pedidos/novo` já monta um carrinho com cliente, produtos avulsos, kits, quantidades,
  preços e observação.
- `POST /api/v1/orders/quote` já revalida cliente, classificações, listas, versões, faixas, vínculos,
  itens e valores de referência.
- A ação atual chamada **Gerar pedido** produz apenas uma cotação; ela não persiste um pedido.
- O preço negociado editado pelo usuário permanece apenas no estado do navegador.
- O cadastro do usuário já possui e-mail normalizado e único.
- O cadastro do cliente ainda não possui contatos de e-mail.
- O projeto já possui autenticação por sessão, permissões, `requestId`, auditoria e logs estruturados.
- Ainda não existe provedor, remetente ou infraestrutura de fila de e-mail.

## 4. Decisões confirmadas

1. Clicar em **Gerar pedido** não envia imediatamente o e-mail.
2. Após a validação do servidor, deve aparecer uma tela de confirmação.
3. Somente **Confirmar e enviar pedido** pode registrar o pedido e solicitar o envio.
4. Cancelar ou fechar a confirmação não persiste pedido e não envia e-mail.
5. O e-mail deve ser destinado ao usuário autenticado que confirmou o pedido.
6. Nesta fase, o e-mail também deve ser destinado a `nicolasbruski7@gmail.com`.
7. O endereço operacional não deve ficar fixo no código; deve vir de configuração de ambiente para
   ser substituído posteriormente por um endereço da Fluair.
8. Se o e-mail do usuário for igual ao destinatário operacional, deve haver apenas um destinatário.
9. O remetente é uma identidade técnica configurada no servidor e não o endereço do usuário.
10. O pedido deve ser salvo antes de qualquer tentativa de comunicação com o provedor.
11. Falha de e-mail não pode apagar, desfazer nem duplicar o pedido.
12. A primeira versão usará corpo HTML e alternativa em texto simples, sem PDF anexado.
13. O envio ao endereço do cliente está fora desta primeira versão.

## 5. Glossário e estados

### 5.1 Pedido

Registro comercial criado depois da confirmação explícita. Contém uma fotografia dos dados exibidos
e validados no momento da emissão.

Estados iniciais:

- `SUBMITTED`: pedido registrado e apto a ser enviado;
- `CANCELLED`: reservado para cancelamento futuro; a primeira entrega não precisa oferecer a ação.

O estado comercial do pedido não deve ser misturado ao estado de entrega do e-mail.

### 5.2 Entrega de e-mail

Registro de uma solicitação de envio referente a um pedido.

Estados:

- `PENDING`: aguardando processamento;
- `PROCESSING`: reservado por um worker;
- `ACCEPTED`: aceito pelo provedor;
- `DELIVERED`: entregue ao servidor do destinatário, quando houver evento do provedor;
- `FAILED`: tentativas automáticas esgotadas ou erro permanente;
- `BOUNCED`: devolvido pelo servidor de destino, quando houver evento do provedor.

`ACCEPTED` não deve ser apresentado como confirmação de leitura ou entrega final.

### 5.3 Destinatário operacional

Endereço configurado no ambiente para receber cópia de todos os pedidos. Valor inicial de produção
ou homologação autorizada nesta fase: `nicolasbruski7@gmail.com`. O nome da variável não deve
conter referência pessoal, permitindo a futura troca pelo endereço da Fluair sem alteração de código.

## 6. Escopo

### 6.1 Incluído

- confirmação visual obrigatória antes da criação;
- persistência do pedido e de seus itens;
- snapshots dos dados necessários para reproduzir o pedido;
- registro dos destinatários usados em cada entrega;
- envio assíncrono por provedor encapsulado;
- fila persistente no MySQL, sem Redis ou broker adicional;
- retentativas limitadas e idempotentes;
- estado visível de pedido e envio;
- auditoria de criação, aceitação, falha e reenvio;
- destinatário do usuário emissor e destinatário operacional configurável;
- template HTML e texto simples;
- testes unitários, integração e E2E do fluxo crítico;
- configuração segura de desenvolvimento, teste e produção.

### 6.2 Fora de escopo

- envio para contatos do cliente;
- cadastro de contatos do cliente;
- PDF ou planilha anexada;
- assinatura eletrônica;
- aprovação comercial em múltiplas etapas;
- edição do pedido depois da confirmação;
- faturamento, separação, expedição ou integração com ERP;
- confirmação de leitura;
- campanhas ou e-mails em massa;
- cancelamento funcional na interface;
- tela administrativa completa de histórico de todos os pedidos, além do retorno/consulta mínima
  necessária ao fluxo criado.

## 7. Fluxo funcional

### 7.1 Abertura da confirmação

1. O usuário seleciona o cliente e monta o carrinho.
2. O usuário clica em **Gerar pedido**.
3. O botão é desabilitado enquanto a validação estiver em andamento.
4. O frontend envia o carrinho ao endpoint de cotação existente.
5. O backend revalida os dados e devolve a cotação atual.
6. Em caso de erro, a confirmação não abre e a tela mostra a correção necessária.
7. Em caso de sucesso, o frontend atualiza as referências retornadas e abre a confirmação.

Abrir a confirmação não persiste pedido nem agenda e-mail.

### 7.2 Conteúdo da confirmação

A confirmação deve exibir, sem campos editáveis:

- título **Confirmar envio do pedido**;
- cliente: código e razão social;
- usuário emissor: nome e e-mail;
- destinatários efetivos, já normalizados e sem duplicidade;
- itens com código, descrição, origem/lista, quantidade e preço unitário negociado;
- valor de referência identificado em todos os itens, mesmo quando igual ao preço negociado;
- IPI e ICMS informativos para produtos avulsos;
- subtotal por linha;
- quantidade total;
- valor total do pedido;
- observação completa ou indicação de ausência;
- avisos retornados pela cotação;
- mensagem de que o pedido será registrado antes do envio.

A confirmação deve ter:

- botão primário **Confirmar e enviar pedido**;
- botão secundário **Voltar e revisar**;
- fechamento por `Esc` e controle de foco acessível;
- bloqueio contra confirmação repetida enquanto a requisição estiver em andamento.

### 7.3 Confirmação definitiva

1. O usuário aciona **Confirmar e enviar pedido**.
2. O frontend envia cliente, linhas, preços negociados, observação e uma chave idempotente.
3. O backend identifica o usuário exclusivamente pela sessão autenticada.
4. O backend recarrega e revalida todas as fontes de verdade.
5. Se a cotação tiver mudado desde a abertura da confirmação, a operação é recusada sem criar pedido;
   a tela deve informar a mudança, atualizar os valores e pedir nova confirmação.
6. Se estiver válida, uma única transação cria pedido, itens, entrega pendente e auditoria.
7. A API retorna o número do pedido e `emailStatus: PENDING` sem aguardar o provedor.
8. A tela informa que o pedido foi registrado e que o envio está sendo processado.

### 7.4 Processamento do e-mail

1. Um worker consulta entregas `PENDING` cuja próxima tentativa já esteja liberada.
2. O worker reserva uma entrega de forma concorrente e recuperável.
3. O conteúdo é renderizado somente a partir do snapshot persistido.
4. O provedor recebe uma chave idempotente derivada da entrega.
5. Em sucesso, o identificador do provedor e `ACCEPTED` são persistidos.
6. Em falha transitória, a entrega volta a aguardar com atraso crescente.
7. Em falha permanente ou após o limite, fica `FAILED`.
8. Se o provedor oferecer webhook, eventos válidos atualizam `DELIVERED` ou `BOUNCED`.

## 8. Requisitos funcionais — confirmação

### RF-CON-001 — Confirmação obrigatória

Nenhum pedido ou entrega pode ser criado apenas pelo clique em **Gerar pedido**. A ação definitiva
exige a confirmação explícita do usuário.

### RF-CON-002 — Revalidação antes da confirmação

A confirmação deve usar o resultado mais recente da cotação server-side, e não os valores de
referência mantidos somente no navegador.

### RF-CON-003 — Revisão completa

Todos os dados comerciais que aparecerão no e-mail devem estar disponíveis para revisão antes da
confirmação, inclusive destinatários, preços negociados e observação.

### RF-CON-004 — Mudança durante a revisão

Se cliente, carrinho, quantidades, preços ou observação forem alterados depois da cotação usada para
abrir a confirmação, a confirmação anterior deve ser invalidada e gerada novamente.

### RF-CON-005 — Mudança no servidor

Se lista, versão, classificação, faixa, item ou preço de referência mudar antes da confirmação
definitiva, o backend deve rejeitar o snapshot desatualizado. Nenhum e-mail deve ser agendado até o
usuário revisar os novos valores.

### RF-CON-006 — Estados da interface

A interface deve diferenciar claramente: validando, aguardando confirmação, registrando, pedido
registrado com envio pendente e falha antes do registro.

## 9. Requisitos funcionais — pedido

### RF-PED-001 — Criação transacional

Pedido, itens, primeira entrega e auditoria de criação devem ser gravados na mesma transação.

### RF-PED-002 — Número legível

Cada pedido deve possuir identificador UUID interno e número legível único. O formato inicial pode
ser `PED-AAAA-NNNNNN`, desde que seja gerado no servidor sem colisão e sem depender de contagem feita
no navegador.

### RF-PED-003 — Snapshot do cliente

O pedido deve preservar pelo menos identificador, código, razão social, CNPJ, cidade, estado, classe
e segmento conhecidos no momento da confirmação.

### RF-PED-004 — Snapshot do emissor

O pedido deve preservar identificador, nome e e-mail do usuário autenticado. Mudanças futuras na
conta não alteram o pedido antigo nem seus destinatários históricos.

### RF-PED-005 — Snapshot dos itens

Cada linha deve preservar tipo, fonte/versionamento, código, descrição, referência, quantidade,
preço de referência, preço negociado, impostos informativos e subtotal.

### RF-PED-006 — Totais server-side

Subtotais, quantidade total e total monetário devem ser calculados novamente no backend com
aritmética decimal. Totais enviados pelo navegador não são fonte de verdade.

### RF-PED-007 — Observação

A observação deve ser normalizada, limitada e armazenada no pedido. Ela não pode ser interpretada
como HTML no e-mail.

### RF-PED-008 — Imutabilidade

Depois de `SUBMITTED`, os dados comerciais do pedido não podem ser sobrescritos. Correções futuras
devem gerar revisão ou novo pedido, fora do escopo inicial.

### RF-PED-009 — Idempotência

Repetir a confirmação com a mesma chave e o mesmo conteúdo deve devolver o pedido já criado. Usar a
mesma chave com conteúdo diferente deve ser rejeitado.

## 10. Regra de preço negociado

O preço enviado no e-mail é o preço negociado mostrado na confirmação. Para não confiar no
navegador, o backend deve:

1. resolver novamente o item e seu preço de referência;
2. receber o preço negociado como decimal por linha;
3. rejeitar valor inválido, negativo ou com precisão acima da permitida;
4. persistir preço de referência e negociado separadamente;
5. calcular o subtotal pelo preço negociado;
6. registrar na auditoria quando houver diferença;
7. nunca substituir silenciosamente o negociado pelo preço de referência.

Decisão comercial ainda necessária antes da implementação definitiva:

- definir se qualquer usuário com `order.access` pode informar valor abaixo da referência mínima;
- ou se valor abaixo do mínimo exige permissão/aprovação adicional.

Até essa decisão, o padrão seguro de implementação deve bloquear preço negociado abaixo do menor
valor de referência permitido e explicar o motivo. Preços iguais ou superiores podem ser enviados e
ficam auditados.

## 11. Requisitos funcionais — destinatários e conteúdo

### RF-EML-001 — Destinatários

A primeira entrega deve conter, no campo `To`, a união normalizada de:

- e-mail snapshot do usuário que confirmou o pedido;
- variável de ambiente `ORDER_NOTIFICATION_RECIPIENTS`.

O valor inicial deve conter `nicolasbruski7@gmail.com`. A configuração deve aceitar uma lista curta
separada por vírgulas para futura operação da Fluair.

### RF-EML-002 — Deduplicação

Comparações de destinatários devem ignorar caixa e espaços externos. Um endereço repetido deve
receber somente uma cópia por entrega.

### RF-EML-003 — Remetente

O campo `From` deve vir de `EMAIL_FROM` e usar domínio autorizado no provedor. O endereço do usuário
não pode ser usado como remetente por entrada do navegador.

### RF-EML-004 — Resposta

`Reply-To` pode usar um endereço corporativo configurado. O e-mail pessoal do usuário só deve ser
usado como `Reply-To` se a política da Fluair autorizar explicitamente.

### RF-EML-005 — Assunto

Formato inicial: `Pedido <numero> — <codigoCliente> — <razaoSocial>`. O assunto deve ser sanitizado
contra quebras de linha e injeção de cabeçalho.

### RF-EML-006 — Corpo

O e-mail deve ter versões HTML e texto simples com os mesmos dados essenciais da confirmação. Todo
conteúdo originado de usuário ou banco deve ser escapado.

### RF-EML-007 — Origem persistida

O template deve receber apenas dados do pedido persistido. Não deve receber diretamente o corpo da
requisição HTTP que criou o pedido.

### RF-EML-008 — Sem anexos na primeira versão

O pedido completo deve estar no corpo. Imagens do catálogo e arquivos de origem não devem ser
anexados nem embutidos.

## 12. Requisitos funcionais — entrega e recuperação

### RF-DLV-001 — Fila persistente

A entrega deve ser persistida no MySQL antes do processamento. Não usar fila somente em memória.

### RF-DLV-002 — Processamento concorrente

Dois workers ou duas iterações não podem enviar simultaneamente a mesma entrega. A reserva deve ter
prazo para recuperação caso o processo termine durante `PROCESSING`.

### RF-DLV-003 — Retentativas

Erros transitórios devem usar atraso crescente com pequeno jitter. Sugestão inicial: no máximo cinco
tentativas dentro de 24 horas. Erros permanentes de validação não devem ser repetidos.

### RF-DLV-004 — Idempotência no provedor

Quando suportado, cada tentativa deve reutilizar uma chave estável baseada no identificador da
entrega. A idempotência local continua obrigatória mesmo que o provedor também a ofereça.

### RF-DLV-005 — Reenvio manual

Um reenvio futuro ou administrativo deve criar nova entrega vinculada ao mesmo pedido, com nova
chave idempotente e auditoria. Não deve apagar nem reutilizar o histórico anterior.

### RF-DLV-006 — Resultado para o usuário

A resposta da criação informa que o pedido foi registrado e que o envio está pendente. A interface
não deve afirmar “e-mail entregue” com base apenas na criação do pedido ou aceitação pelo provedor.

### RF-DLV-007 — Webhook

Se habilitado, o webhook deve validar assinatura, tolerar eventos repetidos e desconhecidos e nunca
alterar outro pedido apenas com identificadores fornecidos sem validação.

## 13. Modelo de dados conceitual

Os nomes finais podem seguir as convenções Prisma existentes, desde que preservem as regras.

### 13.1 `Order`

- `id` UUID;
- `number` único;
- `status`;
- `customerId` para rastreio, com exclusão restrita;
- snapshots de cliente;
- `createdByUserId`, com exclusão restrita;
- snapshots de nome e e-mail do emissor;
- `note`;
- `totalQuantity`;
- `totalAmount` decimal;
- `idempotencyKey` única por usuário/escopo;
- `contentHash` para detectar reutilização divergente;
- `submittedAt`, `createdAt`, `updatedAt`.

### 13.2 `OrderItem`

- `id`, `orderId`, `lineNumber`;
- `kind`: produto avulso ou kit;
- IDs de origem aplicáveis;
- snapshots de lista e versões;
- código, descrição e referência;
- quantidade inteira;
- preço unitário de referência;
- preço unitário negociado;
- subtotal decimal;
- IPI e ICMS informativos;
- referência mínima/normal para kit, quando aplicável.

### 13.3 `OrderEmailDelivery`

- `id`, `orderId`;
- `status`;
- `toRecipients` em snapshot estruturado;
- remetente e `replyTo` usados;
- versão do template;
- chave idempotente única;
- provedor e identificador externo;
- contagem de tentativas;
- próxima tentativa;
- início e expiração da reserva;
- erro público resumido e código técnico sanitizado;
- `acceptedAt`, `deliveredAt`, `failedAt`, `bouncedAt`;
- `createdAt`, `updatedAt`.

O corpo HTML completo não precisa ser persistido se puder ser reproduzido deterministicamente a
partir do snapshot e da versão do template. Não persistir segredo ou resposta bruta desnecessária do
provedor.

## 14. Contratos HTTP propostos

### 14.1 Cotação para confirmação

Manter `POST /api/v1/orders/quote` e acrescentar à resposta:

- `quoteToken` ou fingerprint opaco com validade curta;
- referências necessárias para detectar mudança;
- destinatários previstos;
- indicação estruturada de diferenças de preço negociado.

O token não substitui a revalidação final.

### 14.2 Criar e agendar

`POST /api/v1/orders`

Entrada conceitual:

- `customerId`;
- linhas com identificadores de origem, quantidade e preço negociado;
- `note`;
- `quoteToken`;
- header `Idempotency-Key` gerado pelo frontend para aquela confirmação.

Resposta `201 Created`:

- `order.id` e `order.number`;
- `order.status`;
- `emailDelivery.id` e estado `PENDING`;
- destinatários mascarados ou completos conforme a necessidade da tela autenticada.

Repetição idempotente pode retornar `200 OK` com o mesmo recurso.

### 14.3 Consultar resultado

`GET /api/v1/orders/:id`

- exige autenticação e autorização;
- retorna snapshot do pedido e resumo das entregas;
- usuários comuns devem acessar apenas pedidos compatíveis com a política definida para seu papel;
- administradores podem consultar qualquer pedido.

### 14.4 Webhook do provedor

`POST /api/v1/email-events/<provider>`

- rota sem sessão de usuário, protegida por assinatura do provedor;
- limite de corpo e tipo de conteúdo;
- deduplicação por identificador do evento;
- resposta rápida após persistência do evento necessário.

## 15. Autorização e auditoria

### 15.1 Permissões

- Criar pedido: `order.access` e `price.view`, mantendo as validações atuais.
- Consultar o pedido recém-criado: permitido ao criador e a administradores.
- Reenviar: preferencialmente nova permissão `order.email.retry`; se não houver interface de reenvio
  na primeira entrega, o endpoint também pode ficar fora dela.
- Processamento interno e webhook não usam permissões de usuário, mas credenciais técnicas próprias.

### 15.2 Eventos auditáveis

- `ORDER_SUBMITTED`;
- `ORDER_EMAIL_ACCEPTED`;
- `ORDER_EMAIL_FAILED`;
- `ORDER_EMAIL_DELIVERED`, quando disponível;
- `ORDER_EMAIL_BOUNCED`, quando disponível;
- `ORDER_EMAIL_RETRY_REQUESTED`, quando o reenvio existir.

A auditoria deve referenciar pedido, entrega, ator quando houver, `requestId` e metadados mínimos.
Não armazenar corpo completo do e-mail, chave do provedor ou resposta sensível em `AuditLog`.

## 16. Configuração

Variáveis propostas:

- `EMAIL_PROVIDER`: adaptador ativo;
- `EMAIL_API_KEY`: segredo do provedor;
- `EMAIL_FROM`: nome e endereço remetente autorizado;
- `EMAIL_REPLY_TO`: opcional;
- `ORDER_NOTIFICATION_RECIPIENTS`: inicialmente `nicolasbruski7@gmail.com`;
- `EMAIL_DELIVERY_ENABLED`: chave de segurança operacional;
- `EMAIL_ALLOWED_RECIPIENT_DOMAINS` ou `EMAIL_ALLOWED_RECIPIENTS`: proteção de não produção;
- `EMAIL_WEBHOOK_SECRET`: quando aplicável;
- parâmetros limitados de tentativas e polling, caso realmente precisem ser configuráveis.

Regras:

- segredos não entram em `.env.example`, logs, banco ou respostas;
- `.env.example` documenta apenas nomes e exemplos não secretos;
- em testes, usar adaptador em memória;
- em desenvolvimento, entrega real deve vir desabilitada por padrão;
- quando desabilitada, pedidos podem ser criados com entrega pendente/simulada sem contato externo;
- produção deve falhar na inicialização se envio estiver habilitado e configuração obrigatória faltar.

## 17. Segurança e privacidade

1. O servidor define usuário, remetente, snapshots e totais confiáveis.
2. E-mails são validados e normalizados antes de persistir e enviar.
3. Assunto, headers, HTML e texto devem impedir injeção.
4. Observações e descrições nunca são HTML confiável.
5. Logs devem ocultar chave, headers de autorização e conteúdo pessoal desnecessário.
6. O worker não deve registrar o corpo completo do pedido em erros.
7. Homologação/desenvolvimento devem possuir allowlist para impedir envio acidental.
8. O domínio remetente deve ser autenticado com SPF e DKIM; DMARC deve ser configurado conforme o
   domínio definitivo da Fluair.
9. Webhooks devem validar assinatura usando o corpo no formato exigido pelo provedor.
10. Rotas devem manter proteção de origem, limites de JSON e `Cache-Control: no-store` aplicáveis.
11. Pedidos e entregas devem seguir política futura de retenção e LGPD; não duplicar dados pessoais
    além do necessário para o registro comercial.

## 18. Arquitetura recomendada

### 18.1 Componentes

- `OrdersService`: valida e cria o snapshot transacional.
- repositório de pedidos: encapsula a transação e consultas.
- `OrderEmailRenderer`: gera HTML e texto a partir do snapshot.
- `EmailProvider`: interface pequena e independente do fornecedor.
- adaptador real do provedor e adaptador de teste.
- `OrderEmailWorker`: reserva, envia e reagenda entregas.
- endpoint de webhook opcional conforme o provedor selecionado.

### 18.2 Processo do worker

Para manter a primeira versão simples, o worker pode rodar no mesmo processo Node da API, desde que:

- a fila esteja no banco;
- o polling não bloqueie o servidor;
- exista bloqueio/reserva concorrente;
- o shutdown aguarde ou libere processamento com segurança;
- testes possam usar relógio e provedor controlados;
- posteriormente ele possa ser extraído para outro processo sem mudar o domínio.

Não adicionar Redis, RabbitMQ ou serviço de filas nesta fase.

## 19. Template inicial

### 19.1 Assunto

`Pedido PED-2026-000001 — CLI001 — Razão Social`

### 19.2 Estrutura do HTML

1. cabeçalho simples da Fluair;
2. número e data do pedido;
3. cliente;
4. emissor;
5. tabela de itens;
6. quantidade e total;
7. observações;
8. rodapé informando que o e-mail foi gerado automaticamente.

O HTML deve usar estilos inline simples e não depender de JavaScript, fontes externas ou imagens
remotas. A versão texto deve permanecer legível e completa.

## 20. Tratamento de falhas

| Situação                        | Resultado esperado                                       |
| ------------------------------- | -------------------------------------------------------- |
| Cotação inválida                | Não abre confirmação e não cria pedido                   |
| Usuário fecha a confirmação     | Nenhum efeito persistente                                |
| Clique duplo em confirmar       | Um único pedido e uma única primeira entrega             |
| Timeout da API após commit      | Repetição devolve o mesmo pedido                         |
| Alteração de preço/lista        | Bloqueia, atualiza revisão e exige nova confirmação      |
| Provedor indisponível           | Pedido permanece salvo; entrega é reagendada             |
| Processo reiniciado             | Entrega pendente continua no banco                       |
| Worker interrompido             | Reserva expira e entrega volta a ser processável         |
| E-mail inválido na conta        | Criação bloqueada com mensagem acionável antes do commit |
| Endereço operacional inválido   | Aplicação falha na configuração, sem envio parcial       |
| Um dos destinatários é repetido | Apenas uma cópia é enviada                               |
| Falha permanente                | Entrega fica `FAILED`; pedido permanece `SUBMITTED`      |
| Evento repetido do webhook      | Atualização idempotente                                  |

## 21. Requisitos não funcionais

### RNF-001 — Consistência

Pedido e primeira entrega devem existir juntos ou não existir.

### RNF-002 — Desempenho percebido

A confirmação deve abrir após a cotação normal. A criação não deve aguardar a chamada ao provedor;
em condições normais, deve depender apenas das validações e da transação do banco.

### RNF-003 — Observabilidade

Logs estruturados devem correlacionar `requestId`, `orderId`, `deliveryId`, tentativa e identificador
do provedor, sem expor conteúdo sensível.

### RNF-004 — Portabilidade

Trocar o provedor deve exigir novo adaptador e configuração, não alteração nas regras de pedido.

### RNF-005 — Testabilidade

Relógio, gerador de identificadores e provedor devem ser controláveis nos testes críticos.

### RNF-006 — Acessibilidade

A confirmação deve controlar foco, possuir rótulos, funcionar por teclado e anunciar erros/estados.

### RNF-007 — Compatibilidade

O catálogo, cálculo de valores, imagens e montagem atuais devem continuar funcionando. A ação final
é a parte evoluída.

## 22. Estratégia de testes

### 22.1 Unitários

- normalização e deduplicação de destinatários;
- cálculo decimal e snapshots;
- hash/idempotência;
- regra de preço negociado;
- escape e renderização HTML/texto;
- classificação de erros e cálculo de retentativa;
- transições permitidas dos estados de entrega.

### 22.2 Integração

- criação atômica de pedido, itens, entrega e auditoria;
- rejeição de cotação alterada;
- repetição da mesma chave e conflito de conteúdo;
- autorização pelo usuário autenticado;
- worker reservando uma única entrega;
- recuperação de reserva expirada;
- sucesso, falha transitória e falha permanente do provedor falso;
- webhook válido, inválido e repetido;
- snapshot preservado após mudanças no cliente, usuário ou lista.

### 22.3 E2E

- **Gerar pedido** abre confirmação e não envia;
- confirmação mostra dados, observação e destinatários corretos;
- **Voltar e revisar** não cria pedido;
- alteração do carrinho invalida confirmação antiga;
- confirmação repetida não duplica;
- sucesso mostra número e envio pendente/aceito sem afirmar entrega indevida;
- erro anterior ao commit mantém o carrinho para correção;
- navegação por teclado e bloqueio do botão durante submissão.

### 22.4 Teste controlado real

Depois das suítes automatizadas:

1. habilitar o provedor somente em ambiente autorizado;
2. restringir destinatários ao usuário de teste e `nicolasbruski7@gmail.com`;
3. enviar um pedido com produto, kit, observação e preço negociado permitido;
4. conferir HTML, texto, assunto, destinatários e valores;
5. simular indisponibilidade e confirmar retentativa sem duplicação;
6. registrar evidência sem versionar dados sensíveis.

## 23. Critérios de aceite

1. Clicar em **Gerar pedido** apenas valida e abre a confirmação.
2. A confirmação mostra todos os dados que serão enviados.
3. Cancelar a confirmação não cria pedido nem entrega.
4. Confirmar cria pedido, itens, entrega e auditoria atomicamente.
5. O pedido guarda snapshots e continua igual após alterações cadastrais.
6. Totais e referências são recalculados no backend.
7. Uma mudança ocorrida durante a revisão exige nova confirmação.
8. O preço negociado efetivo aparece no snapshot, total e e-mail.
9. O e-mail inclui o usuário emissor e `nicolasbruski7@gmail.com`, sem duplicidade.
10. O destinatário operacional pode ser trocado por ambiente sem alterar código.
11. O remetente não pode ser controlado pelo navegador.
12. Clique duplo, timeout e repetição não duplicam pedido ou primeira entrega.
13. Indisponibilidade do provedor não perde nem desfaz pedido.
14. Reinicialização não perde entregas pendentes.
15. O corpo vem exclusivamente do pedido persistido e possui HTML seguro e texto simples.
16. O usuário recebe número do pedido e estado verdadeiro do processamento.
17. Logs e auditoria não expõem chaves nem corpo completo.
18. Testes automatizados cobrem confirmação, persistência, idempotência, worker e falhas.
19. Desenvolvimento e homologação não enviam para destinatários externos fora da allowlist.
20. A documentação deixa de afirmar que persistência e e-mail estão fora do escopo quando a entrega
    for concluída.

## 24. Implantação e rollback

### 24.1 Implantação

1. aplicar migração de pedidos e entregas;
2. publicar aplicação com envio real desabilitado;
3. validar criação, fila e renderização com adaptador de teste;
4. configurar e validar domínio/remetente no provedor;
5. configurar `ORDER_NOTIFICATION_RECIPIENTS=nicolasbruski7@gmail.com`;
6. habilitar allowlist do piloto;
7. habilitar worker e envio real;
8. acompanhar falhas, duplicidade, bounce e latência;
9. trocar futuramente o destinatário pela conta da Fluair apenas por configuração.

### 24.2 Rollback

- Desabilitar o envio por configuração sem apagar pedidos ou entregas.
- Manter as tabelas e dados criados mesmo se a interface voltar temporariamente ao fluxo anterior.
- Não reverter migração destrutivamente em produção.
- Entregas pendentes devem permanecer pausadas e poder ser retomadas após correção.

## 25. Decisões de implementação

Decisões fechadas na `TASK-001`:

1. o número legível usa `PED-AAAA-NNNNNN`, com sequência anual reservada atomicamente no MySQL;
2. quantidades, alíquotas e valores monetários preservam quatro casas decimais; subtotais e total
   usam precisão ampliada para não estourar ao multiplicar os limites aceitos pela API;
3. o pedido nasce em `SUBMITTED` e sua primeira entrega nasce em `PENDING`; estado comercial e
   estado da comunicação permanecem independentes;
4. decisão histórica substituída por `spec-aprovacao-preco-pedido/spec.md`: preço abaixo do mínimo
   da lista/faixa escolhida continua bloqueado até uma aprovação explícita, seguida de nova cotação;
5. snapshots de pedidos e entregas são mantidos por prazo indeterminado até a Fluair definir uma
   política formal de retenção/LGPD; as relações novas usam exclusão restritiva e a migration não
   cria cascatas capazes de apagar histórico comercial.

Decisões fechadas na `TASK-004`:

1. o provedor inicial é o Resend, acessado somente pelo SDK oficial e encapsulado pela interface
   interna `EmailProvider`; a chave idempotente persistida acompanha toda tentativa da mesma entrega;
2. o nome inicial do remetente é `Fluair` e o endereço vem obrigatoriamente de `EMAIL_FROM`; enquanto
   não houver domínio autorizado, a entrega real permanece desabilitada e nenhum endereço de teste
   é tratado como remetente de produção;
3. a primeira versão termina sua observação em `ACCEPTED` ou `FAILED`; webhook e as transições para
   `DELIVERED`/`BOUNCED` ficam adiados até existir domínio e endpoint configurados no provedor;
4. o worker roda no processo da API, usa reserva persistente de cinco minutos e faz no máximo cinco
   tentativas em menos de 24 horas, com backoff crescente e jitter;
5. `EMAIL_DELIVERY_ENABLED=false` é o padrão. Fora de produção, habilitar entrega também exige
   `EMAIL_ALLOWLIST`, aceita como lista de endereços ou domínios explícitos.

Essas decisões não alteram a obrigação de confirmação, persistência, idempotência e destinatários
definida neste documento.

## 26. Diretriz para o futuro `tasks.md`

O planejamento deve usar poucas tarefas verticais, e não uma tarefa por arquivo, tabela ou endpoint.
A meta recomendada é de quatro a seis tarefas, cobrindo:

1. domínio, schema, migração e criação idempotente;
2. confirmação completa no frontend;
3. renderização, provedor, fila e worker;
4. estados, recuperação, auditoria e webhook quando incluído;
5. testes integrados, implantação segura e documentação.

Cada tarefa deve incluir seus próprios contratos, validações, testes e atualização documental. Não
criar microtarefas separadas para instalar pacote, adicionar variável, escrever um teste isolado ou
alterar um único arquivo.

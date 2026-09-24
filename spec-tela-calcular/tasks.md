# Tasks — Listas de preço por classe e segmento

## 1. Objetivo

Decompor a implementação descrita em `spec-tela-calcular/spec.md` em entregas coesas, ordenadas e
verificáveis, usando itens de escopo internos para preservar o detalhamento.

Este arquivo não autoriza ampliar o escopo para persistência completa, emissão, aprovação ou envio de pedidos. A parte de Pedidos coberta aqui termina na montagem do carrinho com catálogo real e cotação validada pelo backend.

## 2. Convenções

- `[ ]`: não iniciada;
- `[~]`: em andamento;
- `[x]`: concluída e verificada;
- cada tarefa deve produzir somente o recorte descrito;
- não misturar refatorações sem relação com a tarefa;
- preservar dados, versões e relacionamentos existentes;
- executar os testes indicados antes de marcar uma tarefa como concluída;
- atualizar esta lista quando uma dependência técnica real for descoberta;
- requisitos citados como `RF-*` referenciam o `spec.md` desta pasta.

## 3. Definição global de conclusão

Uma tarefa só pode ser marcada como concluída quando:

1. o comportamento descrito está implementado;
2. entradas e erros relevantes estão validados;
3. autorização é aplicada no backend quando necessária;
4. os testes indicados foram criados ou atualizados e estão passando;
5. não existem erros de TypeScript, lint ou formatação nos arquivos alterados;
6. documentação afetada não ficou contraditória;
7. nenhuma versão histórica ou dado existente foi apagado inadvertidamente.

## 4. Fase 0 — Baseline e desenho técnico

### [x] TASK-001 — Registrar o baseline automatizado

- Dependências: nenhuma.
- Requisitos: proteção geral contra regressões.
- Trabalho:
  - executar testes unitários, integração, E2E aplicáveis, typecheck e lint;
  - registrar falhas preexistentes separadamente;
  - confirmar que as planilhas de `infos-calcular/` não são carregadas por seed de produção.
- Arquivos prováveis: nenhum arquivo de produção; relatório no histórico da execução.
- Verificação: baseline conhecido antes da primeira migração.
- Concluída quando: resultados e eventuais falhas preexistentes estiverem identificados sem alterar comportamento.
- Resultado registrado em 2026-09-12:
  - `npm test`: 10 arquivos e 40 testes aprovados;
  - `npm run test:integration`: 3 arquivos e 24 testes aprovados;
  - `npm run test:e2e`: 10 testes aprovados;
  - `npm run typecheck`: aprovado;
  - `npm run lint`: aprovado;
  - `npm run format:check`: falha preexistente em `src/server/modules/users/users.routes.ts`, `src/shared/users.ts` e `tests/e2e/search.spec.ts`;
  - a busca por `infos-calcular`, `.xls` e `.xlsx` em `prisma/`, `src/` e `scripts/` não encontrou carga das planilhas de referência pelo seed nem por código de produção; `prisma/seed.ts` contém somente dados estruturais;
  - a primeira execução do Vitest dentro do sandbox falhou antes de carregar a configuração com `spawn EPERM`; a execução autorizada fora do sandbox foi aprovada integralmente;
  - o diretório fornecido não contém metadados Git disponíveis, portanto o baseline não pôde registrar commit ou estado do worktree.

### [x] TASK-002 — Definir o mapa de migração das entidades atuais

- Dependências: `TASK-001`.
- Requisitos: seções 14.9 e 21.
- Trabalho:
  - documentar como `PriceProfile`, `PriceMatrixVersion`, `PriceMatrixItem` e `KitPriceList` serão generalizados;
  - escolher nomes finais dos modelos Prisma e tabelas físicas;
  - definir como os IDs e FKs históricos serão preservados;
  - definir estratégia aditiva e possibilidade de rollback.
- Arquivos prováveis: `spec-tela-calcular/implementation-notes.md` ou comentário técnico na migração futura.
- Testes: revisão do SQL planejado contra o schema atual.
- Concluída quando: existir um mapa campo a campo sem `DROP` destrutivo ou perda de histórico.
- Resultado: mapa campo a campo, nomes finais, ordem aditiva, reconciliação e rollback registrados em `spec-tela-calcular/implementation-notes.md`. O desenho preserva os UUIDs e FKs históricos, mantém o legado durante a transição e não prevê `DROP` nesta sequência.

## 5. Fase 1 — Classes e segmentos de clientes

### [x] TASK-003 — Adicionar entidades normalizadas de classe e segmento

- Dependências: `TASK-002`.
- Requisitos: `RF-CLI-001`, `RF-CLI-003`.
- Trabalho:
  - adicionar modelos de classe e segmento com código estável, nome e situação;
  - adicionar ao cliente relações inicialmente opcionais;
  - manter o campo legado de segmento durante a transição.
- Arquivos prováveis: `prisma/schema.prisma` e nova migração Prisma.
- Testes: validar schema e geração do Prisma Client.
- Concluída quando: a migração é aditiva e clientes existentes continuam legíveis.
- Resultado: adicionados `CustomerClass` e `CustomerSegment`, com códigos únicos, nome, situação e datas. `Customer` recebeu FKs opcionais para ambas as entidades, preservando o campo textual `segment`; a migração não altera nem remove registros existentes.

### [x] TASK-004 — Criar dados estruturais das classes iniciais

- Dependências: `TASK-003`.
- Requisitos: seção 4.1 e decisão 14.
- Trabalho:
  - cadastrar códigos estáveis para Implementador, Revenda, Consumidor Final e Exportação;
  - usar `upsert` idempotente;
  - não atribuir classe desconhecida automaticamente aos clientes.
- Arquivos prováveis: `prisma/seed.ts`.
- Testes: executar o seed duas vezes sem duplicar registros.
- Concluída quando: as quatro classes existem e o seed é repetível.
- Resultado: o seed cadastra por `upsert` as classes `IMPLEMENTER`, `RESELLER`, `END_CONSUMER` e `EXPORT`, reativa e atualiza seus nomes quando já existem, não altera clientes e possui teste de repetição sem duplicidade.

### [x] TASK-005 — Migrar os segmentos existentes para identificadores estáveis

- Dependências: `TASK-003`.
- Requisitos: `RF-CLI-003`, `RF-CLI-005`, seção 21.
- Trabalho:
  - levantar os valores distintos atuais;
  - criar segmentos normalizados correspondentes;
  - preencher a nova FK quando o mapeamento for inequívoco;
  - manter nulos como não classificados;
  - produzir uma consulta ou relatório de divergências.
- Arquivos prováveis: nova migração em `prisma/migrations/` e teste de migração.
- Testes: conferir contagens antes/depois e preservar os 1.507 clientes existentes.
- Concluída quando: nenhum cliente é perdido e valores não mapeados ficam explicitamente identificados.
- Resultado: os sete valores legados não nulos foram mapeados para segmentos com códigos estáveis e a nova FK é preenchida somente quando ainda está nula. A reconciliação automatizada cobre os 1.507 clientes (1.505 classificados e 2 nulos preservados), e `scripts/customer-segment-divergences.sql` identifica valores desconhecidos, vínculos ausentes ou divergentes sem alterar dados.

### [x] TASK-006 — Evoluir os contratos compartilhados de cliente

- Dependências: `TASK-003`.
- Requisitos: `RF-CLI-001`, `RF-CLI-002`.
- Trabalho:
  - incluir classe e segmento normalizado nos tipos de resposta;
  - incluir opções de filtro necessárias;
  - manter compatibilidade temporária com consumidores do campo textual existente.
- Arquivos prováveis: `src/shared/customers.ts`.
- Testes: typecheck dos consumidores do contrato.
- Concluída quando: frontend e backend compartilham um formato inequívoco de classificação.
- Resultado: o contrato compartilhado distingue classe e segmento normalizado por ID, código, nome e situação; inclui filtros por `customerClassId` e `customerSegmentId`; e mantém temporariamente `segment` e `segments` como campos legados compatíveis. O cliente HTTP do frontend passou a reutilizar o tipo compartilhado de consulta.

### [x] TASK-007 — Atualizar validação e persistência de clientes

- Dependências: `TASK-005`, `TASK-006`.
- Requisitos: `RF-CLI-002`, `RF-CLI-004`, `RF-CLI-005`.
- Trabalho:
  - validar IDs/códigos de classe e segmento;
  - persistir as relações em criação e edição;
  - rejeitar referências inexistentes ou inativas;
  - manter os campos de comissão intactos.
- Arquivos prováveis: `src/server/modules/customers/`, repositório Prisma e rotas.
- Testes: unitários e integração para criar, editar, listar e exportar.
- Concluída quando: a API mantém classe e segmento sem quebrar os fluxos atuais.
- Resultado: criação e edição aceitam classe e segmento por UUID ou código estável, rejeitam referências inexistentes, inativas ou ambíguas e retornam as classificações normalizadas. Listagem e exportação filtram pelas novas FKs; atualizações legadas que omitem os campos preservam os vínculos, enquanto `null` os remove explicitamente. Segmento textual, vendedor, representante e campos de comissão permanecem compatíveis.

### [x] TASK-008 — Expor opções de classe e segmento pela API

- Dependências: `TASK-004`, `TASK-005`.
- Requisitos: `RF-CLI-002`, `RF-CLI-003`.
- Trabalho:
  - disponibilizar listas ativas de classes e segmentos;
  - aplicar permissão de consulta adequada;
  - ordenar por nome e usar IDs/códigos estáveis.
- Arquivos prováveis: módulo de clientes ou novo módulo de classificações, `src/server/app.ts`.
- Testes: integração de autenticação, autorização e resposta.
- Concluída quando: formulários não dependem de valores escritos manualmente.
- Resultado: `GET /api/v1/customers/classifications` retorna classes e segmentos ativos, ordenados por nome e com ID, código estável, nome e situação. O endpoint aceita `customer.view` ou `customer.manage`, rejeita sessão ausente e usuário sem permissão, e possui contrato compartilhado e cliente HTTP para uso pelos formulários.

### [x] TASK-009 — Atualizar a tela de Clientes

- Dependências: `TASK-006`, `TASK-007`, `TASK-008`.
- Requisitos: seção 16.3.
- Trabalho:
  - adicionar classe ao formulário;
  - trocar o segmento de preço por seleção normalizada;
  - mostrar classe na listagem e nos detalhes;
  - incluir classe em filtros e exportação;
  - apresentar estado “Não classificado”.
- Arquivos prováveis: `src/web/customers-page.ts`, `src/web/services/customers-api.ts`, `src/web/prototype-transform.ts`.
- Testes: atualizar `tests/e2e/customers.spec.ts`.
- Concluída quando: classe e segmento podem ser mantidos integralmente pela interface.
- Resultado: a tela carrega as classificações ativas pela API, mantém classe e segmento por seletores, exibe ambas na tabela e no formulário de edição, filtra por seus IDs e inclui os nomes normalizados no CSV. Clientes sem vínculo aparecem como “Não classificado”; estados de carregamento e erro, permissões e prevenção de envio duplicado foram preservados.

### [x] TASK-010 — Verificar compatibilidade do sistema de Comissões

- Dependências: `TASK-007`, `TASK-009`.
- Requisitos: `RF-CLI-005`.
- Trabalho:
  - confirmar leitura, criação e filtros de cliente no módulo de comissões;
  - preservar vendedor, representante e rótulo de segmento;
  - corrigir somente adaptações necessárias ao novo contrato.
- Arquivos prováveis: `src/server/modules/commissions/`, `Comissoes/sistema_comissao_v3.html` e testes existentes.
- Testes: integração de comissões e smoke test da tela.
- Concluída quando: os fluxos de comissão continuam operacionais com o novo cadastro.
- Resultado: a API de Comissões continua lendo, criando e desativando clientes com o rótulo
  legado de segmento, vendedor e representante intactos, sem depender de permissões do módulo
  de Clientes. A tela prioriza esse rótulo e usa o segmento normalizado apenas como fallback,
  ganhou filtro de clientes por segmento e ampliou a busca para os campos comerciais. A tela de
  Clientes passou a converter os segmentos normalizados conhecidos para os rótulos históricos ao
  persistir o campo de compatibilidade. Testes unitários, integração e smoke E2E cobrem leitura,
  criação e filtros com clientes legados e normalizados.

## 6. Fase 2 — Domínio geral de listas de preço

### [x] TASK-011 — Generalizar a definição de lista de preço no schema

- Dependências: `TASK-002`, `TASK-003`.
- Requisitos: `RF-LIS-001`, `RF-LIS-002`, `RF-LIS-006`.
- Trabalho:
  - representar os tipos `KIT_COMPONENT` e `STANDALONE_PRODUCT`;
  - adicionar situação e faixa mínima/máxima configuráveis;
  - preservar a referência de versão ativa;
  - impedir faixas negativas ou invertidas no domínio.
- Arquivos prováveis: `prisma/schema.prisma` e nova migração.
- Testes: validação do schema e constraints relevantes.
- Concluída quando: uma definição suporta os dois tipos sem duplicar infraestrutura de versionamento.
- Resultado: adicionado o modelo `PriceList`/`price_lists` com código único, nome, tipo
  `KIT_COMPONENT` ou `STANDALONE_PRODUCT`, situação ativa, faixa mínima/máxima opcional e referência
  anulável e única para a futura versão ativa. A migração é somente aditiva, mantém todas as tabelas
  legadas e aplica constraints para rejeitar limites negativos e faixas invertidas. A FK da versão
  ativa permanece explicitamente reservada para a criação de `price_list_versions` na `TASK-013`;
  nenhuma cópia de dados históricos foi antecipada da `TASK-014`.

### [x] TASK-012 — Adicionar associações de listas com classes e segmentos

- Dependências: `TASK-011`.
- Requisitos: `RF-LIS-003`, `RF-LIS-004`.
- Trabalho:
  - criar associação única lista/classe;
  - criar associação única lista/segmento;
  - impedir associação de classe a lista avulsa e segmento a lista de componentes no serviço de domínio.
- Arquivos prováveis: `prisma/schema.prisma`, migração e módulo de listas.
- Testes: constraints e validações de tipo.
- Concluída quando: as relações muitos-para-muitos são persistidas e validadas.
- Resultado: adicionados `PriceListClass`/`price_list_classes` e
  `PriceListSegment`/`price_list_segments`, ambos com chave primária composta para impedir
  associações duplicadas, índices reversos e FKs restritivas para as listas e classificações. O
  serviço de domínio de listas rejeita segmentos em listas `KIT_COMPONENT` e classes em listas
  `STANDALONE_PRODUCT`, com erros estáveis e indicação do campo incompatível. A migração permanece
  aditiva e não modifica listas, classes, segmentos ou estruturas legadas existentes.

## 7. Plano consolidado restante

As tarefas abaixo são as unidades de acompanhamento a partir da `TASK-013`. Cada uma incorpora os
itens de escopo indicados no título. O detalhamento integral desses itens foi preservado na seção 8
e funciona como checklist interno, não como uma nova tarefa independente.

### [x] TASK-013 — Consolidar versionamento, migração histórica e configuração inicial

- Incorpora: itens de escopo `013` a `015`.
- Dependências: `TASK-011`, `TASK-012`.
- Requisitos: `RF-VER-006`, `RF-LIS-008` e seções 5.1, 14.7, 14.8 e 14.9.
- Trabalho:
  - generalizar versões e itens para listas com e sem estrutura, preservando metadados, precisão decimal e unicidade por versão;
  - migrar matrizes, versões ativas, cálculos e FKs existentes sem alterar seus valores históricos;
  - criar de forma idempotente as listas, associações e faixas iniciais, sem inventar dados de Exportação nem importar planilhas de teste em produção;
  - registrar divergências que exijam classificação manual e manter listas sem versão ativa válidas.
- Verificação: validar schema e seed repetível; reconciliar contagens, versões, totais, IDs e relacionamentos antes/depois.
- Concluída quando: os dois formatos compartilham um histórico inequívoco, os cálculos antigos permanecem idênticos e a configuração inicial não contém valores comerciais hardcoded.
- Resultado: criados `PriceListVersion`, `PriceListItem` e `KitCalculationSeries`, com metadados do
  arquivo, `DECIMAL(15,4)`, código único por versão e formatos de preço mutuamente exclusivos. A
  migração copia perfis, versões, itens, séries e FKs de cálculo preservando UUIDs, BLOBs, totais e
  tabelas legadas; um guard aborta o corte diante de divergências e há relatório SQL somente leitura
  para investigação manual. Importações de matriz e novos cálculos mantêm escrita dupla transacional
  durante a compatibilidade. O seed idempotente cadastra as listas por classe, as listas avulsas por
  segmento e as faixas inclusivas 0–49, 50–99 e 100+, preserva versões ativas e não carrega planilhas
  ou preços. Exportação recebe apenas definições sem versão ativa ou valor inventado. Schema Prisma,
  typecheck, lint, build e 70 testes foram aprovados; o `format:check` mantém somente as três falhas
  preexistentes já registradas. O ensaio da migração em uma cópia representativa do banco permanece
  reservado ao item de escopo `053` e não foi antecipado nesta execução.

### [x] TASK-014 — Entregar domínio, API e contratos administrativos de listas

- Incorpora: itens de escopo `016` a `018`.
- Dependências: `TASK-013`.
- Requisitos: `RF-LIS-002`, `RF-LIS-005`, `RF-LIS-006`, `RF-LIS-008` e seções 17 e 18.2.
- Trabalho:
  - centralizar validações de tipo, situação, versão ativa, faixa, classe e segmento, com erros de domínio estáveis;
  - implementar consultas e mutações auditadas de definições, público, faixa, situação e versão ativa;
  - criar DTOs e cliente HTTP sem depender do enum fechado dos três perfis antigos;
  - aplicar `matrix.view` e `matrix.manage` no backend.
- Verificação: testes unitários da política, integração das rotas e permissões, testes de contrato e typecheck.
- Concluída quando: cálculo, importação, administração e pedido podem reutilizar a mesma política e o frontend consome listas dirigidas por dados.
- Resultado: a política central de listas valida existência, tipo, situação, versão ativa, faixas
  inclusivas e abertas, classe e segmento autorizados por meio de erros de domínio estáveis. A API
  `price-lists` lista definições com público, faixa, versão ativa e histórico; permite criar, editar,
  ativar, desativar e trocar ou remover a versão ativa sem excluir versões. Referências inexistentes,
  inativas, incompatíveis ou pertencentes a outra lista são rejeitadas antes da persistência. Todas
  as mutações do repositório Prisma são transacionais e geram auditoria. As consultas aceitam
  `matrix.view` ou `matrix.manage`, enquanto mutações exigem `matrix.manage`. Contratos compartilhados
  e um cliente HTTP dedicado usam IDs e códigos livres de lista, mantendo fixos somente os dois tipos
  do domínio. Typecheck, lint, build e 80 testes foram aprovados; o `format:check` permanece apenas com
  as três falhas preexistentes já registradas.

### [x] TASK-015 — Implementar e validar os parsers dos dois formatos

- Incorpora: itens de escopo `019` a `023`.
- Dependências: `TASK-013`.
- Requisitos: `RF-LIS-001`, seção 10 e estratégia de testes da decisão 14.
- Trabalho:
  - separar os contratos dos formatos `KIT_COMPONENT` e `STANDALONE_PRODUCT`, despachando pelo tipo persistido da lista;
  - reconhecer os campos e aliases aprovados de cada formato, incluindo descrição, referência, preços e IPI informativo já incluído;
  - normalizar valores brasileiros, linhas vazias e quebras de linha, preservando linha e dados brutos;
  - rejeitar duplicidade, código inválido, preço negativo ou não numérico e arquivo vazio, separando erros bloqueadores de avisos;
  - criar fixtures mínimas sanitizadas, sem preços comerciais reais.
- Verificação: testes de cada alias, erro e aviso, além das planilhas de referência somente em validação local.
- Concluída quando: os dois formatos produzem resultados inequívocos e diagnósticos acionáveis sem depender de arquivos comerciais nos testes ou no bundle.
- Resultado: o importador possui contratos distintos para componentes de kit e produtos avulsos e
  despacha exclusivamente pelo tipo persistido `KIT_COMPONENT` ou `STANDALONE_PRODUCT`. O formato
  estruturado reconhece os aliases controlados de mínimo e normal/máximo, inclusive o cabeçalho de
  teste sem títulos nas colunas de código e descrição. O formato avulso preserva código, descrição,
  referência, preço único e IPI informativo com `ipiIncluded: true`. Ambos mantêm a linha física e os
  dados brutos, normalizam números brasileiros e quebras de linha e ignoram linhas vazias. Erros
  bloqueadores agregam diagnósticos com linha, coluna e campo para código vazio/inválido ou duplicado,
  preço ausente, não numérico ou negativo e arquivo sem itens; mínimo superior ao normal permanece um
  aviso confirmável separado. Fixtures sintéticas sanitizadas cobrem os casos sem preços comerciais,
  e a validação local confirmou as quatro planilhas estruturadas e as cinco avulsas de referência.
  O adaptador legado de matrizes foi preservado e passou a fotografar a descrição na estrutura nova.
  Typecheck, lint, build e 95 testes foram aprovados; o `format:check` mantém somente as três falhas
  preexistentes documentadas.

### [x] TASK-016 — Entregar importação versionada com prévia e confirmação

- Incorpora: itens de escopo `024` e `025`.
- Dependências: `TASK-014`, `TASK-015`.
- Requisitos: `RF-VER-001` a `RF-VER-005` e seção 10.1.
- Trabalho:
  - implementar prévia protegida por `matrix.manage`, retornando hash, contagem, erros e avisos sem persistência;
  - reanalisar o arquivo na confirmação e validar o hash esperado;
  - detectar duplicidade por lista, criar versão e itens, ativar a versão e registrar auditoria na mesma transação.
- Verificação: integração para prévia válida, inválida e sem permissão; sequência de versões, duplicidade, rollback e auditoria.
- Concluída quando: prévias não causam efeitos colaterais e nenhuma falha parcial deixa versões ou itens incompletos.
- Resultado: `POST /api/v1/price-lists/:id/import/preview` reanalisa o arquivo conforme o tipo
  persistido, devolve SHA-256, metadados, contagem, erros bloqueadores e avisos confirmáveis e exige
  `matrix.manage`, sem criar versão, item, ativação ou auditoria. A confirmação recebe novamente o
  arquivo, reexecuta o parser, compara o hash esperado da prévia e rejeita conteúdo alterado ou já
  importado para a mesma lista. O repositório bloqueia a lista durante a numeração e reúne criação da
  versão imutável, arquivo original, itens, ativação e auditoria em uma única transação. Importações
  estruturadas de listas migradas também mantêm o legado sincronizado com os mesmos UUIDs durante a
  compatibilidade. Os contratos e o cliente HTTP cobrem prévia e confirmação para os dois formatos.
  Testes de integração verificam prévia válida, inválida e sem permissão, formato avulso com IPI,
  versões sequenciais, hash divergente, duplicidade, rollback integral e auditoria. Typecheck, lint,
  build e 100 testes foram aprovados; o `format:check` mantém somente as três falhas preexistentes.

### [x] TASK-017 — Entregar a administração de listas no frontend

- Incorpora: itens de escopo `026` a `028`.
- Dependências: `TASK-014`, `TASK-016`.
- Requisitos: `RF-LIS-002` a `RF-LIS-006` e seções 10.1 e 16.2.
- Trabalho:
  - reorganizar o painel em listas com e sem estrutura, mostrando nome, tipo, público, faixa, situação e versão ativa;
  - criar formulário para metadados, classe ou segmento conforme o tipo e faixa opcional;
  - integrar prévia, exibição de erros e avisos, confirmação explícita e atualização da versão ativa;
  - tratar combinações incompatíveis, upload duplicado e falhas recuperáveis.
- Verificação: E2E de listas dinâmicas, criação, edição, validação por tipo, prévia sem efeito, confirmação e erro.
- Concluída quando: qualquer lista pode ser administrada e importada sem editar seed ou código e nenhum upload é ativado sem confirmação.
- Resultado: a rota protegida `/listas` substitui o painel demonstrativo de matrizes por duas seções
  dirigidas pela API, “Kits com estrutura” e “Produtos sem estrutura”, exibindo código, nome, tipo,
  público, faixa, situação e versão ativa de qualquer definição cadastrada. Usuários com
  `matrix.manage` podem criar e editar metadados, escolher somente classes ou segmentos compatíveis
  com o tipo, configurar limites abertos ou fechados e ativar ou desativar a lista. Cada cartão recebe
  sua própria planilha e mantém arquivo e prévia associados à lista correta; quantidade, hash, erros e
  avisos são apresentados sem alteração de estado, e a importação só é enviada após o botão explícito
  de confirmação. Erros do backend, inclusive arquivo duplicado, permanecem no cartão para nova
  tentativa, e um sucesso recarrega a versão ativa. O frontend também degrada de forma recuperável se
  os públicos não puderem ser carregados. Typecheck, lint, build, 100 testes unitários/integrados e 14
  testes E2E foram aprovados; o `format:check` mantém somente as três falhas preexistentes documentadas.

### [x] TASK-018 — Migrar o fluxo completo de cálculo para listas dinâmicas

- Incorpora: itens de escopo `029` a `035`.
- Dependências: `TASK-014`, `TASK-016`, `TASK-017`.
- Requisitos: `RF-CAL-001` a `RF-CAL-009` e critérios de aceite 3 a 6 e 16.
- Trabalho:
  - trocar o perfil fixo por `priceListId` nos contratos e carregar uma lista `KIT_COMPONENT` ativa com sua versão exata;
  - manter prévia sem cliente, exigir cliente ativo ao salvar e validar sua classe novamente no backend sem troca automática de lista;
  - fotografar cliente e classificação, preservar a versão e bloquear salvamento se a versão ativa mudar após a prévia;
  - atualizar a tela Calcular, removendo botões hardcoded e mostrando lista, classe, versão e incompatibilidades;
  - preservar primeiro cálculo, recálculo, vínculo a cálculo existente, itens sem preço e totais históricos.
- Verificação: testes unitários, integração e E2E de todo o fluxo, incluindo concorrência lógica e regressões de busca/detalhe.
- Concluída quando: listas novas funcionam sem alteração de enum e mudanças futuras em lista ou cliente não alteram cálculos salvos.
- Resultado: os contratos e endpoints de cálculo agora recebem o UUID de qualquer lista
  `KIT_COMPONENT` ativa, fixam sua versão na prévia e rejeitam tipo, situação ou versão inválidos. A
  prévia continua independente de cliente e preserva aritmética decimal, itens sem preço e detecção
  do cálculo atual por série kit/lista. O salvamento exige cliente ativo, bloqueia e recarrega a lista
  dentro da transação, valida novamente a classe sem trocar a seleção e rejeita mudança da versão
  ativa. Novos cálculos usam as relações gerais de série e versão; as FKs legadas ficaram opcionais
  para permitir listas novas sem perder rollback dos dados migrados. O vínculo fotografa código e
  nome do cliente e identificador, código e nome da classe, inclusive ao associar uma versão atual sem
  duplicar sua composição. A tela removeu os três botões fixos, exige escolha manual entre listas
  utilizáveis e mostra lista, classes, versão e incompatibilidades antes do salvamento. Lint,
  typecheck, build, 108 testes unitários/integrados e os 15 testes E2E foram aprovados; o
  `format:check` mantém somente as três falhas preexistentes documentadas.

### [x] TASK-019 — Entregar catálogo e preço de produtos sem estrutura

- Incorpora: itens de escopo `036` a `038`.
- Dependências: `TASK-014`, `TASK-016`.
- Requisitos: `RF-PRO-001` a `RF-PRO-004`, `RF-PED-004`, `RF-PED-007` e `RF-PED-008`.
- Trabalho:
  - criar ou atualizar a identidade do produto pelo código na importação confirmada, preservando a fotografia de descrição e referência na versão;
  - implementar busca paginada por código, descrição e referência somente na versão ativa, com `price.view` ao retornar valores;
  - centralizar a resolução server-side de preço decimal, referência e IPI informativo já incluído, rejeitando item ausente;
  - não gravar preço global nem inferir vendabilidade pelo texto da descrição.
- Verificação: integração de produto novo/existente, atualização de descrição, busca, paginação, permissão, precisão e IPI não duplicado.
- Concluída quando: produtos são pesquisáveis e cotáveis por uma fonte versionada e rastreável.
- Resultado: a confirmação de importações `STANDALONE_PRODUCT` agora cria ou atualiza, pelo código,
  a identidade sem preço global, preserva a unidade já conhecida e mantém descrição e referência
  originais em cada item versionado. A migração torna referência e unidade opcionais na identidade,
  indexa os campos pesquisáveis e reconcilia versões avulsas anteriores usando sua aparição mais
  recente. O endpoint paginado consulta exclusivamente a versão ativa e pesquisa código, descrição
  e referência; o endpoint unitário e o serviço reutilizável devolvem lista, versão, preço decimal,
  referência, IPI informativo e `ipiIncluded: true`, sem calcular acréscimo. Ambos exigem
  `price.view`, rejeitam lista de outro tipo, inativa, sem versão e produto ausente e detectam troca
  de versão esperada. Contratos e cliente HTTP foram preparados para a integração do pedido. Lint,
  typecheck, build, 115 testes unitários/integrados e os 15 testes E2E foram aprovados; o
  `format:check` mantém somente as três falhas preexistentes documentadas.

### [x] TASK-020 — Integrar listas permitidas e catálogo misto ao pedido

- Incorpora: itens de escopo `039` a `042`.
- Dependências: `TASK-018`, `TASK-019`.
- Requisitos: `RF-PED-001` a `RF-PED-005` e preservação do comportamento atual.
- Trabalho:
  - criar consulta de listas avulsas ativas autorizadas pelo segmento atual do cliente e compatíveis com a quantidade informada, sem seleção automática;
  - carregar e exigir escolha manual da lista após selecionar o cliente, limpando-a quando o cliente mudar;
  - substituir `PEDIDO_PRODUTOS` por busca paginada do catálogo real da versão ativa;
  - integrar kits calculados compatíveis, preservando versão e referência mínima ou normal/máxima e distinguindo os tipos visualmente.
- Verificação: integração de autorização e E2E com zero, uma e várias listas, busca e carrinho misto.
- Concluída quando: o pedido oferece somente fontes reais, autorizadas e rastreáveis para o cliente atual.
- Resultado: a nova API de Pedidos recarrega o cliente ativo e filtra listas
  `STANDALONE_PRODUCT` ativas, com versão ativa, autorizadas pelo segmento normalizado e compatíveis
  com a quantidade informada. O catálogo revalida cliente, segmento, classe, lista e faixa, exige
  `order.access` e `price.view` ao retornar valores, pesquisa produtos por código, descrição e
  referência somente na versão ativa e inclui exclusivamente cálculos atuais de kits permitidos
  para a classe. A tela exige cliente antes da lista, nunca escolhe uma opção automaticamente, limpa
  lista e carrinho na troca do cliente e substituiu `PEDIDO_PRODUTOS` por paginação real. Kits e
  produtos possuem identificação visual, podem coexistir no carrinho e preservam lista, versão do
  cálculo e referência mínima, normal ou unitária. Lint, typecheck, build, 123 testes
  unitários/integrados e os 16 testes E2E foram aprovados; o `format:check` mantém somente as três
  falhas preexistentes documentadas.

### [x] TASK-021 — Centralizar quantidade, faixas e invalidações do carrinho

- Incorpora: itens de escopo `043` a `046`.
- Dependências: `TASK-014`, `TASK-020`.
- Requisitos: `RF-LIS-006`, `RF-LIS-007`, `RF-PED-005`, `RF-PED-006` e `RF-PED-009`.
- Trabalho:
  - usar uma única soma de quantidades de kits e produtos no frontend e backend;
  - validar limites inclusivos 0, 1, 49, 50, 99 e 100, lista sem faixa e limite superior aberto;
  - invalidar a lista após qualquer mudança incompatível, mantendo itens visíveis, bloqueando a cotação e exigindo nova escolha manual;
  - ao trocar o cliente, invalidar lista, itens e preços e recarregar as opções do novo segmento.
- Verificação: testes unitários de totais e limites; E2E das transições 99→100, 100→99 e troca entre segmentos.
- Concluída quando: nenhuma lista ou preço incompatível permanece válido ou é substituído silenciosamente.
- Resultado: uma função compartilhada passou a somar as quantidades de todas as linhas, sem separar
  kits e produtos avulsos, e a mesma política inclusiva de faixa é usada no navegador, na API de
  Pedidos e na política administrativa de listas. O navegador envia as quantidades individuais ao
  backend, que calcula o total em vez de confiar em um valor agregado informado pelo cliente. Foram
  cobertos carrinho vazio e misto, limites exatos `0`, `1`, `49`, `50`, `99` e `100`, lista sem faixa
  e limite superior aberto. Adição, remoção e edição reavaliam a lista; quando ela deixa de ser
  compatível, os itens permanecem visíveis, um aviso identifica a lista invalidada, catálogo e
  revisão são bloqueados, as opções são recarregadas para o novo total e nenhuma substituta é
  escolhida automaticamente. A troca de cliente invalida e limpa lista, itens e preços e consulta o
  novo segmento. Lint, typecheck, build, 134 testes unitários/integrados e os 16 testes E2E foram
  aprovados; o `format:check` mantém somente as três falhas preexistentes documentadas.

### [x] TASK-022 — Entregar cotação server-side e fluxo completo do carrinho

- Incorpora: itens de escopo `047` a `049`.
- Dependências: `TASK-019`, `TASK-020`, `TASK-021`.
- Requisitos: `RF-PED-008`, seção 15.3 e critérios de aceite 7 a 14.
- Trabalho:
  - criar endpoint que recarrega cliente, classificação, lista e versões e ignora preços enviados pelo navegador;
  - validar autorização, quantidade total e faixa, resolver kits e produtos, calcular subtotais e total com decimal e devolver versões e avisos;
  - usar a resposta do backend na ação final disponível, mostrando incompatibilidades e produtos ausentes sem persistir pedido;
  - cobrir seleção manual, lista de outro segmento, carrinho misto, mudança de faixa, IPI, troca de cliente, catálogo real e ausência de lista.
- Verificação: integração contra manipulação de preço, autorização e faixa; E2E completo da ação do pedido.
- Concluída quando: a confirmação visual usa exclusivamente uma cotação validada pelo backend e todos os critérios do carrinho estão automatizados.
- Resultado: `POST /api/v1/orders/quote` exige `order.access` e `price.view`, descarta preços e
  subtotais enviados pelo navegador e recarrega cliente ativo, classe, segmento, lista avulsa
  autorizada e sua versão ativa. A quantidade total é recalculada com todas as linhas; a faixa é
  revalidada; produtos são resolvidos por código exclusivamente na versão ativa; e kits são
  resolvidos pelo cálculo atual, classe autorizada, referência mínima ou normal e versão de origem.
  Subtotais e total usam `Prisma.Decimal`, e o IPI informativo já incluído não é somado novamente.
  Itens ausentes, desatualizados ou incompatíveis retornam diagnósticos por linha, sem persistir
  pedido. A ação “Validar cotação” envia apenas identidades e quantidades, substitui os valores
  locais pela resposta do backend, mostra versões, avisos e falhas recuperáveis e invalida a
  confirmação visual após mudanças no cliente, lista ou carrinho. Lint, typecheck, build, 140 testes
  unitários/integrados e os 16 testes E2E foram aprovados; o `format:check` mantém somente as três
  falhas preexistentes documentadas.

### [x] TASK-023 — Remover legados afetados e alinhar a documentação

- Incorpora: itens de escopo `050` a `052`.
- Dependências: `TASK-018`, `TASK-022`.
- Requisitos: critérios de aceite 1 e 9 e consistência documental.
- Trabalho:
  - remover enums, ordenações e caminhos de importação fixos já substituídos, preservando apenas adaptadores históricos necessários;
  - remover `PEDIDO_PRODUTOS` e preços fictícios do fluxo e bundle finais, mantendo estado vazio real;
  - atualizar README, CLAUDE e documentos de Clientes, Cálculo, Matrizes e Pedidos com rotas, permissões e comportamento efetivo.
- Verificação: typecheck, busca por símbolos mortos, testes de transformação e pedido e revisão de links e afirmações antigas.
- Concluída quando: listas futuras são dirigidas por dados, nenhum catálogo fictício chega ao fluxo migrado e a documentação não contradiz o sistema.
- Resultado: removidos a rota e o serviço legados `/api/v1/matrices`, o cliente HTTP correspondente,
  o enum fechado `PRICE_PROFILE_CODES` e seus contratos, além do adaptador `parseMatrixWorkbook` e
  da transformação morta anterior à migração de Pedidos. O parser canônico `KIT_COMPONENT` passou a
  ser a única entrada do formato estruturado. As tabelas antigas e as escritas duplas necessárias
  foram preservadas para histórico e rollback até o ensaio da `TASK-024`. O teste da transformação
  agora impede que `PEDIDO_PRODUTOS`, `PEDIDO_CLIENTES`, funções do carrinho antigo, códigos ou preços
  fictícios cheguem ao bundle; o build agora limpa `dist/src` antes de compilar e uma inspeção final
  confirmou a ausência de módulos ou dados órfãos em `dist`. README,
  CLAUDE e os documentos de permissões, Clientes, Cálculo, Listas e Pedidos foram alinhados às rotas,
  capacidades e limites atuais. As descrições das permissões no seed também refletem listas,
  classificações e cotação. Lint, typecheck, build, 140 testes unitários/integrados e os 16 testes
  E2E foram aprovados; o `format:check` mantém somente as três falhas preexistentes documentadas.

### [x] TASK-024 — Ensaiar a migração e executar o quality gate final

- Incorpora: itens de escopo `053` e `054`.
- Dependências: `TASK-013`, `TASK-018`, `TASK-022`, `TASK-023`.
- Requisitos: seção 21 e todos os critérios de aceite.
- Trabalho:
  - aplicar as migrações em uma cópia segura e representativa, reconciliar clientes, classificações, matrizes, versões e cálculos e ensaiar o rollback planejado;
  - registrar duração, correções e limitações remanescentes sem versionar dados sensíveis;
  - executar formatação, lint, typecheck, build, testes unitários, integração, E2E e smoke tests de Clientes, Listas, Calcular, Busca/Detalhe e Pedidos;
  - verificar permissões, auditoria, preservação histórica e os 16 critérios de aceite.
- Verificação: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:integration` e `npm run test:e2e`.
- Concluída quando: a migração é repetível sem perda ou duplicação e todas as verificações e critérios de aceite possuem evidência.
- Resultado: ensaio concluído em uma cópia MySQL 8.4 isolada, com sete migrations aplicadas em
  13,01 segundos e uma segunda aplicação sem pendências. Clientes, listas, versões, itens, séries,
  cálculos, totais e FKs foram reconciliados; o rollback por troca da aplicação manteve as leituras
  legadas válidas. Seed repetido sem duplicação, permissões e auditoria conferidas. Formatação, lint,
  typecheck, build, 140 testes unitários/integrados, 46 testes na suíte de integração dedicada e 16
  E2E foram aprovados. Evidências, correções e limitações estão em
  `spec-tela-calcular/task-024-quality-gate.md`.

## 8. Referência detalhada dos itens consolidados

Esta seção preserva o detalhamento original das antigas `TASK-013` a `TASK-054`. Seus títulos foram
convertidos em itens de escopo para que não sejam contados como tarefas independentes. Ao concluir
uma task consolidada, todos os itens que ela incorpora devem ter sido atendidos.

As dependências escritas dentro dos itens abaixo também são as referências históricas originais. Para
a execução atual, prevalecem as dependências declaradas nas `TASK-013` a `TASK-024` da seção 7.

### Itens 013–018 — Domínio geral de listas de preço

#### Item de escopo 013 — Generalizar versões e itens de lista

- Dependências: `TASK-011`.
- Requisitos: seções 14.7 e 14.8.
- Trabalho:
  - manter metadados do arquivo e versionamento existentes;
  - adicionar descrição ao item importado;
  - adicionar referência, preço único e IPI informativo;
  - tornar campos de preço condicionais ao tipo da lista;
  - manter código único por versão.
- Arquivos prováveis: `prisma/schema.prisma` e migração.
- Testes: schema, precisão decimal e unicidade.
- Concluída quando: ambos os formatos cabem no mesmo histórico versionado sem campos ambíguos.

#### Item de escopo 014 — Migrar matrizes e cálculos existentes sem perda

- Dependências: `TASK-011`, `TASK-012`, `TASK-013`.
- Requisitos: `RF-VER-006`, seção 14.9.
- Trabalho:
  - classificar perfis existentes como `KIT_COMPONENT`;
  - vincular as classes equivalentes quando seguro;
  - preservar IDs, versões ativas e FKs de cálculo;
  - não preencher Exportação com dados inventados;
  - registrar itens que exigem classificação manual.
- Arquivos prováveis: migração SQL revisada manualmente e testes de migração.
- Testes: comparar contagens, versões, totais e relacionamentos antes/depois.
- Concluída quando: cálculos históricos abrem com os mesmos valores e versões.

#### Item de escopo 015 — Criar as definições iniciais de listas como configuração

- Dependências: `TASK-012`, `TASK-014`.
- Requisitos: seção 5.1 e `RF-LIS-008`.
- Trabalho:
  - cadastrar de forma idempotente as definições iniciais aprovadas;
  - cadastrar associações de classe e segmento;
  - cadastrar faixas 0–49, 50–99 e 100+ como dados;
  - não importar automaticamente os arquivos de teste em produção;
  - permitir listas sem versão ativa.
- Arquivos prováveis: `prisma/seed.ts`.
- Testes: seed repetível e conferência das associações.
- Concluída quando: as definições existem sem valores comerciais hardcoded.

#### Item de escopo 016 — Implementar validações centrais da lista

- Dependências: `TASK-011`, `TASK-012`.
- Requisitos: `RF-LIS-005`, `RF-LIS-006`, `RF-LIS-008`.
- Trabalho:
  - validar tipo, situação e versão ativa;
  - validar faixa para uma quantidade total;
  - validar classe autorizada;
  - validar segmento autorizado;
  - retornar erros de domínio estáveis.
- Arquivos prováveis: novo módulo `src/server/modules/price-lists/` ou evolução de `matrices/`.
- Testes: unitários para listas válidas, ausentes, inativas e incompatíveis.
- Concluída quando: cálculo e pedido podem reutilizar a mesma política de autorização.

#### Item de escopo 017 — Implementar consultas e mutações administrativas de listas

- Dependências: `TASK-016`.
- Requisitos: `RF-LIS-002`, seção 18.2.
- Trabalho:
  - listar definições, público, faixa e versão ativa;
  - criar/editar metadados permitidos;
  - configurar classes e segmentos;
  - ativar/desativar a definição sem apagar versões;
  - auditar todas as mutações.
- Arquivos prováveis: serviços, repositórios e rotas do módulo de listas.
- Testes: integração com permissão `matrix.view`/`matrix.manage`.
- Concluída quando: a configuração pode ser administrada pela API com auditoria.

#### Item de escopo 018 — Criar contratos compartilhados e cliente HTTP de listas

- Dependências: `TASK-017`.
- Requisitos: seção 17.
- Trabalho:
  - definir DTOs para lista, público, faixa, versão e resumo de importação;
  - remover dependência de enum fechado de três perfis nos novos fluxos;
  - adicionar funções do frontend para consumir a API.
- Arquivos prováveis: `src/shared/pricing.ts`, `src/web/services/matrices-api.ts` ou novo `price-lists-api.ts`.
- Testes: typecheck e testes de contrato existentes.
- Concluída quando: frontend não precisa conhecer códigos fixos de listas.

### Itens 019–025 — Parsers e importação versionada

#### Item de escopo 019 — Separar os contratos dos dois parsers

- Dependências: `TASK-013`.
- Requisitos: `RF-LIS-001`, seção 10.
- Trabalho:
  - criar tipos normalizados para item com estrutura e item sem estrutura;
  - manter utilitários compartilhados de leitura e normalização;
  - despachar o parser pelo tipo persistido da lista, não pelo nome do arquivo.
- Arquivos prováveis: `src/server/modules/pricing/spreadsheet-parser.ts` e tipos do módulo.
- Testes: compilação e testes das funções comuns.
- Concluída quando: cada formato possui retorno próprio e inequívoco.

#### Item de escopo 020 — Implementar parser de lista com estrutura

- Dependências: `TASK-019`.
- Requisitos: seção 10.2.
- Trabalho:
  - reconhecer `Valor Mínimo` e aliases aprovados;
  - reconhecer `Valor Normal` e aliases aprovados;
  - ler código e descrição no formato atual de teste;
  - ignorar linhas vazias e normalizar quebras de linha;
  - preservar linha e dados brutos.
- Arquivos prováveis: `src/server/modules/pricing/spreadsheet-parser.ts`.
- Testes: arquivo sintético e as quatro planilhas de teste em validação local.
- Concluída quando: as quatro planilhas com estrutura produzem itens normalizados.

#### Item de escopo 021 — Implementar parser de lista sem estrutura

- Dependências: `TASK-019`.
- Requisitos: seção 10.3.
- Trabalho:
  - reconhecer Código, Descrição, Referência, Valor e IPI;
  - tratar IPI como taxa informativa já incluída;
  - preservar referência e descrição;
  - normalizar valores brasileiros e linhas vazias.
- Arquivos prováveis: `src/server/modules/pricing/spreadsheet-parser.ts`.
- Testes: arquivo sintético e as cinco planilhas de teste em validação local.
- Concluída quando: as cinco planilhas sem estrutura produzem itens normalizados.

#### Item de escopo 022 — Implementar erros e avisos de validação de planilha

- Dependências: `TASK-020`, `TASK-021`.
- Requisitos: seção 10.4 e seção 19.
- Trabalho:
  - rejeitar duplicidade, código inválido, preço negativo/não numérico e arquivo sem itens;
  - indicar linha e coluna quando disponível;
  - emitir aviso para mínimo maior que normal;
  - separar erros bloqueadores de avisos confirmáveis.
- Arquivos prováveis: parser, tipos compartilhados e serialização de erros.
- Testes: um caso isolado para cada erro e aviso.
- Concluída quando: o usuário recebe diagnóstico acionável sem aceitar inconsistências silenciosas.

#### Item de escopo 023 — Criar fixtures sanitizadas dos dois formatos

- Dependências: `TASK-020`, `TASK-021`.
- Requisitos: decisão 14 e estratégia de testes.
- Trabalho:
  - criar fixtures mínimas sem preços comerciais reais;
  - cobrir aliases, linhas vazias, duplicidade e IPI;
  - manter os arquivos reais fora de seeds e bundles de produção.
- Arquivos prováveis: `tests/fixtures/` ou geração programática em testes.
- Testes: executar `tests/unit/spreadsheet-parser.test.ts`.
- Concluída quando: testes não dependem dos valores comerciais da pasta de referência.

#### Item de escopo 024 — Implementar prévia de importação

- Dependências: `TASK-017`, `TASK-022`.
- Requisitos: seção 10.1.
- Trabalho:
  - receber lista e arquivo;
  - validar tipo e conteúdo;
  - devolver hash, quantidade de itens, erros e avisos;
  - não persistir nem ativar uma versão na prévia;
  - proteger o endpoint com `matrix.manage`.
- Arquivos prováveis: módulo de listas, upload e rotas.
- Testes: integração para prévia válida, inválida e sem permissão.
- Concluída quando: a prévia não produz efeito colateral no banco.

#### Item de escopo 025 — Implementar confirmação transacional da importação

- Dependências: `TASK-024`.
- Requisitos: `RF-VER-001` a `RF-VER-005`.
- Trabalho:
  - analisar novamente o arquivo confirmado;
  - validar o hash esperado da prévia;
  - detectar arquivo duplicado na mesma lista;
  - criar versão e itens;
  - ativar a nova versão na mesma transação;
  - registrar auditoria.
- Arquivos prováveis: serviço e repositório de listas.
- Testes: integração de versão sequencial, duplicidade, rollback e auditoria.
- Concluída quando: falha parcial não deixa versão ou itens incompletos.

### Itens 026–028 — Administração de listas no frontend

#### Item de escopo 026 — Reorganizar o painel de matrizes por tipo

- Dependências: `TASK-018`.
- Requisitos: seção 16.2.
- Trabalho:
  - exibir seções “Kits com estrutura” e “Produtos sem estrutura”;
  - mostrar nome, tipo, público, faixa e situação;
  - mostrar versão ativa e ausência de versão;
  - remover ordenação fixa baseada nos três perfis antigos.
- Arquivos prováveis: `src/web/calculations-page.ts`, `src/web/prototype-transform.ts`.
- Testes: E2E de renderização com listas dinâmicas.
- Concluída quando: qualquer lista retornada pela API aparece na seção correta.

#### Item de escopo 027 — Criar formulário administrativo da definição de lista

- Dependências: `TASK-017`, `TASK-018`, `TASK-026`.
- Requisitos: `RF-LIS-002` a `RF-LIS-006`.
- Trabalho:
  - editar nome e situação;
  - escolher classes ou segmentos conforme o tipo;
  - informar faixa opcional;
  - impedir combinações incompatíveis no frontend e exibir erros do backend.
- Arquivos prováveis: páginas, serviços e markup transformado.
- Testes: E2E de criação/edição e validação por tipo.
- Concluída quando: público e faixa podem ser configurados sem editar seed ou código.

#### Item de escopo 028 — Implementar prévia e confirmação de importação na interface

- Dependências: `TASK-024`, `TASK-025`, `TASK-026`.
- Requisitos: seção 10.1.
- Trabalho:
  - selecionar arquivo dentro da lista correta;
  - mostrar quantidade, erros e avisos;
  - exigir confirmação para ativar;
  - atualizar a versão ativa após sucesso;
  - tratar upload duplicado e falha recuperável.
- Arquivos prováveis: página administrativa e serviço HTTP.
- Testes: E2E de prévia sem efeito, confirmação e erro.
- Concluída quando: nenhum upload é ativado sem confirmação explícita.

### Itens 029–035 — Cálculo de kits com lista dinâmica

#### Item de escopo 029 — Trocar o contrato do cálculo de perfil fixo para lista

- Dependências: `TASK-018`, `TASK-025`.
- Requisitos: `RF-CAL-001`, `RF-CAL-002`.
- Trabalho:
  - receber `priceListId` em vez do enum de três perfis;
  - devolver lista, classe atendida e versão na prévia;
  - manter contratos históricos necessários à busca e detalhe.
- Arquivos prováveis: `src/shared/pricing.ts`, serviços web e rotas de cálculo.
- Testes: typecheck e integração de validação do identificador.
- Concluída quando: uma lista nova pode ser usada sem alterar um enum no código.

#### Item de escopo 030 — Carregar e validar a lista escolhida no cálculo

- Dependências: `TASK-016`, `TASK-029`.
- Requisitos: `RF-CAL-002`, `RF-CAL-003`.
- Trabalho:
  - exigir tipo `KIT_COMPONENT`;
  - exigir lista e versão ativa;
  - carregar preços da versão fixada;
  - manter aritmética decimal e itens sem preço;
  - não exigir cliente para a prévia.
- Arquivos prováveis: `src/server/modules/calculations/calculations.service.ts`.
- Testes: unitários/integrados para tipo incorreto, ausência de versão e cálculo válido.
- Concluída quando: a prévia usa exatamente a versão ativa da lista escolhida.

#### Item de escopo 031 — Tornar o cliente obrigatório ao salvar cálculo

- Dependências: `TASK-007`, `TASK-030`.
- Requisitos: `RF-CAL-005`.
- Trabalho:
  - exigir `customerId` no endpoint de salvamento;
  - rejeitar cliente ausente, inexistente ou inativo;
  - preservar a possibilidade de simular sem cliente.
- Arquivos prováveis: schemas/rotas/serviço de cálculo e cliente HTTP.
- Testes: integração para ausência, UUID inválido, cliente inativo e válido.
- Concluída quando: nenhuma nova versão de cálculo pode ser salva sem cliente ativo.

#### Item de escopo 032 — Validar a classe do cliente no salvamento

- Dependências: `TASK-016`, `TASK-031`.
- Requisitos: `RF-CAL-006`.
- Trabalho:
  - recarregar a classe dentro da operação de salvamento;
  - validar associação com a lista da prévia;
  - rejeitar classe ausente ou incompatível;
  - não trocar a lista automaticamente.
- Arquivos prováveis: serviço de cálculo e política de listas.
- Testes: integração para classe compatível, incompatível e não classificada.
- Concluída quando: envio direto à API não contorna a regra.

#### Item de escopo 033 — Preservar versão e classificação no histórico do cálculo

- Dependências: `TASK-014`, `TASK-032`.
- Requisitos: `RF-CAL-007`, `RF-CAL-008`, `RF-CAL-009`.
- Trabalho:
  - manter FK para a versão exata usada;
  - fotografar cliente e classificação necessária à auditoria;
  - preservar versionamento e vínculo eficiente a cálculo existente;
  - bloquear salvamento quando a versão ativa mudar após a prévia.
- Arquivos prováveis: schema/migração se necessário e serviço de cálculo.
- Testes: integração de concorrência lógica e consulta histórica.
- Concluída quando: alteração futura da lista ou do cliente não modifica o registro salvo.

#### Item de escopo 034 — Atualizar a tela Calcular para listas dinâmicas

- Dependências: `TASK-026`, `TASK-029`, `TASK-031`, `TASK-032`.
- Requisitos: seção 16.1.
- Trabalho:
  - listar somente listas com estrutura e versão ativa para simulação;
  - manter escolha manual;
  - mostrar lista, classe e versão;
  - manter prévia sem cliente;
  - exigir cliente no modal de salvamento;
  - explicar incompatibilidade e orientar novo cálculo.
- Arquivos prováveis: `src/web/calculations-page.ts`, serviços e markup.
- Testes: atualizar `tests/e2e/calculations.spec.ts`.
- Concluída quando: o fluxo completo funciona sem botões hardcoded de perfil.

#### Item de escopo 035 — Cobrir regressões do cálculo e histórico

- Dependências: `TASK-033`, `TASK-034`.
- Requisitos: critérios 3 a 6 e 16.
- Trabalho:
  - testar primeiro cálculo, recálculo e vínculo a cálculo existente;
  - testar item sem preço;
  - testar mudança da versão ativa entre prévia e salvamento;
  - testar preservação dos totais históricos.
- Arquivos prováveis: testes unitários, integração e E2E de cálculo.
- Verificação: suítes de cálculo e busca/detalhe.
- Concluída quando: os comportamentos existentes e novos passam juntos.

### Itens 036–039 — Catálogo de produtos sem estrutura

#### Item de escopo 036 — Persistir identidade de produtos importados sem estrutura

- Dependências: `TASK-025`.
- Requisitos: `RF-PRO-001` a `RF-PRO-004`.
- Trabalho:
  - criar ou atualizar identidade do produto pelo código durante importação confirmada;
  - manter descrição e referência importadas na versão;
  - não gravar preço global no produto;
  - classificar vendabilidade pelo tipo da lista, não pelo texto da descrição.
- Arquivos prováveis: schema se necessário e serviço de importação.
- Testes: integração para produto novo, existente e descrição atualizada.
- Concluída quando: produtos são pesquisáveis sem perder a fotografia da versão.

#### Item de escopo 037 — Criar consulta paginada de produtos por lista ativa

- Dependências: `TASK-036`.
- Requisitos: `RF-PED-004`.
- Trabalho:
  - pesquisar por código, descrição e referência;
  - consultar somente a versão ativa informada;
  - paginar e limitar resultados;
  - aplicar `price.view` quando retornar valores.
- Arquivos prováveis: módulo de listas/produtos, rotas e contratos compartilhados.
- Testes: integração de busca, paginação, versão e permissão.
- Concluída quando: o frontend pode abandonar a constante demonstrativa.

#### Item de escopo 038 — Criar serviço de preço unitário sem estrutura

- Dependências: `TASK-016`, `TASK-037`.
- Requisitos: `RF-PED-007`, `RF-PED-008`.
- Trabalho:
  - localizar item pelo código na versão ativa;
  - retornar preço decimal, referência e IPI informativo;
  - nunca adicionar o IPI novamente;
  - rejeitar produto inexistente na lista.
- Arquivos prováveis: serviço de cotação/preço.
- Testes: valor unitário, produto ausente, precisão e IPI incluído.
- Concluída quando: existe uma única regra server-side reutilizável para preço avulso.

#### Item de escopo 039 — Criar endpoint de listas permitidas para o cliente

- Dependências: `TASK-007`, `TASK-016`, `TASK-018`.
- Requisitos: `RF-PED-001`, `RF-PED-002`, `RF-PED-003`.
- Trabalho:
  - receber cliente e contexto de pedido;
  - carregar segmento atual no banco;
  - retornar listas avulsas ativas e autorizadas;
  - identificar compatibilidade de faixa para a quantidade informada;
  - não selecionar uma lista automaticamente.
- Arquivos prováveis: módulo de listas e contratos web.
- Testes: integração para vários segmentos, várias listas e ausência de lista.
- Concluída quando: lista não autorizada nunca aparece na resposta elegível.

### Itens 040–049 — Carrinho com catálogo real e faixas

#### Item de escopo 040 — Carregar listas após selecionar o cliente no pedido

- Dependências: `TASK-039`.
- Requisitos: `RF-PED-001` a `RF-PED-003`.
- Trabalho:
  - manter o seletor de cliente atual;
  - carregar listas autorizadas após a seleção;
  - exigir escolha manual;
  - mostrar ausência de listas e falha recuperável;
  - limpar a seleção quando o cliente mudar.
- Arquivos prováveis: `src/web/orders-page.ts`, serviços e markup do pedido.
- Testes: E2E de cliente com zero, uma e várias listas.
- Concluída quando: o frontend não oferece lista de outro segmento.

#### Item de escopo 041 — Substituir o catálogo fixo por produtos da lista

- Dependências: `TASK-037`, `TASK-040`.
- Requisitos: `RF-PRO-001`, `RF-PED-004`.
- Trabalho:
  - carregar produtos somente após escolher a lista;
  - pesquisar no servidor por código, descrição e referência;
  - manter paginação/estado de carregamento;
  - retirar `PEDIDO_PRODUTOS` como fonte dos produtos sem estrutura.
- Arquivos prováveis: `src/web/orders-page.ts`, `src/web/prototype-transform.ts`, fonte legada somente onde transformada.
- Testes: E2E de busca e inclusão no carrinho.
- Concluída quando: nenhum produto avulso real depende do array demonstrativo.

#### Item de escopo 042 — Integrar kits calculados ao catálogo do pedido

- Dependências: `TASK-033`, `TASK-041`.
- Requisitos: `RF-PED-005` e preservação do comportamento atual.
- Trabalho:
  - consultar kits com cálculo atual compatível com a classe do cliente;
  - manter identificação da versão do cálculo;
  - preservar seleção de referência mínima ou normal/máxima para kits;
  - diferenciar visualmente kit e produto sem estrutura.
- Arquivos prováveis: busca/cálculos no backend, contratos e tela de Pedidos.
- Testes: integração e E2E para adicionar kit e produto avulso no mesmo carrinho.
- Concluída quando: o carrinho misto usa fontes reais e rastreáveis.

#### Item de escopo 043 — Implementar função única de quantidade total do pedido

- Dependências: `TASK-042`.
- Requisitos: `RF-LIS-007`, `RF-PED-005`.
- Trabalho:
  - somar quantidades de todas as linhas;
  - incluir kits e produtos sem estrutura;
  - recalcular após adicionar, remover ou alterar quantidade;
  - não usar quantidade de tipos distintos em contadores separados para a faixa.
- Arquivos prováveis: domínio de cotação e estado do carrinho.
- Testes: unitários para carrinho vazio, misto e múltiplas quantidades.
- Concluída quando: frontend e backend usam a mesma definição de total.

#### Item de escopo 044 — Implementar validação dos limites 49, 50, 99 e 100

- Dependências: `TASK-016`, `TASK-043`.
- Requisitos: `RF-LIS-006`, `RF-PED-006`.
- Trabalho:
  - validar limites inclusivos corretamente;
  - suportar lista sem faixa;
  - suportar limite superior aberto em `100+`;
  - retornar compatibilidade sem escolher outra lista.
- Arquivos prováveis: política de listas e utilitário do carrinho.
- Testes: casos exatos 0, 1, 49, 50, 99 e 100.
- Concluída quando: não existe lacuna nem sobreposição indevida entre as três faixas iniciais.

#### Item de escopo 045 — Invalidar a lista quando a quantidade mudar de faixa

- Dependências: `TASK-040`, `TASK-043`, `TASK-044`.
- Requisitos: `RF-PED-006`.
- Trabalho:
  - detectar incompatibilidade após qualquer mudança do carrinho;
  - manter os itens visíveis para correção;
  - bloquear cotação final enquanto incompatível;
  - pedir nova escolha manual;
  - não migrar automaticamente para outra lista.
- Arquivos prováveis: `src/web/orders-page.ts` e markup/estilos do pedido.
- Testes: E2E de transição 99→100 e 100→99.
- Concluída quando: a lista inválida nunca é usada silenciosamente.

#### Item de escopo 046 — Invalidar lista e itens ao trocar o cliente

- Dependências: `TASK-040`, `TASK-041`, `TASK-045`.
- Requisitos: `RF-PED-009`.
- Trabalho:
  - limpar a lista escolhida ao trocar cliente;
  - recarregar listas do novo segmento;
  - marcar produtos indisponíveis até nova seleção;
  - impedir uso do preço anterior.
- Arquivos prováveis: estado da tela de Pedidos.
- Testes: E2E com clientes de segmentos diferentes.
- Concluída quando: nenhum preço do cliente anterior sobrevive como válido.

#### Item de escopo 047 — Criar endpoint server-side de cotação do carrinho

- Dependências: `TASK-038`, `TASK-042`, `TASK-043`, `TASK-044`.
- Requisitos: `RF-PED-008` e seção 15.3.
- Trabalho:
  - receber cliente, lista escolhida e linhas com código/quantidade;
  - recarregar cliente, classificação, lista e versões;
  - validar quantidade total e faixa;
  - resolver preços de kits e produtos sem estrutura;
  - calcular subtotais e total com decimal;
  - devolver versões e avisos usados na cotação;
  - não persistir um pedido nesta tarefa.
- Arquivos prováveis: novo módulo de cotação/pedidos, rotas e contratos.
- Testes: integração para manipulação de preço, lista não autorizada e faixa incorreta.
- Concluída quando: preços enviados pelo navegador são ignorados como fonte de verdade.

#### Item de escopo 048 — Usar a cotação do backend na ação do pedido

- Dependências: `TASK-045`, `TASK-046`, `TASK-047`.
- Requisitos: critério de aceite 13.
- Trabalho:
  - enviar o carrinho para cotação antes da ação final disponível;
  - atualizar valores apresentados com a resposta do servidor;
  - mostrar incompatibilidades e produtos ausentes;
  - manter fora do escopo a persistência definitiva do pedido.
- Arquivos prováveis: `src/web/orders-page.ts`, serviço HTTP e transformação do protótipo.
- Testes: E2E garantindo que valores locais adulterados não prevalecem.
- Concluída quando: a confirmação visual usa somente a cotação validada pelo backend.

#### Item de escopo 049 — Cobrir o fluxo completo do carrinho

- Dependências: `TASK-048`.
- Requisitos: critérios 7 a 14.
- Trabalho:
  - testar seleção manual entre várias listas;
  - testar bloqueio de lista de outro segmento;
  - testar carrinho misto e mudança de faixa;
  - testar IPI não duplicado;
  - testar troca de cliente;
  - testar catálogo real e ausência de lista.
- Arquivos prováveis: testes unitários, integração e `tests/e2e/orders-customers.spec.ts` ou nova suíte.
- Verificação: executar a suíte completa de Pedidos.
- Concluída quando: todos os critérios do carrinho estão automatizados.

### Itens 050–054 — Limpeza, documentação e entrega

#### Item de escopo 050 — Remover dependências obsoletas de perfis fixos

- Dependências: `TASK-035`, `TASK-049`.
- Requisitos: critério de aceite 1.
- Trabalho:
  - remover enum e ordenações fixas não mais utilizados;
  - remover caminhos legados de importação substituídos;
  - manter adaptadores necessários apenas ao histórico;
  - confirmar que Exportação e listas futuras não exigem mudança de código.
- Arquivos prováveis: `src/shared/pricing.ts`, rotas, páginas e serviços antigos.
- Testes: typecheck, busca por símbolos mortos e suítes afetadas.
- Concluída quando: novos tipos de lista são dirigidos por dados persistidos.

#### Item de escopo 051 — Remover dados demonstrativos afetados do pedido

- Dependências: `TASK-041`, `TASK-042`, `TASK-048`.
- Requisitos: critério de aceite 9.
- Trabalho:
  - remover `PEDIDO_PRODUTOS` do bundle final ou da transformação usada em produção;
  - remover preços fictícios associados;
  - preservar somente markup e comportamento visual ainda reutilizados;
  - garantir estado vazio real quando não houver lista/produto.
- Arquivos prováveis: `fluair-tabpreco-merge-pedidos.html`, `src/web/prototype-transform.ts` e testes de transformação.
- Testes: `tests/unit/prototype-transform.test.ts` e E2E do pedido.
- Concluída quando: nenhum catálogo ou preço fictício chega ao fluxo migrado.

#### Item de escopo 052 — Atualizar documentação funcional e técnica

- Dependências: `TASK-050`, `TASK-051`.
- Requisitos: consistência documental.
- Trabalho:
  - atualizar `README.md` e `CLAUDE.md`;
  - atualizar documentos de Clientes, Cálculo, Matrizes e Pedidos;
  - registrar rotas, permissões e estado realmente implementado;
  - manter `spec.md` como fonte das decisões de negócio.
- Arquivos prováveis: `README.md`, `CLAUDE.md`, `docs/telas/04-calculo-preco.md`, `06-atualizacao-matriz.md`, `08-pedidos.md`, `09-clientes.md`.
- Testes: revisão de links, nomes e ausência de afirmações antigas.
- Concluída quando: documentação e comportamento não se contradizem.

#### Item de escopo 053 — Ensaiar migração com cópia representativa do banco

- Dependências: `TASK-014`, `TASK-035`, `TASK-049`.
- Requisitos: seção 21.
- Trabalho:
  - aplicar migrações em uma cópia segura;
  - conferir clientes, classificações, matrizes, versões e cálculos;
  - executar rollback operacional planejado, quando aplicável;
  - registrar duração e correções necessárias.
- Arquivos prováveis: scripts de verificação em `scripts/`, sem dados sensíveis versionados.
- Testes: reconciliação de contagens e amostras históricas.
- Concluída quando: a migração pode ser repetida sem perda ou duplicação.

#### Item de escopo 054 — Executar o quality gate final

- Dependências: `TASK-052`, `TASK-053`.
- Requisitos: todos os critérios de aceite.
- Trabalho:
  - executar formatação, lint, typecheck, build e todas as suítes;
  - executar smoke test de Clientes, Listas, Calcular, Busca/Detalhe e Pedidos;
  - verificar permissões com usuário autorizado e não autorizado;
  - conferir auditoria e preservação histórica;
  - documentar qualquer limitação remanescente dentro do escopo.
- Arquivos prováveis: somente correções diretamente relacionadas a falhas encontradas.
- Testes: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:integration` e `npm run test:e2e`.
- Concluída quando: todas as verificações passam e os 16 critérios de aceite do `spec.md` foram evidenciados.

## 9. Ordem resumida de execução

1. Baseline e desenho: `TASK-001` a `TASK-002`.
2. Clientes: `TASK-003` a `TASK-010`.
3. Base de listas e versionamento: `TASK-011` a `TASK-014`.
4. Parsers e importação: `TASK-015` a `TASK-017`.
5. Cálculo de kits: `TASK-018`.
6. Catálogo e seleção no pedido: `TASK-019` e `TASK-020`.
7. Carrinho e cotação: `TASK-021` e `TASK-022`.
8. Limpeza, documentação e entrega: `TASK-023` e `TASK-024`.

As tarefas podem ser paralelizadas somente quando suas dependências explícitas estiverem concluídas
e quando não editarem o mesmo recorte de schema ou contrato compartilhado.

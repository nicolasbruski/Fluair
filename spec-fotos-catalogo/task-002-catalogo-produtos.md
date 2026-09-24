# TASK-002 — Transformar Produtos em catálogo com gestão de fotos

## Objetivo

Evoluir a tela Produtos para um catálogo administrativo real de kits e produtos avulsos, permitindo
consultar, filtrar, adicionar, substituir e remover a foto atual de cada entidade.

## Dependências

- `TASK-001`.

## Requisitos atendidos

- `RF-PRO-001` a `RF-PRO-007`;
- `RF-CAT-001`, `RF-CAT-002` e `RF-CAT-006`;
- `RNF-001` a `RNF-005`.

## Escopo de implementação

### Consulta unificada

- criar ou adaptar uma consulta paginada específica para a tela Produtos;
- listar kits disponíveis no catálogo e produtos existentes em versões ativas de listas
  `STANDALONE_PRODUCT`;
- deduplicar produtos por `Product.id`/código, mesmo quando houver várias ofertas;
- não promover componente interno a produto avulso sem oferta ativa;
- permitir busca por código e descrição e filtros Todos, Kits, Produtos avulsos e Sem foto;
- retornar `ImageReference | null`, nunca o blob.

### Administração da imagem

- expor mutações autenticadas para foto atual de `Product` e `Kit`;
- integrar upload, substituição e remoção ao serviço de mídia da fundação;
- aplicar `catalog.manage` no backend e na interface;
- preservar imagens históricas ao remover ou substituir a atual;
- tratar concorrência ou item removido entre carregamento e confirmação;
- registrar auditoria com origem Produtos.

### Interface

- renomear e reposicionar a tela como catálogo de kits e produtos avulsos;
- apresentar miniatura, tipo, código, descrição, origem resumida e ações;
- criar seletor com prévia, validação, troca, remoção e confirmação;
- implementar estados de enviando, sucesso e erro sem envio duplicado;
- manter placeholder consistente para itens sem foto;
- ajustar paginação, contagem e responsividade para os dois tipos;
- preservar a visualização da composição do kit e os vínculos de clientes existentes.

## Arquivos e módulos prováveis

- `src/shared/orders.ts` ou novo contrato de catálogo;
- `src/server/modules/orders/` ou novo módulo de catálogo;
- `src/web/products-page.ts`;
- `src/web/services/orders-api.ts` ou novo cliente de catálogo;
- `src/web/prototype-transform.ts`;
- testes de serviço, integração e `tests/e2e/products.spec.ts`.

## Testes obrigatórios

- produto repetido em várias listas aparece uma vez e usa uma foto;
- componente sem oferta avulsa não aparece como produto avulso;
- paginação e filtros por tipo/sem foto;
- upload, substituição e remoção de kit e produto;
- usuário sem `catalog.manage` visualiza, mas não altera;
- chamada direta não autorizada é rejeitada;
- remoção da foto atual não apaga snapshot histórico;
- E2E responsivo com placeholder e estados de erro.

## Evidências de conclusão

- captura ou teste E2E da listagem mista;
- auditoria comprovada para as três mutações;
- resposta paginada sem Base64/blob;
- testes cobrindo deduplicação entre listas.

## Concluída quando

Kits e produtos avulsos podem ter sua foto atual administrada integralmente na tela Produtos, com
autorização server-side e sem alterar versões históricas.

## Resultado da execução

Implementada em 2026-09-23.

### Entrega

- criada a API paginada `GET /api/v1/catalog`, protegida para visualização, com busca por código e
  descrição e filtros Todos, Kits, Produtos avulsos e Sem foto;
- a resposta unifica kits disponíveis e produtos presentes em versões ativas de listas
  `STANDALONE_PRODUCT`, deduplica produtos por entidade/código e não promove componentes internos
  sem oferta avulsa;
- a consulta seleciona apenas metadados de `MediaAsset` e devolve `ImageReference | null`, sem
  carregar ou serializar blobs;
- a tela Produtos foi reposicionada como Catálogo de produtos, com miniatura/placeholder, tipo,
  código, descrição, origem, contagem e paginação unificadas e layout responsivo;
- usuários com `catalog.manage` podem selecionar e pré-visualizar JPEG, PNG ou WebP, confirmar o
  upload/substituição e remover a foto atual; os controles ficam ausentes para os demais usuários;
- estados de envio, sucesso e erro bloqueiam envio duplicado e a remoção exige confirmação;
- upload, substituição e remoção reutilizam a fundação de mídia da TASK-001, incluindo concorrência,
  preservação de ativos históricos e auditoria com origem `PRODUCTS`;
- a composição do kit e a navegação para os clientes vinculados foram preservadas.

### Verificação

- testes unitários cobrem deduplicação entre listas, exclusão de componentes sem oferta, filtros,
  paginação unificada e ausência de blobs na seleção;
- testes de integração cobrem visualização sem `catalog.manage` e rejeição de chamadas sem sessão ou
  sem permissão;
- os testes da fundação de mídia comprovam upload, substituição/remoção, autorização server-side,
  auditoria e preservação do ativo após desvincular a foto atual;
- E2E da listagem mista comprova placeholder, produto avulso, composição e vínculo do cliente; E2E
  responsivo comprova validação e estado de erro do seletor;
- `npm test`: 41 arquivos e 184 testes aprovados;
- `npm run test:e2e -- tests/e2e/products.spec.ts`: 2 testes aprovados;
- lint, typecheck e build de produção aprovados.

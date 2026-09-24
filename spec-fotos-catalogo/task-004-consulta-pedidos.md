# TASK-004 — Propagar as imagens para consulta e Pedidos

## Objetivo

Exibir as imagens corretas em Buscar, Detalhes, histórico, drawer e carrinho, compartilhando contratos
e componentes visuais sem aumentar indevidamente o tamanho das respostas.

## Dependências

- `TASK-002`;
- `TASK-003`.

## Requisitos atendidos

- `RF-BUS-001` a `RF-BUS-004`;
- `RF-DET-001` a `RF-DET-005`;
- `RF-PED-001` a `RF-PED-006`;
- seção 17 e seção 19 do `spec.md`;
- `RNF-001` a `RNF-005`.

## Escopo de implementação

### Contratos e consultas

- acrescentar `ImageReference | null` aos contratos de busca, detalhe, histórico, catálogos e
  cotação;
- Buscar, Detalhes e histórico devem resolver a imagem de `CalculationVersion`;
- catálogo de Produtos/Pedidos deve resolver a imagem atual de `Product` ou `Kit`;
- cotação deve reafirmar a imagem atual quando necessário;
- incluir relações nas consultas Prisma sem carregar bytes e sem criar N+1;
- manter todos os endpoints paginados e respostas sem Base64.

### Buscar

- adicionar miniatura antes do código;
- ajustar altura, carregamento, placeholder e layout móvel;
- garantir que a imagem seja a mesma ao abrir Detalhes;
- preservar ordenação, filtros, URL e navegação existentes.

### Detalhes e histórico

- apresentar a foto da versão no cabeçalho;
- identificar visualmente “Foto desta versão” quando relevante;
- permitir ampliação acessível;
- manter a composição sem miniatura por componente;
- garantir que versões históricas mostrem a imagem correta;
- manter permissões, volta para Busca e geração de Pedido.

### Drawer de Pedidos

- adicionar miniatura aos cards de kit e produto avulso;
- preservar clique em faixa de preço, filtros, busca e acessibilidade;
- impedir que clicar para ampliar imagem adicione o item acidentalmente;
- manter o card compreensível sem foto.

### Carrinho

- adicionar a referência de imagem ao estado de `CartItem`;
- preencher a imagem ao incluir pelo drawer ou pela tela Detalhes;
- apresentar miniatura sem prejudicar quantidade, preço, imposto e subtotal;
- preservar a imagem após re-renderizações e validação da cotação;
- manter imagem fora das chaves e cálculos comerciais do carrinho.

## Arquivos e módulos prováveis

- `src/shared/pricing.ts` e `src/shared/orders.ts`;
- `src/server/modules/calculations/calculations.service.ts`;
- `src/server/modules/orders/orders.service.ts`;
- `src/web/search-page.ts`;
- `src/web/detail-page.ts`;
- `src/web/orders-page.ts`;
- serviços HTTP e `src/web/prototype-transform.ts`;
- testes E2E de Busca, Detalhes, Produtos e Pedidos.

## Testes obrigatórios

- busca paginada com foto e sem foto;
- detalhe atual e versão histórica com ativos diferentes;
- ampliação por teclado e fechamento correto;
- drawer com kit e produto avulso;
- clique em imagem não adiciona item indevidamente;
- carrinho vindo do drawer e de Detalhes;
- alteração de quantidade/preço e cotação preservam a imagem;
- produto em várias faixas mantém uma imagem;
- contagem de consultas ou evidência contra N+1;
- layout móvel e falha de carregamento com placeholder.

## Evidências de conclusão

- os cinco contextos usam o componente visual comum;
- respostas JSON não contêm bytes/Base64;
- screenshot/teste visual de desktop e celular;
- versão histórica e catálogo atual demonstram referências independentes.

## Concluída quando

Todas as telas de consulta e montagem de pedido apresentam a imagem adequada ao seu contexto, com
boa experiência visual e sem interferir em preços, permissões ou desempenho.

## Resultado da execução

- contratos de busca, detalhe, histórico, catálogos e cotação propagam `ImageReference | null`;
- consultas Prisma selecionam somente metadados do ativo e resolvem imagens em lote, sem blobs ou
  consultas por linha;
- Busca, Detalhes e histórico exibem a fotografia da `CalculationVersion`, inclusive versões
  históricas com ativos diferentes;
- drawer e carrinho exibem a imagem atual de produto/kit, com fallback e ampliação acessível;
- ampliar uma imagem no drawer não adiciona o item; `Escape` fecha o modal e devolve o foco;
- o carrinho preserva a imagem ao alterar quantidade/preço e a atualiza com a referência
  reafirmada pela cotação, sem incluí-la em chaves ou cálculos comerciais;
- validações executadas: TypeScript, ESLint, 187 testes Vitest e cenários Playwright focados de
  Busca, Detalhes, histórico, drawer e carrinho.
- evidências visuais: `tmp/task-004-detail-desktop.png` e `tmp/task-004-orders-mobile.png`.

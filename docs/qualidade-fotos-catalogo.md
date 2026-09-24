# Evidências de qualidade — fotos de kits e produtos

Data da execução: 2026-09-23.

## Matriz dos critérios de aceite

| # | Evidência principal | Resultado |
|---:|---|---|
| 1 | `products.spec.ts`; mutações em `media.integration.test.ts` | Aprovado |
| 2 | `catalog.service.test.ts`; `products.spec.ts` | Aprovado |
| 3 | Deduplicação por `Product` em `catalog.service.test.ts` e `orders-multi-list.test.ts` | Aprovado |
| 4 | Fluxos sem foto em `calculations.service.test.ts` e `calculations.spec.ts` | Aprovado |
| 5 | Seleção, troca e remoção local em `calculations.spec.ts` | Aprovado |
| 6 | Snapshots distintos em `calculations.service.test.ts` e ensaio MySQL | Aprovado |
| 7 | `search.spec.ts` e `detail.spec.ts` usam a referência da versão | Aprovado |
| 8 | Histórico imutável em `calculations.service.test.ts` e ensaio MySQL | Aprovado |
| 9 | Drawer com kit/produto em `orders-customers.spec.ts` | Aprovado |
| 10 | Imagens preservadas no carrinho em `orders-customers.spec.ts` | Aprovado |
| 11 | Placeholder/erro em `products.spec.ts`, `detail.spec.ts` e `orders-customers.spec.ts` | Aprovado |
| 12 | `media-prisma-selection.test.ts` e varreduras JSON sem blobs/Base64 | Aprovado |
| 13 | SVG, falso, corrompido, bytes e pixels em testes de mídia | Aprovado |
| 14 | `calculation-export.test.ts`, `detail.spec.ts` e renderização dos PDFs | Aprovado |
| 15 | ExcelJS/JSZip em `calculation-export.test.ts` e `detail.spec.ts` | Aprovado |
| 16 | API sem `catalog.manage` retorna 403 em `media.integration.test.ts` | Aprovado |
| 17 | Auditoria de vínculo anterior/novo em testes de mídia e cálculo | Aprovado |
| 18 | Migration aditiva, vínculos nulos e contagens reconciliadas no ensaio MySQL | Aprovado |
| 19 | E2E desktop e viewport móvel em Produtos, Detalhes e Pedidos | Aprovado |
| 20 | Quality gate integral descrito abaixo | Aprovado |

## Ensaio da migration

Banco descartável: `fluair_task006_media`, separado do banco da aplicação.

| Entidade | Antes | Depois |
|---|---:|---:|
| Produtos | 2 | 2 |
| Kits | 1 | 1 |
| Versões de cálculo | 2 | 2 |
| Itens de cálculo | 2 | 2 |

As migrations anteriores foram aplicadas, a fixture foi criada no schema pré-mídia e somente então
`20260923120000_media_foundation` foi executada. Todos os vínculos novos ficaram nulos para os
registros antigos. Em seguida, duas imagens fictícias foram associadas respectivamente às versões 1
e 2; o kit atual apontou para a imagem da versão 2. A consulta usando apenas as colunas conhecidas
pela aplicação anterior retornou os dois produtos, comprovando rollback operacional com schema
aditivo. A consulta de reconciliação encontrou zero ativos sem referência.

## Desempenho e transporte

- `media-prisma-selection.test.ts` impede `displayData` e `thumbnailData` nas listagens;
- testes de serviço confirmam uma consulta em lote por entidade para Produtos, Busca e Pedidos,
  independentemente da quantidade de linhas retornadas;
- paginação foi exercitada com página 2 e limites de 30/50 itens;
- amostra sintética de 50 itens: JSON de 15.417 bytes, sem Base64;
- imagem sintética 1600 x 1200: origem PNG de 28.898 bytes, `display` WebP de 3.496 bytes e
  miniatura WebP de 218 bytes;
- leitura repetida foi coberta por `ETag`, `If-None-Match` e resposta 304, com
  `Cache-Control: private, max-age=31536000, immutable`.

## Artefatos e verificação visual

Os PDFs de QA foram gerados com dados fictícios. A renderização em PNG mostrou cabeçalho, foto ou
espaço reduzido, totais, tabela e rodapé sem corte, deformação ou sobreposição. A paginação extensa
é coberta com 70 itens em `calculation-export.test.ts`.

O `.xlsx` apresentou assinatura OOXML válida, planilha `Cálculo`, imagem em `xl/media/image1.png` e
relacionamento de desenho. `C4` foi lida como data; `C8`, `F8` e `H8` como números. A planilha possui
congelamento na linha 7, área de impressão `A1:H9`, orientação paisagem, ajuste à página e larguras
definidas.

## Smoke e quality gate

Os 28 testes Playwright cobrem Produtos, Calcular, Buscar, Detalhes e Pedidos, incluindo teclado,
permissão, responsividade, histórico e exportações.

| Comando | Resultado |
|---|---|
| `npm run format:check` | Aprovado |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm run build` | Aprovado |
| `npm test` | 42 arquivos, 189 testes aprovados |
| `npm run test:integration` | 9 arquivos, 69 testes aprovados |
| `npm run test:e2e` | 28 testes aprovados |

## Limitação remanescente

Não existe job automático de coleta de ativos órfãos. A decisão é intencional: a primeira entrega
mantém a limpeza como operação conservadora, posterior a backup, janela de retenção e nova
reconciliação de referências.

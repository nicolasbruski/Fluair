# TASK-006 — Validar migração, qualidade e entrega completa

## Objetivo

Consolidar a funcionalidade, comprovar os critérios de aceite, ensaiar a migration e garantir que
segurança, desempenho, responsividade, documentação e artefatos de exportação estejam prontos para
entrega.

## Dependências

- `TASK-001`;
- `TASK-002`;
- `TASK-003`;
- `TASK-004`;
- `TASK-005`.

## Requisitos atendidos

- `RNF-001` a `RNF-007`;
- seções 23 a 26 do `spec.md`;
- todos os 20 critérios de aceite.

## Escopo de implementação

### Consolidação de testes

- revisar a cobertura produzida nas tarefas anteriores;
- completar cenários unitários, integração e E2E faltantes;
- criar fixtures pequenas e seguras para JPEG, PNG e WebP;
- validar fluxos com e sem foto, foto inválida e imagem indisponível;
- validar usuário autorizado e não autorizado;
- cobrir desktop e dimensões móveis relevantes;
- confirmar que nenhuma imagem participa de cálculo comercial.

### Verificação de desempenho

- confirmar que blobs não são selecionados em listagens;
- verificar ausência de N+1 em Produtos, Buscar e catálogo de Pedidos;
- medir de forma representativa tamanho dos JSONs e miniaturas;
- testar paginação com quantidade relevante de itens;
- verificar cache/`ETag` em navegação repetida;
- corrigir somente gargalos relacionados a esta especificação.

### Ensaio de migration

- aplicar a migration em cópia ou banco descartável representativo;
- reconciliar contagens de produtos, kits, cálculos e itens antes/depois;
- confirmar vínculos nulos nos registros antigos;
- criar amostra com duas versões e imagens diferentes;
- testar rollback operacional para a versão anterior da aplicação mantendo schema aditivo;
- confirmar que não existem ativos órfãos criados por fluxos cancelados.

### Verificação visual e de artefatos

- revisar placeholder, recorte, proporção e alinhamento em todas as telas;
- validar navegação por teclado, foco e texto alternativo;
- renderizar PDFs para inspeção;
- abrir `.xlsx` e validar imagem, tipos de célula e impressão;
- registrar evidências sem dados comerciais sensíveis.

### Documentação e entrega

- atualizar `README.md`, `CLAUDE.md` e documentos de telas afetadas;
- registrar endpoints, permissão, limites, formatos e estratégia histórica;
- documentar operação de backup/limpeza de ativos;
- atualizar `tasks.md` e os resultados das seis tarefas;
- registrar limitações remanescentes sem ampliar o escopo.

### Quality gate

Executar e aprovar:

- `npm run format:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- `npm test`;
- `npm run test:integration`;
- `npm run test:e2e`.

## Arquivos e módulos prováveis

- suítes em `tests/unit`, `tests/integration` e `tests/e2e`;
- documentação em `README.md`, `CLAUDE.md` e `docs/telas/`;
- scripts seguros de reconciliação, se necessários;
- correções nos módulos das tarefas anteriores somente quando originadas por falhas verificadas.

## Testes e evidências obrigatórias

- matriz ligando os 20 critérios de aceite a testes/evidências;
- relatório de migration com contagens antes/depois;
- resultados completos do quality gate;
- PDF renderizado com e sem foto;
- inspeção estrutural de `.xlsx` com imagem;
- evidência de cache, ausência de Base64 e ausência de N+1;
- smoke test de Produtos, Calcular, Buscar, Detalhes e Pedidos.

## Concluída quando

Todos os critérios de aceite estiverem evidenciados, a migration tiver sido ensaiada sem perda de
dados, os artefatos tiverem sido verificados e o quality gate completo estiver aprovado.

## Resultado da execução

Concluída em 2026-09-23.

- fixtures sintéticas e sem dados comerciais cobrem JPEG, PNG e WebP;
- cobertura unitária, integração e E2E consolidada para foto válida, inválida, ausente e
  indisponível, permissões, teclado, desktop e celular;
- consultas de Produtos, Busca e Pedidos verificadas sem blobs e com resolução em lote, sem N+1;
- ensaio aditivo da migration aprovado em banco MySQL descartável, preservando as contagens
  `2 produtos / 1 kit / 2 cálculos / 2 itens`, mantendo vínculos antigos nulos e permitindo leitura
  pela projeção da aplicação anterior;
- duas versões foram associadas a ativos distintos, o kit apontou para o ativo mais recente e a
  reconciliação encontrou zero ativos órfãos;
- PDF com foto e fallback sem foto foram renderizados e inspecionados; `.xlsx` foi aberto como
  workbook real e validado quanto a imagem incorporada, células tipadas, congelamento e impressão;
- documentação de endpoints, permissão, limites, histórico, backup e limpeza atualizada;
- matriz integral dos critérios e medições registrada em `docs/qualidade-fotos-catalogo.md`;
- quality gate aprovado: formatação, lint, typecheck, build, 189 testes Vitest, 69 testes de
  integração e 28 testes Playwright.

Limitação registrada: a limpeza de ativos órfãos permanece operação administrativa deliberada,
sem job automático nesta entrega, para evitar remoção concorrente ou de histórico.

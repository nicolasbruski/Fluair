# Tela de Administração de Listas de Preço

## Identificação

- Rota: `/listas`
- Permissões: `matrix.view` para consulta e `matrix.manage` para alterações
- Estado: implementada para listas `KIT_COMPONENT` e `STANDALONE_PRODUCT`

## Objetivo

Administrar definições e versões de listas de preço sem depender de códigos fixos no frontend. A
tela separa listas de componentes de kit e listas de produtos avulsos.

## Funcionalidades

- listar nome, código, tipo, público, faixa, situação e versão ativa;
- criar uma definição de qualquer um dos dois tipos suportados;
- editar nome, faixa e classes ou segmentos compatíveis com o tipo;
- ativar ou desativar a definição;
- selecionar um arquivo dentro da lista correta;
- gerar prévia com hash, contagem, erros e avisos sem persistência;
- confirmar explicitamente a importação para criar e ativar uma versão imutável;
- manter todo o histórico e permitir escolher uma versão existente como ativa.

## API efetiva

- `GET /api/v1/price-lists`
- `POST /api/v1/price-lists`
- `PATCH /api/v1/price-lists/:id`
- `POST /api/v1/price-lists/:id/activate`
- `POST /api/v1/price-lists/:id/deactivate`
- `PUT /api/v1/price-lists/:id/active-version`
- `POST /api/v1/price-lists/:id/import/preview`
- `POST /api/v1/price-lists/:id/import/confirm`

Consultas aceitam `matrix.view` ou `matrix.manage`; mutações exigem `matrix.manage`. Toda mutação é
auditada. A API legada `/api/v1/matrices` foi removida porque limitava a administração aos três
perfis iniciais e duplicava o fluxo atual.

## Regras por tipo

- `KIT_COMPONENT`: associa classes e exige código, descrição, preço mínimo e preço normal.
- `STANDALONE_PRODUCT`: associa segmentos e exige código, descrição, referência, preço unitário e
  IPI informativo marcado como já incluído. A coluna ICMS é importada por produto e por versão da
  lista; arquivos anteriores sem a coluna recebem alíquota zero.
- Classes não podem ser associadas a lista avulsa, nem segmentos a lista de componentes.
- Faixas são opcionais, inclusivas e podem ter limite superior aberto.
- Importação duplicada na mesma lista é rejeitada.
- Erro ou aviso de prévia não altera a versão ativa.

As tabelas antigas continuam temporariamente para leitura histórica, rollback e escrita dupla das
listas migradas. Elas não definem as opções exibidas pela interface.

## Fora do escopo atual

Recálculo em massa de todos os kits, fila de processamento e remoção física das tabelas históricas
continuam fora deste recorte.

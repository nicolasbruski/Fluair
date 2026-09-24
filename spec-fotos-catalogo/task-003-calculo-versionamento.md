# TASK-003 — Integrar foto ao cálculo e ao versionamento histórico

## Objetivo

Permitir que uma foto opcional seja escolhida no começo de Calcular e seja salva de forma consistente
como imagem atual do kit e fotografia imutável da nova versão do cálculo.

## Dependências

- `TASK-001`.

## Requisitos atendidos

- `RF-CAL-001` a `RF-CAL-007`;
- `RF-CAT-003` a `RF-CAT-005`;
- `RNF-003`, `RNF-004` e `RNF-006`.

## Escopo de implementação

### Experiência de Calcular

- adicionar etapa visual de foto opcional logo depois da folha de processo;
- permitir selecionar, visualizar localmente, trocar e remover antes de salvar;
- manter Calcular funcional sem foto;
- depois da identificação do código, consultar e mostrar a foto atual de kit existente;
- deixar explícitas as opções de manter e substituir;
- exibir no resultado calculado a imagem que será efetivamente salva;
- impedir que trocar a foto passe despercebido durante um recálculo.

### Transporte e validação

- adaptar o salvamento para `multipart/form-data`, mantendo a validação atual da planilha;
- transportar arquivo Korp, imagem opcional e campos de controle sem usar Base64;
- não persistir uma imagem apenas porque uma prévia foi calculada e abandonada;
- validar novamente imagem, cliente, lista ativa, versão esperada e permissão no backend;
- manter compatibilidade clara com chamadas sem imagem.

### Regras de versionamento

- em primeiro cálculo, salvar a foto escolhida ou a imagem atual do kit, quando houver;
- em nova versão, associar a foto escolhida ou herdar a imagem atual;
- se uma nova foto for selecionada para kit com cálculo atual, exigir/criar nova versão;
- atualizar `Kit.currentImageId` e `CalculationVersion.kitImageId` de forma consistente;
- um simples vínculo de novo cliente sem recálculo e sem foto deve preservar a versão;
- não permitir que uma nova foto mutacione `CalculationVersion` existente;
- auditar a origem Calcular, ativo anterior e novo ativo.

### Respostas da API

- incluir imagem aplicável em `CalculationPreview`, resultado do salvamento e detalhe necessário ao
  fluxo;
- garantir que histórico sem foto continue retornando `null`;
- não carregar blobs nas consultas de cálculo.

## Arquivos e módulos prováveis

- `src/shared/pricing.ts`;
- `src/server/modules/calculations/calculations.routes.ts`;
- `src/server/modules/calculations/calculations.service.ts`;
- processamento atual de upload de planilha;
- `src/web/services/calculations-api.ts`;
- `src/web/calculations-page.ts`;
- `src/web/prototype-transform.ts`;
- testes unitários, integração e `tests/e2e/calculations.spec.ts`.

## Testes obrigatórios

- prévia e salvamento sem foto;
- primeiro cálculo com foto;
- cálculo herdando foto atual;
- recálculo substituindo foto e preservando versão antiga;
- tentativa de trocar foto sem versão rejeitada ou convertida corretamente em recálculo;
- vínculo simples de cliente sem duplicar cálculo ou mudar imagem;
- mudança concorrente da versão ativa da lista continua bloqueada;
- upload inválido no multipart;
- cancelamento antes de salvar não deixa ativo órfão;
- E2E de prévia local, manter, trocar e remover seleção.

## Evidências de conclusão

- duas versões do mesmo cálculo apontando para imagens históricas distintas;
- kit apontando para a imagem atual mais recente;
- cálculo antigo ainda exportável/consultável com sua referência anterior;
- auditoria e testes do fluxo sem foto.

## Concluída quando

O usuário pode escolher uma foto opcional no começo de Calcular, e o salvamento preserva corretamente
a imagem atual e o snapshot histórico sem alterar as regras comerciais existentes.

## Resultado da execução

- A tela Calcular passou a oferecer foto opcional logo após a folha Korp, com prévia local,
  substituição e remoção da seleção antes do salvamento.
- A prévia consulta somente os metadados da foto atual do kit e informa explicitamente quando ela
  será mantida ou substituída; nenhum ativo é criado durante a prévia.
- O salvamento usa `multipart/form-data` para transportar planilha, controles e imagem sem Base64,
  mantendo compatibilidade com o corpo binário legado quando não há imagem.
- Foto nova em cálculo existente exige nova versão. A criação do ativo, a atualização de
  `Kit.currentImageId`, o snapshot em `CalculationVersion.kitImageId` e a auditoria com origem
  `CALCULATION` acontecem na mesma transação.
- Nova versão sem foto herda a imagem atual do kit. O vínculo simples de outro cliente, sem foto e
  sem recálculo, preserva a versão e sua imagem histórica.
- O backend revalida lista e versão ativa, cliente e classe, imagem, permissão e o identificador da
  foto atual observado na prévia. Consultas retornam somente `ImageReference`, nunca blobs.
- Verificações aprovadas: typecheck, lint, build, 186 testes Vitest e o E2E específico de Cálculos
  (selecionar, trocar, remover, manter foto atual e salvar por multipart).

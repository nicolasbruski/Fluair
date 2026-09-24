# Notas de implementação — migração do domínio de listas de preço

## 1. Escopo e decisão

Este documento registra o desenho técnico da `TASK-002`. Ele não executa a migração.

A estratégia escolhida é **expandir, copiar, validar e só então trocar as leituras**, mantendo as tabelas legadas durante toda a janela de rollback. Os registros copiados reutilizam os UUIDs atuais. Assim, versões, itens e cálculos históricos não precisam ser reconstruídos e continuam apontando para a fotografia de preço originalmente utilizada.

Não será feita uma simples renomeação de `kit_price_lists` para `price_lists`: a tabela atual representa a combinação kit/perfil usada para numerar o histórico de cálculos, enquanto a nova lista é uma definição comercial global e versionada.

## 2. Nomes finais

| Conceito                              | Modelo Prisma final    | Tabela física final      |
| ------------------------------------- | ---------------------- | ------------------------ |
| Definição da lista                    | `PriceList`            | `price_lists`            |
| Versão imutável                       | `PriceListVersion`     | `price_list_versions`    |
| Item fotografado na versão            | `PriceListItem`        | `price_list_items`       |
| Série de cálculos de um kit por lista | `KitCalculationSeries` | `kit_calculation_series` |
| Associação com classe                 | `PriceListClass`       | `price_list_classes`     |
| Associação com segmento               | `PriceListSegment`     | `price_list_segments`    |

Os tipos de lista serão `KIT_COMPONENT` e `STANDALONE_PRODUCT`. Situação será representada inicialmente por `active Boolean`, sem excluir a possibilidade de um enum de ciclo de vida em evolução futura.

## 3. Mapa campo a campo

### 3.1 `PriceProfile` → `PriceList`

Cada perfil atual origina exatamente uma lista `KIT_COMPONENT`.

| Origem                  | Destino                | Regra de migração                                   |
| ----------------------- | ---------------------- | --------------------------------------------------- |
| `PriceProfile.id`       | `PriceList.id`         | Copiar o mesmo UUID.                                |
| `code`                  | `code`                 | Copiar sem normalizar ou recodificar.               |
| `name`                  | `name`                 | Copiar integralmente.                               |
| —                       | `type`                 | Preencher com `KIT_COMPONENT`.                      |
| —                       | `minimumOrderQuantity` | `null`; perfil legado não possui faixa.             |
| —                       | `maximumOrderQuantity` | `null`; perfil legado não possui faixa.             |
| `activeMatrixVersionId` | `activeVersionId`      | Copiar o mesmo UUID somente após copiar as versões. |
| —                       | `active`               | `true`, preservando o comportamento atual.          |
| `createdAt`             | `createdAt`            | Copiar.                                             |
| `updatedAt`             | `updatedAt`            | Copiar.                                             |

`code` continua único. A FK de versão ativa deve usar `ON DELETE SET NULL`. O serviço deve confirmar que a versão ativada pertence à própria lista; a FK isolada não garante essa regra.

### 3.2 `PriceMatrixVersion` → `PriceListVersion`

| Origem             | Destino            | Regra de migração                                                                 |
| ------------------ | ------------------ | --------------------------------------------------------------------------------- |
| `id`               | `id`               | Copiar o mesmo UUID.                                                              |
| `profileId`        | `priceListId`      | Usar o mesmo UUID, pois `PriceList.id = PriceProfile.id` para registros migrados. |
| `version`          | `version`          | Copiar; não renumerar.                                                            |
| `fileName`         | `fileName`         | Copiar.                                                                           |
| `mimeType`         | `mimeType`         | Copiar.                                                                           |
| `fileSize`         | `fileSize`         | Copiar.                                                                           |
| `fileHash`         | `fileHash`         | Copiar.                                                                           |
| `sourceFile`       | `sourceFile`       | Copiar o BLOB sem transformação.                                                  |
| `itemCount`        | `itemCount`        | Copiar e reconciliar com a contagem real de itens.                                |
| `importedByUserId` | `importedByUserId` | Copiar; manter `ON DELETE RESTRICT`.                                              |
| `createdAt`        | `createdAt`        | Copiar.                                                                           |

As unicidades finais permanecem `(price_list_id, version)` e `(price_list_id, file_hash)`. Nenhuma versão histórica será atualizada com conteúdo de outra versão.

### 3.3 `PriceMatrixItem` → `PriceListItem`

| Origem            | Destino              | Regra de migração                                                                  |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `id`              | `id`                 | Copiar o mesmo UUID.                                                               |
| `matrixVersionId` | `priceListVersionId` | Copiar o UUID da versão, preservado na tabela nova.                                |
| `productCode`     | `productCode`        | Copiar como texto.                                                                 |
| —                 | `description`        | `null` para o legado quando não houver fonte inequívoca; não inferir de `Product`. |
| `minimumPrice`    | `minimumPrice`       | Copiar com `DECIMAL(15,4)`.                                                        |
| `normalPrice`     | `normalPrice`        | Copiar com `DECIMAL(15,4)`.                                                        |
| —                 | `reference`          | `null` para itens de componentes.                                                  |
| —                 | `unitPrice`          | `null` para itens de componentes.                                                  |
| —                 | `ipiRate`            | `null` para itens de componentes.                                                  |
| —                 | `ipiIncluded`        | `null` para itens de componentes; novas listas avulsas devem registrar `true`.     |
| `sourceRow`       | `sourceRow`          | Copiar.                                                                            |
| `rawData`         | `rawData`            | Copiar o JSON sem transformação.                                                   |

Durante a transição, os campos de preço específicos do tipo serão anuláveis no banco. O domínio exigirá `minimumPrice` e `normalPrice` para `KIT_COMPONENT`, e `unitPrice` mais o marcador de IPI para `STANDALONE_PRODUCT`. A unicidade continua sendo `(price_list_version_id, product_code)`.

### 3.4 `KitPriceList` → `KitCalculationSeries`

`KitPriceList` não será promovida à definição geral de lista. Ela será copiada como a identidade estável da sequência de cálculos de um kit sob uma lista.

| Origem            | Destino                   | Regra de migração                                             |
| ----------------- | ------------------------- | ------------------------------------------------------------- |
| `KitPriceList.id` | `KitCalculationSeries.id` | Copiar o mesmo UUID.                                          |
| `kitId`           | `kitId`                   | Copiar; manter `ON DELETE RESTRICT`.                          |
| `profileId`       | `priceListId`             | Copiar o UUID, que identifica a nova `PriceList` equivalente. |
| `createdAt`       | `createdAt`               | Copiar.                                                       |
| `updatedAt`       | `updatedAt`               | Copiar.                                                       |

A unicidade final será `(kit_id, price_list_id)`. Listas `STANDALONE_PRODUCT` não podem possuir uma série de cálculo de kit.

### 3.5 FKs de `CalculationVersion`

Os IDs das próprias `CalculationVersion` e `CalculationItem` não mudam.

| Campo legado                                     | Campo novo durante a expansão                             | Backfill             |
| ------------------------------------------------ | --------------------------------------------------------- | -------------------- |
| `price_list_id` → `kit_price_lists.id`           | `kit_calculation_series_id` → `kit_calculation_series.id` | Copiar o mesmo UUID. |
| `matrix_version_id` → `price_matrix_versions.id` | `price_list_version_id` → `price_list_versions.id`        | Copiar o mesmo UUID. |

Os campos legados permanecem preenchidos e com suas FKs enquanto houver compatibilidade com a aplicação anterior. A aplicação nova passa a nomear as relações como `series` e `priceListVersion`. O número da versão do cálculo continua único por série, preservando exatamente a regra atual `(price_list_id, version)`.

Antes do corte de leitura, deve ser validado que a lista da série e a lista da versão usada no cálculo são a mesma. Divergências bloqueiam a migração e não devem ser corrigidas automaticamente.

## 4. Ordem da migração aditiva

1. Criar `price_lists` com `active_version_id` anulável, ainda sem preencher a FK ativa.
2. Criar `price_list_versions` e suas FKs para lista e usuário.
3. Criar `price_list_items` e a FK para versão.
4. Criar `kit_calculation_series` e suas FKs para kit e lista.
5. Copiar perfis, versões, itens e combinações kit/perfil na mesma transação quando o volume permitir, sempre preservando UUIDs.
6. Preencher `price_lists.active_version_id` e adicionar/validar sua FK.
7. Adicionar a `calculation_versions` as colunas anuláveis `kit_calculation_series_id` e `price_list_version_id`.
8. Fazer o backfill das duas colunas por igualdade de UUID e validar todas as relações.
9. Tornar as novas FKs obrigatórias somente depois de a reconciliação retornar zero divergências.
10. Criar `price_list_classes` e `price_list_segments` em migrações posteriores, quando as entidades de classificação existirem.

As tabelas e colunas legadas não são apagadas nesta sequência. Não serão usados `DROP TABLE`, `DROP COLUMN`, regeneração de UUID, renumeração de versões ou reconstrução de cálculo a partir da lista ativa.

## 5. Compatibilidade de aplicação

O corte será feito em três estágios:

1. **Expandir:** aplicar as novas tabelas e o backfill com a versão atual da aplicação ainda lendo o legado.
2. **Compatibilizar:** a aplicação nova lê o modelo geral. Escritas de listas `KIT_COMPONENT` mantêm o legado sincronizado na mesma transação durante a janela de rollback. Listas `STANDALONE_PRODUCT` existem apenas no modelo novo e são invisíveis para a aplicação antiga.
3. **Contrair em mudança futura separada:** retirar o legado somente após reconciliação em produção, backup testado e encerramento formal da janela de rollback. Essa remoção não faz parte das tarefas de migração aditiva deste plano.

Auditorias existentes continuam referenciando os mesmos UUIDs de versão. Novas ações usam os nomes gerais de entidade, mas não reescrevem eventos históricos.

## 6. Consultas obrigatórias de reconciliação

A migração futura deve materializar testes equivalentes aos seguintes controles:

- contagem de `price_profiles` igual à contagem de listas migradas com `type = 'KIT_COMPONENT'`;
- ausência de `PriceProfile.id` sem `PriceList.id` idêntico;
- contagem de versões e itens legados igual à contagem dos respectivos registros migrados;
- ausência de diferença, por UUID, em versão, hash, BLOB, preços decimais, linha de origem e JSON bruto;
- `item_count` de cada versão igual ao total real de itens nos dois modelos;
- nenhuma versão ou item órfão;
- toda `active_matrix_version_id` convertida para o mesmo `active_version_id` e pertencente à lista correta;
- toda `KitPriceList` convertida para série com o mesmo UUID, kit e lista equivalente;
- toda `CalculationVersion` ligada à série e à versão nova com os mesmos UUIDs das FKs antigas;
- lista da série igual à lista proprietária da versão em cada cálculo;
- contagens de cálculos, itens de cálculo e vínculos com clientes inalteradas.

Qualquer divergência aborta o corte da aplicação. Relatórios devem mostrar os UUIDs divergentes, sem reparo automático.

## 7. Rollback

O rollback operacional preferencial é retornar à versão anterior da aplicação e manter as estruturas expandidas no banco. Como as tabelas legadas permanecem e as escritas de componentes são sincronizadas durante a janela, o sistema anterior continua operando com os dados que conhece.

Se a falha ocorrer antes do corte da aplicação, basta desativar o novo caminho; não é necessário desfazer schema ou dados. Se ocorrer depois da criação de listas avulsas, a aplicação antiga não as exibirá, mas elas permanecerão preservadas para um novo avanço.

Não se deve executar uma migração reversa que apague tabelas novas depois de haver escrita de produção. Remoção física exige backup validado, reconciliação final e migração própria. O padrão para falhas após o corte é corrigir e avançar, não apagar histórico.

## 8. Pontos reservados para tarefas posteriores

- `TASK-003` cria classes e segmentos; este documento apenas reserva as associações futuras.
- `TASK-011` e `TASK-012` materializam a definição geral e suas associações de público.
- `TASK-013` materializa versões, itens e séries, executa a cópia aditiva e mantém escrita dupla de
  matrizes e cálculos durante a compatibilidade.
- `TASK-014` passa a consumir esse modelo na API administrativa, sem refazer a migração histórica.
- A classificação de perfis em classes só ocorre quando o mapeamento for inequívoco. Exportação ou qualquer perfil sem correspondência confirmada não recebe associação inventada.
- A descrição ausente em item legado permanece ausente; ela não será obtida do cadastro mutável de produtos.

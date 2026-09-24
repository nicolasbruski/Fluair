# Tela de Busca de Cálculos

## Identificação

- Rota conceitual: `/calculos`
- Permissão mínima: `calculation.view`
- Estado atual: integrada aos cálculos persistidos pela API
- Prioridade: primeira migração funcional

## Objetivo

Permitir que usuários localizem resultados de cálculos já realizados. A unidade pesquisada é um cálculo salvo de um kit para um perfil de preço, e não um produto cadastrado manualmente.

## Origem dos registros

Os registros reais desta tela serão criados quando um usuário concluir com sucesso um cálculo na tela de Cálculo. Portanto:

- não haverá inicialmente uma tela separada para cadastrar produtos;
- um kit aparecerá na busca depois que existir ao menos um cálculo persistido;
- produtos da composição serão derivados da folha Korp processada;
- versões antigas permanecerão disponíveis no histórico;
- a listagem principal deve mostrar, por padrão, o cálculo atual de cada combinação de kit e perfil de preço.

## Componentes

| Componente | Responsabilidade |
|---|---|
| Campo de busca | Pesquisar por código ou descrição do kit |
| Filtro de perfil de preço | Todos, Implementador, Comércio/Reposição ou Consumidor Final |
| Contador de resultados | Informar quantos registros correspondem aos filtros |
| Tabela principal | Exibir cálculos atuais encontrados |
| Cabeçalhos ordenáveis | Ordenar por kit, descrição, perfil, preços ou data |
| Ação Ver | Abrir o detalhe pelo identificador do cálculo |
| Paginação | Navegar sem carregar todos os registros de uma vez |
| Estado vazio | Informar que nenhum cálculo corresponde à busca |
| Buscas recentes | Recurso secundário; sua permanência ainda deve ser confirmada |

## Mapeamento técnico do protótipo

| Elemento ou comportamento | Identificador/função atual |
|---|---|
| Container | `#s-busca` |
| Busca textual | `#busca-q` / `buscaFiltrar()` |
| Filtro de perfil | `#busca-cli` / `buscaFiltrar()` |
| Contador | `#busca-count` |
| Corpo da tabela | `#busca-tbody` / `buscaRender()` |
| Ordenação | `buscaSort(col)` |
| Paginação | `#busca-pg`, `buscaRenderPg()` e `buscaGoPage()` |
| Fonte de dados | `GET /api/v1/calculations` |
| Integração frontend | `src/web/search-page.ts` |
| Abertura do detalhe | O botão abre `/calculos/:calculoId` pelo UUID persistido |

## Colunas da tabela

| Coluna | Origem |
|---|---|
| Código | Código extraído da folha Korp |
| Descrição | Descrição do kit registrada no cálculo |
| Perfil de preço | Perfil/matriz usado no cálculo; o protótipo chama esta coluna de Cliente |
| Tabela mínima | Total mínimo congelado no cálculo |
| Tabela normal | Total normal congelado no cálculo |
| Calculado em | Data e hora da execução |
| Por | Usuário responsável |
| Ações | Abertura do detalhe e ações permitidas |

## Fluxo principal

1. A tela carrega a primeira página de cálculos atuais.
2. O usuário informa parte do código ou da descrição.
3. Pode combinar o texto com um perfil de preço.
4. O backend aplica filtro, ordenação e paginação.
5. A interface atualiza contador e linhas.
6. Ao clicar em `Ver`, navega para o detalhe usando um identificador estável.

## Busca e paginação

O grid principal exibe a referência própria do kit. Registros anteriores à inclusão desse
campo exibem `—`. A busca textual e a ordenação também aceitam a referência.

- O texto deve ignorar diferença entre maiúsculas e minúsculas.
- A pesquisa deve aceitar código completo ou parcial e parte da descrição.
- Filtros e página devem, idealmente, permanecer na URL para que o usuário volte ao mesmo ponto.
- A paginação atual usa 30 registros por página; esse valor poderá ser mantido inicialmente.
- Ordenação deve ser executada no backend para permanecer correta entre páginas.
- Requisições de digitação podem usar pequeno atraso para evitar chamadas a cada tecla.

## Estados

- **Carregando primeira página:** tabela em estado de carregamento.
- **Atualizando filtros:** manter estrutura da tabela e sinalizar atualização.
- **Sem resultados:** mostrar termo e permitir limpar filtros.
- **Erro:** mensagem com ação de tentar novamente.
- **Resultado removido ou indisponível:** se o detalhe não existir mais ou o usuário perder acesso, retornar à lista com aviso.

## Permissões

- `calculation.view`: acessa a lista e abre detalhes.
- `calculation.history`: controla ações de histórico.
- `calculation.export`: controla ações de exportação, caso sejam adicionadas à lista.
- A busca nunca deve retornar registros aos quais o usuário não possa ter acesso, mesmo que ele manipule os parâmetros da API.

## Estado implementado

- O HTML entregue pela aplicação não contém kits demonstrativos, buscas recentes nem estado global da Busca.
- A tela consulta somente `CalculationVersion.current = true`, uma linha por combinação de kit e lista de preço.
- Busca textual, filtro por lista, ordenação e paginação são executados no backend.
- A ordem inicial é da data mais recente para a mais antiga, com 30 registros por página.
- Busca, perfil, ordenação, direção e página são preservados na URL.
- Totais são lidos das fotografias persistidas do cálculo e enviados como strings decimais.
- Cada linha mostra a miniatura fotografada na `CalculationVersion`; ausência ou erro usa o
  placeholder compartilhado. A mesma referência aparece ao abrir Detalhes.
- A resposta paginada contém somente metadados e URL autenticada da miniatura, sem blob ou Base64.
- O frontend trata carregamento, vazio, erro recuperável e sucesso mantendo o layout da tabela original.
- A descrição exibida remove o trecho legado `Usuario: <nome>` quando ele vier incorporado ao texto; o responsável continua visível na coluna `Por`.
- O endpoint exige `calculation.view`.
- A unidade da grade ficou definida como uma linha por combinação de kit e lista/perfil de preço.

## Comportamento alvo do backend

A consulta deve retornar uma resposta paginada contendo:

- identificador do cálculo;
- código e descrição do kit;
- identificador e nome do perfil de preço;
- total mínimo e normal;
- número da versão do cálculo;
- data de criação;
- usuário responsável;
- indicador de versão atual.

## Critérios de aceite

- Um cálculo recém-salvo aparece na busca sem alteração manual do HTML. Implementado.
- Filtros, ordenação e paginação funcionam com dados do banco.
- Abrir e voltar do detalhe preserva os filtros usados.
- Valores exibidos são os valores persistidos, sem novo cálculo no navegador.
- O texto `Cliente` é substituído por `Perfil de preço` onde se referir à matriz.
- Estado vazio e erro de carregamento são claramente diferentes.
- Usuário sem `calculation.view` não acessa tela nem endpoint.

## Decisões pendentes

- Manter ou remover `Buscas Recentes`.
- Permitir pesquisa por código de um componente para encontrar kits que o utilizam.

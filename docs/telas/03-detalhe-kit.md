# Tela de Detalhe do Kit Calculado

## Identificação

- Rota conceitual: `/calculos/:calculoId`
- Permissão mínima: `calculation.view`
- Estado atual: integrada à fotografia persistida do cálculo
- Prioridade: primeira migração funcional

## Objetivo

Exibir a fotografia completa de um cálculo já salvo: identificação do kit, perfil de preço, responsável, versão da matriz, totais e composição utilizada naquele momento.

Embora o nome visual possa continuar como “Detalhe do Kit”, a rota deve identificar um cálculo específico. Um mesmo código de kit poderá ter versões e perfis de preço diferentes.

O cabeçalho também apresenta os clientes vinculados à versão, usando a fotografia histórica de
código e razão social salva em `calculation_customers`.

## Entradas da tela

- Identificador único do cálculo vindo da URL.
- Sessão do usuário e permissões efetivas.

Não se deve localizar o detalhe pela posição do registro em uma lista, como acontece no JavaScript atual.

## Componentes

| Componente | Responsabilidade |
|---|---|
| Voltar para Busca | Retornar preservando filtros e página quando possível |
| Cabeçalho de identificação | Código, descrição, perfil, data, usuário e versão |
| Ação Histórico | Abrir histórico completo quando permitido |
| Ações Exportar Excel e PDF | Gerar arquivos com a fotografia do cálculo |
| Ação Gerar pedido | Atalho futuro; fora do primeiro escopo funcional |
| Card Tabela mínima | Total mínimo persistido |
| Card Tabela normal | Total normal persistido |
| Card Composição | Quantidade de itens e itens sem preço |
| Tabela de composição | Valores detalhados de cada componente |

## Mapeamento técnico do protótipo

| Elemento ou comportamento | Identificador/função atual |
|---|---|
| Container | `#s-detalhe` |
| Conteúdo dinâmico | `#detalhe-main` / `renderDetalhe()` |
| Abertura pela busca | `verDetalhe()` e `verDetalheByCode()` |
| Voltar | `voltarBusca()` |
| Composição simulada | `generateMockComposition()` |
| Histórico resumido | `openHistoricoModal()` |
| Exportação | `expDetalhe()` |
| Atalho para pedido | `iniciarPedidoDoKit()` |

O estado selecionado fica atualmente em `window._detalheItem` e `window._detalheItems`. Esses estados globais deverão ser substituídos pelo identificador da rota e pelos dados retornados pelo backend.

## Colunas da composição

- Operação, quando fornecida pelo Korp.
- Condição, quando fornecida pelo Korp.
- Código do produto.
- Descrição do produto no momento do cálculo.
- Quantidade.
- Unidade de medida.
- Preço unitário mínimo.
- Total mínimo do item.
- Preço unitário normal.
- Total normal do item.
- Situação de preço encontrado ou ausente.

## Regras de exibição

- Os totais devem vir do cálculo salvo, e não ser refeitos com a matriz atual.
- A composição é imutável para fins de histórico.
- Itens sem preço devem ser claramente identificados, inclusive quando o valor for zero.
- Perfil de preço e versão da matriz devem aparecer explicitamente.
- Se o cálculo foi substituído por uma versão mais recente, mostrar que ele é histórico e oferecer acesso à versão atual.
- Datas e usuário devem indicar quem efetivamente executou o cálculo.
- As descrições exibidas removem o trecho legado `Usuario: <nome>` quando ele vier incorporado ao texto; o responsável permanece no campo `Por`.

## Ações

### Exportar Excel e PDF

O PDF usa A4 em modo paisagem, com foto histórica no cabeçalho, tabela paginada, cabeçalho
repetido e rodapé numerado. O Excel é um workbook `.xlsx` real, com a mesma foto incorporada,
células numéricas, data formatada, painel congelado e área de impressão. O histórico oferece os
dois formatos para cada versão e usa exclusivamente o ativo fotografado nela. A indisponibilidade da
foto não impede a geração dos documentos.

Disponível com `calculation.export`. Deve exportar exatamente a composição e os totais desta versão. A exportação pode ser gerada pelo backend ou pelo frontend usando os dados salvos, mas nunca consultando a matriz atual para substituir valores.

### Histórico de versões

Disponível com `calculation.history`. Navega para o histórico do mesmo código de kit e perfil de preço ou abre um modal consistente com esse conteúdo.

### Gerar pedido com este kit

Disponível com `order.access` somente para a versão atual. Transfere o `calculationId` para
`/pedidos/novo`, inclui inicialmente o kit pela tabela mínima e exige a seleção de cliente e lista
antes da validação server-side da cotação.

## Estados

- **Carregando:** estrutura da página e tabela em carregamento.
- **Não encontrado:** cálculo inexistente ou identificador inválido.
- **Sem permissão:** usuário autenticado, mas sem acesso.
- **Cálculo incompleto:** permitir consulta, destacando itens sem preço.
- **Erro na exportação:** manter a tela aberta e permitir nova tentativa.

## Estado implementado

- O botão `Ver` abre `/calculos/:calculoId` usando o UUID retornado pela Busca.
- `GET /api/v1/calculations/:id` retorna metadados, totais e `CalculationItem` fotografados.
- Totais e itens não são recalculados com a lista atual.
- A exportação usa exclusivamente os dados carregados da versão selecionada.
- As exportações carregam a variante `display` autenticada, incorporam a foto no PDF e no `.xlsx`
  e continuam sem imagem se o ativo estiver indisponível.
- Histórico, exportação e pedido aparecem conforme as permissões efetivas.
- `generateMockComposition()`, `renderDetalhe()` e as exportações artificiais foram removidos do bundle.

## Dados necessários do backend

- cálculo e versão;
- código e descrição do kit;
- perfil de preço;
- matriz e versão usadas;
- totais mínimo e normal;
- quantidade total de componentes e itens sem preço;
- usuário e data;
- lista completa de itens fotografados;
- indicação de versão atual ou histórica.

## Critérios de aceite

- O detalhe aberto corresponde ao identificador selecionado na busca.
- Totais do cabeçalho, soma dos itens e exportação são consistentes.
- Atualizar uma matriz não altera esta página para cálculos antigos.
- Itens sem preço aparecem com status claro.
- Histórico e exportação obedecem suas permissões.
- Abrir uma URL direta funciona após autenticação.
- Um cálculo inexistente apresenta estado próprio, sem quebrar a aplicação.

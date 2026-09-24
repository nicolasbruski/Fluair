# Tela de Histórico de Versões

## Identificação

- Rota conceitual: `/kits/:codigo/historico`
- Permissão mínima: `calculation.history`
- Estado atual: modal do Detalhe integrado às versões persistidas; tela completa permanece fora deste recorte
- Prioridade: primeira migração funcional, após Cálculo e Detalhe

## Objetivo

Apresentar todos os cálculos preservados de um kit, permitindo entender quando o preço ou a composição mudou, qual matriz foi utilizada e quem realizou cada operação.

## Escopo da consulta

O histórico deve ser contextualizado por:

- código do kit;
- perfil de preço;
- opcionalmente uma versão selecionada para comparação.

Como o mesmo kit pode ser calculado para perfis diferentes, a tela não deve misturar os valores sem identificação. A recomendação inicial é abrir o histórico do perfil exibido no detalhe e oferecer um seletor para outros perfis existentes.

## Componentes

| Componente | Responsabilidade |
|---|---|
| Cabeçalho do kit | Código, descrição e perfil de preço |
| Indicador de versões | Quantidade total encontrada |
| Resumo da versão atual | Totais, matriz, data e usuário |
| Resumo da versão selecionada | Comparação com uma versão anterior |
| Linha do tempo | Lista cronológica de cálculos preservados |
| Tag de origem | Primeiro cálculo, nova folha Korp, nova matriz ou recálculo |
| Ver composição | Abrir a fotografia completa da versão |
| Exportar versão | Gerar Excel daquela versão quando permitido |
| Filtros | Perfil, período e tipo de evento, se o volume exigir |

## Mapeamento técnico do protótipo

| Elemento ou comportamento | Identificador/função atual |
|---|---|
| Tela completa | `#s-historico`; conteúdo inteiramente fixo |
| Modal de resumo | `#modal-historico` |
| Título e subtítulo do modal | `#hist-modal-title` e `#hist-modal-sub` |
| Conteúdo do modal | `#hist-modal-body` / `openHistoricoModal()` |
| Versões simuladas | `window._histVersoes` |
| Exportação de versão | `expVersao()` |
| Fechamento | `closeModal('modal-historico')`, clique no overlay ou tecla Esc |

## Evento histórico

Cada versão deve registrar, quando disponível:

- identificador e número da versão;
- data e hora;
- usuário responsável;
- perfil de preço;
- versão da matriz;
- código/hash ou referência da folha Korp;
- total mínimo e normal;
- quantidade de itens e itens sem preço;
- motivo/origem da versão;
- relação com o cálculo anterior.

## Tipos de origem sugeridos

- **Primeiro cálculo:** primeira versão conhecida daquele kit e perfil.
- **Nova folha de processo:** usuário importou uma nova estrutura do Korp.
- **Recálculo por matriz:** mesma composição foi processada com uma matriz nova.
- **Recálculo manual:** usuário solicitou nova execução explicitamente.

O backend deve definir a origem; não se deve inferir apenas pelo texto exibido.

## Comparação

A comparação inicial pode apresentar:

- diferença absoluta e percentual dos totais;
- versão de matriz em cada lado;
- quantidade de itens adicionados, removidos ou alterados;
- quantidade de itens que passaram a ter ou deixaram de ter preço.

Uma comparação detalhada de itens pode ser implementada depois. A primeira versão precisa, no mínimo, permitir abrir a composição completa de cada cálculo.

## Modal versus tela completa

O protótipo contém duas representações:

1. uma tela completa estática chamada `s-historico`;
2. um modal dinâmico aberto a partir do Detalhe do Kit.

Durante a migração, ambas devem compartilhar a mesma fonte e regra. A recomendação é usar a rota completa como experiência principal e, se o modal for mantido, utilizá-lo apenas como resumo com link para o histórico completo.

## Estados

- **Sem histórico:** cálculo atual existe, mas não há versão anterior.
- **Carregando:** resumo e linha do tempo em carregamento.
- **Erro:** falha na consulta sem perder o contexto do kit.
- **Versão não encontrada:** tentativa de abrir uma versão removida ou inválida.
- **Sem permissão de exportação:** histórico visível, mas botão de exportação ausente.

## Permissões

- `calculation.history`: visualizar versões e composições anteriores.
- `calculation.export`: baixar uma versão.
- `matrix.recalculate`: poderá habilitar ação administrativa de recálculo, mas essa ação pertence preferencialmente à tela de Matrizes.

## Estado implementado

- `GET /api/v1/calculations/:id/history` localiza a série selecionada e retorna todas as versões persistidas.
- O modal apresenta versão, lista utilizada, origem, data, responsável, totais e contagens reais.
- `Ver composição` abre a fotografia da versão escolhida pelo UUID.
- A exportação de uma versão consulta o detalhe persistido e exige `calculation.export`.
- Os geradores de versão, datas, usuários e variações artificiais foram removidos do bundle.

## Critérios de aceite

- Todo novo cálculo cria uma versão consultável.
- A versão anterior não muda depois de atualizar a matriz ou recalcular o kit.
- Usuário, data, matriz e origem aparecem corretamente.
- Abrir composição e exportar usa os itens fotografados naquela versão.
- Perfis de preço diferentes não são confundidos.
- A versão atual é identificada sem apagar as anteriores.
- Modal e tela completa, se ambos existirem, mostram os mesmos dados.

## Decisões pendentes

- Necessidade da comparação detalhada item a item na primeira versão.
- Retenção indefinida ou política futura de arquivamento.
- Exibição do nome original e hash da folha Korp para auditoria.

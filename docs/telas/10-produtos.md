# Tela de Produtos

## Identificação

- Rota: `/produtos`
- Consulta: `price.view`
- Gestão de fotos: `catalog.manage`
- Estado: catálogo unificado implementado

## Catálogo

A tela lista kits disponíveis e produtos presentes em versões ativas de listas
`STANDALONE_PRODUCT`. Um produto oferecido por várias listas aparece uma única vez por identidade e
código; suas listas permanecem origens comerciais, não identidades diferentes. Componentes que
existem apenas dentro de kits não são promovidos a produtos avulsos.

`GET /api/v1/catalog` aceita busca, filtro (`ALL`, `KITS`, `PRODUCTS` ou `WITHOUT_IMAGE`), página e
tamanho de página. Cada item contém somente `ImageReference | null`, origens e metadados. Blobs não
são selecionados nem serializados.

## Gestão da foto atual

Usuários com `catalog.manage` podem adicionar, substituir e remover a foto atual de produto ou kit.
O modal aceita JPEG, PNG e WebP até 5 MB, apresenta prévia local e impede confirmação duplicada.
Toda mutação é revalidada no backend e auditada com usuário, entidade, ativo anterior, ativo novo,
origem e `requestId`.

Substituir cria um ativo imutável e muda apenas o vínculo atual. Remover limpa o vínculo, sem apagar
ativos usados por versões históricas. Alterar a foto de um kit nesta tela afeta Produtos e Pedidos,
mas não altera Buscar, Detalhes ou exportações de cálculos antigos.

## Apresentação

Cada linha mantém miniatura ou placeholder, tipo, código, descrição, referência, origem e ações. A imagem tem
texto alternativo útil, carregamento lazy e dimensões estáveis. No layout móvel, miniatura, código,
descrição e ação principal permanecem acessíveis.

## Critérios verificados

- catálogo paginado e deduplicado;
- filtros por tipo e sem foto;
- usuário sem `catalog.manage` não vê ações nem consegue mutar pela API;
- conteúdo falso, SVG, arquivo corrompido, tamanho e pixels excessivos são recusados;
- alteração atual não reescreve snapshots históricos;
- respostas não contêm Base64 ou blobs.

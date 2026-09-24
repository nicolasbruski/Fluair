# Especificação — Fotos de kits e produtos

## 1. Status do documento

- Status: requisitos funcionais e técnicos consolidados para planejamento
- Data: 2026-09-23
- Próxima etapa: derivar um `tasks.md` curto, com entregas verticais e verificáveis
- Escopo desta etapa: especificação somente; nenhuma implementação está incluída
- Diretriz de planejamento: o futuro `tasks.md` deve possuir aproximadamente 6 tarefas e não deve
  ultrapassar 8 tarefas sem uma justificativa técnica concreta

## 2. Objetivo

Permitir que kits e produtos avulsos possuam uma foto principal, administrada pelo sistema e exibida
de forma consistente nas telas de Produtos, Pedidos, Buscar, Detalhes e Calcular, além das
exportações em PDF e Excel.

A solução deve preservar o histórico dos cálculos, manter o catálogo atual atualizado, evitar
carregamento excessivo de imagens e continuar funcionando normalmente para os registros que não
possuírem foto.

## 3. Contexto atual

1. `Product`, `Kit`, `CalculationVersion` e `CalculationItem` não possuem campos de imagem.
2. Produtos avulsos e componentes calculados convergem para a identidade persistida em `Product`.
3. O preço de um produto avulso pertence a `PriceListItem`, mas sua identidade pertence a
   `Product`.
4. A tela Produtos é apresentada atualmente como uma consulta de kits calculados.
5. A API de catálogo salvo retorna kits e produtos calculados, mas a tela Produtos utiliza somente
   os kits.
6. O drawer e o carrinho de Pedidos possuem representações próprias dos itens e não carregam
   imagens.
7. Buscar e Detalhes consultam fotografias históricas de cálculos salvos.
8. Calcular envia a folha de processo como corpo binário bruto e não possui upload de foto.
9. O PDF é gerado no navegador com jsPDF.
10. O arquivo chamado de Excel é atualmente uma tabela HTML baixada com extensão `.xls`, e não um
    workbook Excel real.
11. A montagem de Pedido ainda não é persistida; existe apenas a cotação e validação server-side.

## 4. Glossário

### 4.1 Imagem atual

Foto principal atualmente associada a um `Product` ou `Kit`. É usada nas telas de catálogo e de
montagem de pedido.

### 4.2 Imagem da versão

Referência imutável para a foto usada quando uma `CalculationVersion` foi criada. É usada em
Buscar, Detalhes e exportações do cálculo para preservar o histórico.

### 4.3 Original processado

Imagem normalizada pelo backend depois do upload, com orientação corrigida, metadados removidos,
dimensões limitadas e compressão adequada. O sistema não precisa preservar os bytes exatos do
arquivo enviado pelo usuário.

### 4.4 Miniatura

Versão reduzida da imagem destinada a tabelas, cards, drawer e carrinho.

### 4.5 Placeholder

Representação visual exibida quando o item não possui foto ou quando a imagem não pode ser
carregada.

## 5. Decisões consolidadas

1. Cada produto e cada kit terá no máximo uma foto principal atual.
2. A foto de produto pertence a `Product`, nunca a `PriceListItem`.
3. A foto de kit pertence a `Kit` e pode ser fotografada em `CalculationVersion`.
4. A alteração de uma foto cria um novo arquivo imutável; arquivos antigos não são sobrescritos.
5. Produtos e Pedidos mostram a imagem atual da entidade.
6. Buscar, Detalhes, histórico e exportações mostram a imagem fotografada na versão do cálculo.
7. Cálculos antigos sem foto continuam sem foto e usam placeholder; não será inventado um vínculo
   retroativo com uma imagem atual.
8. A foto será opcional em todos os fluxos.
9. A tela Calcular permitirá selecionar a foto no começo do fluxo.
10. A foto principal do kit aparecerá no cabeçalho do cálculo e da exportação.
11. A primeira entrega não colocará uma foto em cada linha da composição do kit.
12. A exportação Excel passará a produzir um arquivo `.xlsx` real quando incorporar imagens.
13. O catálogo e as listagens não transportarão imagens em Base64 dentro do JSON.
14. Imagens serão servidas por URLs autenticadas e terão variantes adequadas ao contexto.
15. A primeira implementação usará MySQL para os binários, por meio de uma abstração que permita
    migrar futuramente para armazenamento compatível com S3.
16. JPEG, PNG e WebP serão os formatos aceitos na entrada; SVG não será aceito.

## 6. Escopo funcional

### 6.1 Incluído

- persistência e processamento seguro das imagens;
- imagem atual de `Product` e `Kit`;
- imagem histórica de `CalculationVersion`;
- upload, substituição e remoção de foto na tela Produtos;
- catálogo de kits e produtos avulsos na tela Produtos;
- foto opcional no começo do fluxo de Calcular;
- propagação das imagens pelos contratos de API;
- miniaturas no drawer e no carrinho de Pedidos;
- foto nas telas Buscar e Detalhes;
- foto no PDF do cálculo;
- foto em workbook `.xlsx` real;
- placeholder, carregamento, erro e responsividade;
- permissões, auditoria, migração e testes.

### 6.2 Fora de escopo

- galeria com várias fotos por item;
- vídeo, documento, desenho técnico ou arquivo 3D;
- editor avançado de corte e filtros;
- reconhecimento automático de produto por imagem;
- importação em massa de fotos por arquivo ZIP;
- foto individual em cada linha da composição do PDF ou Excel;
- persistência do Pedido e fotografia da imagem dentro de um pedido salvo;
- publicação pública das imagens;
- integração obrigatória com S3 na primeira entrega.

## 7. Requisitos funcionais — mídia e armazenamento

### RF-MID-001 — Ativo de mídia

Cada imagem persistida deve possuir identificador próprio e armazenar pelo menos:

- nome original seguro;
- tipo MIME normalizado;
- tamanho do arquivo processado;
- largura e altura;
- hash SHA-256;
- conteúdo ou chave de armazenamento;
- variante de exibição;
- miniatura;
- usuário responsável;
- data de criação.

### RF-MID-002 — Imutabilidade

Substituir uma foto deve criar um novo ativo e atualizar somente os vínculos aplicáveis. Um arquivo
já usado por uma versão histórica não pode ser alterado em lugar.

### RF-MID-003 — Validação real

O backend deve validar o conteúdo decodificado da imagem, e não confiar apenas em nome, extensão ou
`Content-Type` enviado pelo navegador.

### RF-MID-004 — Normalização

No upload, o backend deve:

- corrigir orientação;
- remover metadados EXIF;
- limitar dimensões;
- impedir imagens excessivamente grandes depois da descompressão;
- comprimir a imagem;
- gerar miniatura;
- gerar formato e qualidade consistentes.

### RF-MID-005 — Limites

A configuração inicial deve aceitar JPEG, PNG e WebP, com limite de 5 MB por upload e limite de
aproximadamente 12 megapixels na entrada. Os valores devem ficar centralizados em configuração ou
constantes compartilhadas.

### RF-MID-006 — Leitura por variante

O sistema deve servir pelo menos duas variantes:

- `thumb`, usada em listagens e cards;
- `display`, usada em Detalhes, prévia e ampliação.

### RF-MID-007 — Cache

Como os ativos são imutáveis, a resposta binária deve possuir `ETag` e cache privado de longa
duração. A troca de imagem deve resultar em outro identificador/URL.

### RF-MID-008 — Remoção segura

Remover uma foto atual deve limpar o vínculo da entidade, sem apagar ativos ainda referenciados por
cálculos históricos. Ativos sem referência podem ser removidos por rotina posterior e segura.

### RF-MID-009 — Ausência e falha

Ausência de foto ou falha de carregamento deve produzir placeholder com dimensões estáveis. A falha
de uma imagem não pode impedir a consulta, cotação ou exportação dos demais dados.

## 8. Requisitos funcionais — identidade de produto e kit

### RF-CAT-001 — Imagem do produto

A imagem de um produto deve ser vinculada à identidade `Product`. O mesmo código em várias listas
de preço deve apresentar a mesma foto.

### RF-CAT-002 — Imagem do kit

A imagem atual do kit deve ser vinculada a `Kit`, independentemente da lista de componentes ou do
cliente usado em um cálculo.

### RF-CAT-003 — Imagem fotografada

Ao criar uma nova `CalculationVersion`, o sistema deve registrar a imagem escolhida para aquela
versão. Se nenhuma nova imagem for enviada, deve fotografar a imagem atual do kit, quando existir.

### RF-CAT-004 — Cálculo existente

Selecionar uma nova foto durante o cálculo é uma mudança versionável. Se já existir um cálculo
atual e o usuário escolher outra foto, o salvamento deve criar uma nova versão, em vez de alterar a
imagem da versão existente.

### RF-CAT-005 — Vínculo simples de cliente

Quando o fluxo apenas vincular outro cliente a um cálculo já existente, sem recálculo e sem nova
foto, a imagem da versão existente deve permanecer inalterada.

### RF-CAT-006 — Alteração pelo catálogo

Alterar a foto de um kit na tela Produtos modifica sua imagem atual para Produtos e Pedidos, mas não
reescreve `CalculationVersion`. Buscar, Detalhes e exportações históricas continuam com a imagem da
versão.

## 9. Requisitos funcionais — tela Produtos

### RF-PRO-001 — Catálogo unificado

A tela Produtos deve deixar de ser somente “Kits calculados” e passar a consultar:

- kits disponíveis no catálogo;
- produtos avulsos presentes em versões ativas de listas `STANDALONE_PRODUCT`.

Componentes internos que não sejam vendidos por uma lista avulsa não devem aparecer como produto
avulso apenas por existirem em uma composição.

### RF-PRO-002 — Deduplicação

Um produto presente em várias listas ativas deve aparecer uma única vez, identificado pelo
`Product.id` e pelo código. Lista, faixa e preço continuam sendo dados das ofertas, não da imagem.

### RF-PRO-003 — Filtros

A tela deve oferecer filtros compactos para:

- todos;
- kits;
- produtos avulsos;
- itens sem foto.

### RF-PRO-004 — Apresentação

Cada linha ou card deve mostrar miniatura, tipo, código, descrição, origem resumida e ações. A
interface deve continuar utilizável em telas pequenas.

### RF-PRO-005 — Adicionar ou substituir

Usuário autorizado deve poder selecionar uma imagem, visualizar a prévia e confirmar a adição ou
substituição.

### RF-PRO-006 — Remover

Usuário autorizado deve poder remover a imagem atual após confirmação. O histórico deve permanecer
intacto.

### RF-PRO-007 — Feedback

Upload e remoção devem possuir estados de enviando, sucesso e erro. O botão não pode disparar a
mesma alteração duas vezes enquanto a primeira estiver em andamento.

## 10. Requisitos funcionais — tela Calcular

### RF-CAL-001 — Foto opcional no início

O fluxo deve permitir selecionar uma foto opcional logo depois da folha de processo e antes da
seleção de cliente/lista ou da execução do cálculo.

### RF-CAL-002 — Prévia local

A imagem selecionada deve aparecer imediatamente, antes do upload definitivo, com ações para trocar
e remover.

### RF-CAL-003 — Kit existente

Depois que a folha identificar o código do kit, a tela deve informar quando já existe uma imagem
atual e deixar claro se o usuário manterá ou substituirá essa imagem.

### RF-CAL-004 — Prévia calculada

O resultado da prévia deve apresentar a foto que será usada no salvamento, junto de código,
descrição, lista, totais e composição.

### RF-CAL-005 — Salvamento multipart

O salvamento deve aceitar a folha de processo, os campos atuais e a imagem opcional de forma segura.
A imagem não deve ser persistida durante uma prévia que o usuário abandone.

### RF-CAL-006 — Atualização do kit

Ao salvar com uma nova foto, o sistema deve criar o ativo, atualizar a imagem atual de `Kit` e
associar o mesmo ativo à nova `CalculationVersion`, dentro de um fluxo consistente e auditável.

### RF-CAL-007 — Sem foto

Calcular e salvar sem foto deve continuar permitido. A ausência não pode alterar regras comerciais,
preços ou compatibilidade com cliente.

## 11. Requisitos funcionais — tela Buscar

### RF-BUS-001 — Miniatura da versão

Cada resultado deve exibir a miniatura fotografada em sua `CalculationVersion`, antes do código do
kit.

### RF-BUS-002 — Contrato leve

A resposta paginada deve retornar somente metadados e URL da miniatura. O binário não deve fazer
parte do JSON.

### RF-BUS-003 — Layout

A miniatura deve ter tamanho visual entre 48 e 56 px, proporção consistente e cantos arredondados.
Em telas pequenas, imagem, código e descrição podem ser agrupados.

### RF-BUS-004 — Histórico consistente

A foto mostrada na Busca deve ser a mesma que aparecerá ao abrir Detalhes para aquele cálculo.

## 12. Requisitos funcionais — tela Detalhes

### RF-DET-001 — Imagem principal

O cabeçalho deve exibir a imagem da versão do cálculo em tamanho maior, preservando proporção e sem
empurrar dados essenciais para fora da tela.

### RF-DET-002 — Identificação histórica

A interface deve indicar que se trata da “Foto desta versão” quando necessário, especialmente em
versões históricas.

### RF-DET-003 — Ampliação

Quando houver foto, o usuário deve poder abri-la em visualização ampliada acessível por mouse e
teclado.

### RF-DET-004 — Composição

A tabela de composição permanece sem miniaturas por item nesta entrega. Código, descrição,
quantidade e preços continuam sendo o foco da tabela.

### RF-DET-005 — Histórico

O histórico pode exibir uma miniatura por versão se isso não prejudicar o carregamento. No mínimo,
ao abrir uma versão, sua imagem correta deve ser exibida.

## 13. Requisitos funcionais — tela Pedidos

### RF-PED-001 — Drawer

Cada card do drawer deve mostrar a miniatura atual do `Product` ou `Kit`, além de tipo, código,
descrição, lista/faixa e preços já existentes.

### RF-PED-002 — Carrinho

Cada linha do carrinho deve mostrar uma miniatura do item sem reduzir a usabilidade dos campos de
quantidade, preço e imposto.

### RF-PED-003 — Inclusão por outras telas

Um kit enviado ao Pedido pela tela Detalhes deve carregar a imagem adequada no item inicial do
carrinho.

### RF-PED-004 — Validação da cotação

Depois da cotação server-side, o item deve continuar associado à imagem correta. A resposta pode
reafirmar a imagem atual para evitar manter metadados obsoletos.

### RF-PED-005 — Ausência de impacto comercial

A imagem não participa da chave do carrinho, da seleção de lista, dos impostos, da quantidade, do
preço ou da disponibilidade do item.

### RF-PED-006 — Pedido futuro

Quando a persistência definitiva de pedidos for implementada, deverá existir decisão própria sobre
fotografar a imagem no pedido. Isso não faz parte desta entrega.

## 14. Requisitos funcionais — PDF

### RF-PDF-001 — Foto da versão

O PDF deve usar exclusivamente a imagem registrada em `CalculationVersion`.

### RF-PDF-002 — Cabeçalho

A foto deve ficar no cabeçalho do documento, junto de código, descrição, lista, versão, data,
responsável e totais.

### RF-PDF-003 — Proporção

A imagem deve preservar proporção e caber em um retângulo fixo, sem deformação e sem cobrir textos.

### RF-PDF-004 — Paginação

A inclusão da imagem não pode remover cabeçalhos de tabela, rodapés, numeração de páginas ou linhas
da composição.

### RF-PDF-005 — Falha de imagem

Se não houver imagem ou o carregamento falhar, o PDF deve continuar sendo gerado com espaço reduzido
ou placeholder apropriado.

### RF-PDF-006 — Permissão

A exportação continua protegida por `calculation.export`.

## 15. Requisitos funcionais — Excel

### RF-XLS-001 — Workbook real

As exportações com imagem devem gerar `.xlsx` real. Não será aceito HTML com extensão `.xls`.

### RF-XLS-002 — Imagem incorporada

A foto da versão deve ser incorporada ao workbook, e não depender de URL externa para aparecer.

### RF-XLS-003 — Dados tipados

Valores, quantidades e datas devem ser células tipadas e formatadas, não textos pré-formatados.

### RF-XLS-004 — Apresentação

O workbook deve configurar largura de colunas, altura das linhas, cabeçalho, congelamento quando
aplicável, totais e área de impressão.

### RF-XLS-005 — Prévia não salva

A exportação da prévia na tela Calcular deve incorporar a imagem selecionada localmente, mesmo antes
de existir uma `CalculationVersion`.

### RF-XLS-006 — Histórico

Exportar uma versão antiga deve usar a imagem daquela versão, não a imagem atual do kit.

## 16. Modelo de dados conceitual

Os nomes finais podem variar, desde que as relações e garantias sejam preservadas.

### 16.1 MediaAsset

- `id` UUID;
- `originalFileName`;
- `mimeType`;
- `fileSize`;
- `width`;
- `height`;
- `sha256`;
- `displayData` ou `displayStorageKey`;
- `thumbnailData` ou `thumbnailStorageKey`;
- `createdByUserId`;
- `createdAt`.

### 16.2 Product

Adicionar:

- `currentImageId`, opcional;
- relação `currentImage`.

### 16.3 Kit

Adicionar:

- `currentImageId`, opcional;
- relação `currentImage`.

### 16.4 CalculationVersion

Adicionar:

- `kitImageId`, opcional;
- relação `kitImage`.

### 16.5 Restrições

- todos os vínculos são opcionais para compatibilidade;
- apagar um `Product`, `Kit` ou `CalculationVersion` não deve apagar automaticamente um ativo que
  ainda possua outra referência;
- o hash pode apoiar deduplicação, mas arquivos iguais enviados em contextos distintos não devem
  criar vínculos incorretos;
- consultas de listagem nunca devem selecionar os blobs da imagem.

## 17. Contrato compartilhado

As respostas devem utilizar uma estrutura comum semelhante a:

```ts
interface ImageReference {
  id: string;
  thumbnailUrl: string;
  displayUrl: string;
  width: number;
  height: number;
  updatedAt: string;
}
```

O campo deve ser `ImageReference | null` e ser acrescentado, conforme aplicável, a:

- item da Busca;
- detalhe e histórico do cálculo;
- kit do catálogo;
- produto avulso do catálogo;
- produto calculado retornado pelo catálogo salvo;
- linha validada da cotação;
- item do catálogo administrativo de Produtos.

URLs não devem conter caminho físico, chave interna de armazenamento ou informação sensível.

## 18. API — capacidades necessárias

### 18.1 Catálogo administrativo

Deve existir uma consulta paginada capaz de listar kits e produtos avulsos, com busca, tipo e filtro
de itens sem foto. A API deve deduplicar produtos por identidade.

### 18.2 Mutação de imagem

Devem existir operações autenticadas para:

- adicionar/substituir imagem de produto;
- remover imagem de produto;
- adicionar/substituir imagem de kit;
- remover imagem de kit.

### 18.3 Leitura binária

Deve existir endpoint autenticado para ler `thumb` e `display`, com `Content-Type`, `ETag`, cache e
tratamento de ativo inexistente.

### 18.4 Cálculo

O salvamento deve aceitar a imagem opcional sem perder as validações atuais de arquivo, cliente,
lista ativa, versão esperada e recálculo.

### 18.5 Consultas existentes

Busca, Detalhes, catálogo de Pedidos, catálogo salvo, composição e cotação devem incluir a
referência adequada sem carregar o blob.

## 19. Interface e componente compartilhado

Deve existir uma implementação visual comum para reduzir diferenças entre telas. Ela deve suportar:

- miniatura ou imagem de exibição;
- dimensões fixas;
- placeholder por tipo de entidade;
- texto alternativo com código e descrição;
- `loading="lazy"` e `decoding="async"` em listagens;
- estado de erro sem ícone quebrado do navegador;
- ampliação opcional;
- aparência consistente em tema e responsividade atuais.

A imagem não deve ser o único meio de identificar um item. Código, descrição e tipo permanecem
visíveis e acessíveis.

## 20. Permissões e auditoria

### 20.1 Permissão de catálogo

Deve ser criada uma capacidade explícita equivalente a `catalog.manage` para adicionar, substituir
e remover fotos pela tela Produtos. A interface não deve depender apenas da comparação direta com o
papel de administrador.

### 20.2 Permissão de cálculo

Usuários com `calculation.create` podem fornecer a foto do kit no salvamento do cálculo. Se o kit já
possuir outra foto, a interface deve deixar a substituição clara.

### 20.3 Visualização

Usuários com acesso à tela correspondente podem visualizar suas imagens. O endpoint binário deve
exigir sessão válida e uma permissão coerente com o contexto de catálogo/cálculo.

### 20.4 Auditoria

Adicionar, substituir ou remover uma imagem deve registrar:

- ator;
- ação;
- tipo e identificador da entidade;
- ativo anterior, quando houver;
- novo ativo, quando houver;
- origem da alteração, como Produtos ou Calcular;
- `requestId` e data.

## 21. Segurança

- recusar SVG e conteúdo não decodificável;
- verificar assinatura do arquivo;
- limitar bytes e pixels;
- remover EXIF, incluindo localização;
- gerar nomes internos, sem reutilizar o nome enviado como caminho;
- não expor blobs em logs;
- não registrar Base64 ou corpos binários na auditoria;
- aplicar proteção de origem já usada pela aplicação;
- impedir IDOR na mutação e leitura de imagens;
- manter CSP restrita;
- adicionar `blob:` a `img-src` somente para a prévia local da tela Calcular;
- se o armazenamento mudar para outro domínio, revisar CSP e preferir proxy autenticado ou URLs
  assinadas de curta duração.

## 22. Requisitos não funcionais

### RNF-001 — Desempenho

Listagens devem carregar miniaturas e nunca o original. A inclusão de imagem não deve transformar a
paginação em consulta N+1.

### RNF-002 — Tamanho da resposta

JSONs devem conter apenas referência e metadados. Base64 em catálogo ou detalhe é proibido.

### RNF-003 — Disponibilidade

Falha de imagem não pode bloquear dados comerciais, cálculo, cotação ou exportação sem foto.

### RNF-004 — Acessibilidade

Upload, remoção, ampliação e cards devem funcionar por teclado. Toda imagem informativa deve possuir
texto alternativo útil.

### RNF-005 — Responsividade

Em telas pequenas, miniatura, código e descrição permanecem visíveis; colunas secundárias podem ser
reorganizadas.

### RNF-006 — Compatibilidade

Registros existentes e APIs que recebam `image: null` devem continuar funcionando durante a
implantação incremental.

### RNF-007 — Observabilidade

Erros de processamento devem registrar código seguro, `requestId`, tipo detectado e etapa, sem
armazenar o conteúdo da imagem no log.

## 23. Erros de domínio esperados

Os nomes finais podem variar, mas devem existir mensagens claras para:

- imagem vazia;
- imagem maior que o limite;
- formato não permitido;
- conteúdo incompatível com a extensão;
- imagem corrompida;
- dimensão excessiva;
- produto não encontrado;
- kit não encontrado;
- ativo não encontrado;
- ausência de permissão;
- alteração concorrente da entidade;
- tentativa de trocar foto sem criar nova versão quando o cálculo exige versionamento;
- falha ao gerar PDF ou Excel com a imagem.

## 24. Migração e compatibilidade

1. Criar tabela de mídia e relações opcionais.
2. Aplicar a migration sem exigir backfill.
3. Publicar leitura binária e contratos capazes de retornar `image: null`.
4. Publicar placeholder nas telas antes ou junto da liberação de upload.
5. Liberar administração em Produtos.
6. Liberar foto no cálculo e snapshot em novas versões.
7. Propagar para Buscar, Detalhes e Pedidos.
8. Migrar PDF e Excel.

Não deve existir migration que associe automaticamente uma foto atual a cálculos históricos. O
deploy deve permitir rollback de aplicação mantendo o schema expandido, sem operação destrutiva.

## 25. Estratégia de testes

### 25.1 Unitários

- detecção de formato;
- limites de bytes e pixels;
- normalização e geração de miniatura;
- hash e imutabilidade;
- regras de manter, substituir e remover;
- snapshot da imagem no cálculo;
- cálculo existente com foto nova exigindo versão;
- fallback sem foto.

### 25.2 Integração

- upload JPEG, PNG e WebP;
- rejeição de SVG, arquivo falso, corrompido e grande;
- autorização de mutações;
- leitura com `ETag` e cache;
- produto em várias listas usando a mesma imagem;
- kit com imagem atual e versões com snapshots diferentes;
- catálogo, busca, detalhe e cotação retornando metadados corretos;
- remoção atual preservando o histórico;
- auditoria de todas as mutações.

### 25.3 E2E

- adicionar, trocar e remover foto de kit em Produtos;
- adicionar, trocar e remover foto de produto avulso;
- filtrar itens sem foto;
- escolher foto no começo de Calcular;
- salvar cálculo com e sem foto;
- visualizar a foto em Buscar e Detalhes;
- abrir versão histórica com imagem antiga;
- visualizar fotos no drawer e carrinho;
- adicionar kit ao Pedido a partir de Detalhes;
- exportar PDF com e sem foto;
- exportar `.xlsx` real com imagem incorporada;
- validar responsividade, placeholder e teclado.

### 25.4 Verificação dos artefatos

O teste não deve conferir somente o nome do download:

- PDF deve ser aberto/renderizado e apresentar a imagem na posição esperada;
- `.xlsx` deve ser lido como workbook válido e conter relacionamento de imagem;
- células monetárias e numéricas devem continuar tipadas;
- exportação de versão histórica deve usar o ativo correto.

## 26. Critérios de aceite

1. Um administrador autorizado adiciona, substitui e remove fotos em Produtos.
2. A tela Produtos lista kits e produtos avulsos, sem duplicar um produto por lista de preço.
3. O mesmo produto apresenta a mesma foto em todas as ofertas.
4. O usuário pode calcular e salvar um kit sem foto.
5. O usuário pode escolher uma foto opcional no começo de Calcular e vê-la na prévia.
6. Salvar uma nova versão fotografa a imagem correta sem alterar versões anteriores.
7. Buscar e Detalhes exibem a mesma imagem da versão.
8. Alterar a foto atual em Produtos não muda um cálculo histórico.
9. O drawer de Pedidos mostra miniaturas de kits e produtos avulsos.
10. O carrinho mantém as imagens depois de alterar quantidade, preço e validar a cotação.
11. Itens sem foto exibem placeholder consistente em todas as telas.
12. Catálogos não retornam blobs nem Base64 em JSON.
13. Upload inválido é rejeitado com mensagem segura e compreensível.
14. PDF contém a foto da versão e continua paginando corretamente.
15. Excel é um `.xlsx` real, contém a foto incorporada e preserva células numéricas.
16. Usuário sem permissão não consegue alterar fotos por chamada direta à API.
17. Todas as alterações de imagem são auditadas.
18. Registros anteriores à migration continuam funcionando com imagem nula.
19. A experiência permanece utilizável em desktop e celular.
20. Lint, typecheck, build, testes unitários, integração e E2E passam.

## 27. Direção para o futuro `tasks.md`

O planejamento deve agrupar trabalho por entregas verticais. Não criar uma tarefa para cada arquivo,
endpoint, DTO, teste ou pequeno ajuste visual.

Estrutura recomendada de 6 tarefas:

1. **Fundação de mídia:** schema, migration, armazenamento, processamento, leitura, permissões e
   auditoria.
2. **Catálogo Produtos:** consulta unificada de kits/produtos, filtros e gestão completa de fotos.
3. **Calcular e versionamento:** seleção inicial, multipart, imagem atual de Kit e snapshot da
   `CalculationVersion`.
4. **Propagação visual:** contratos e exibição em Buscar, Detalhes, drawer e carrinho de Pedidos.
5. **Exportações:** PDF com imagem e substituição do `.xls` HTML por `.xlsx` real.
6. **Qualidade e entrega:** testes completos, migração ensaiada, documentação, desempenho e quality
   gate.

Cada tarefa futura deve conter:

- objetivo de negócio;
- requisitos atendidos;
- dependências;
- arquivos ou módulos prováveis, sem transformar cada arquivo em subtarefa;
- testes obrigatórios;
- evidência de conclusão;
- critérios claros de pronto.

Uma tarefa só deve ser dividida se:

- não puder ser revisada com segurança como uma unidade;
- tiver dependências realmente independentes;
- bloquear trabalho paralelo relevante;
- ou exceder claramente uma entrega vertical coerente.

Mesmo nesses casos, o total recomendado é de no máximo 8 tarefas.

## 28. Pendências para confirmação antes da implementação

As seguintes decisões não bloqueiam a especificação, mas devem ser confirmadas ao criar o
`tasks.md` ou antes da respectiva tarefa:

1. proporção visual preferida para as fotos: 4:3 ou quadrada;
2. qualidade/tamanho final exatos depois de testar com fotos reais;
3. se o histórico deve mostrar miniatura já na lista de versões ou somente ao abrir a versão;
4. nome final da permissão `catalog.manage`;
5. se a implantação inicial usará WebP para exibição e JPEG/PNG apenas como entrada;
6. biblioteca final para `.xlsx` com imagem, com preferência inicial por `exceljs`.

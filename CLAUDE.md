# CLAUDE.md — Migração do Sistema de Formação de Preço Fluair

## 1. Finalidade deste arquivo

Este arquivo é o contexto técnico e funcional obrigatório para qualquer trabalho de migração deste projeto. Ele deve permitir que uma tela seja migrada por vez sem perder as regras já levantadas, sem criar uma arquitetura diferente a cada etapa e sem deixar a interface apenas aparentemente funcional.

Quando o usuário pedir, por exemplo, “vamos migrar a tela de Busca”, o trabalho esperado é um recorte vertical completo dessa tela:

- analisar a implementação atual;
- ler a documentação funcional da tela;
- criar ou evoluir o esquema do banco necessário;
- criar migrações e dados estruturais mínimos;
- implementar serviços e endpoints do backend;
- aplicar autenticação e permissões;
- alterar o frontend para consumir a API;
- remover os dados simulados somente daquela área;
- preservar os comportamentos úteis já existentes;
- criar e executar testes proporcionais ao risco;
- atualizar a documentação se alguma decisão aprovada mudar.

Uma tela não está migrada quando apenas sua aparência foi copiada ou quando um `fetch()` retorna dados fictícios. Ela está migrada quando utiliza dados persistidos, possui autorização no servidor, trata estados de interface e satisfaz seus critérios de aceite.

## 2. Ordem obrigatória de leitura

Antes de alterar código, leia integralmente:

1. Este `CLAUDE.md`.
2. `docs/telas/README.md`.
3. `docs/telas/00-componentes-compartilhados.md`.
4. `docs/telas/00-permissoes.md`.
5. O arquivo específico da tela solicitada.
6. Os trechos correspondentes de `fluair-tabpreco-merge-pedidos.html`.

Documentos das telas:

| Tela | Documento |
|---|---|
| Login | `docs/telas/01-login.md` |
| Busca | `docs/telas/02-busca.md` |
| Detalhe do Kit | `docs/telas/03-detalhe-kit.md` |
| Cálculo de Preço | `docs/telas/04-calculo-preco.md` |
| Histórico de Versões | `docs/telas/05-historico-versoes.md` |
| Atualização de Matriz | `docs/telas/06-atualizacao-matriz.md` |
| Usuários e Permissões | `docs/telas/07-usuarios-permissoes.md` |
| Pedidos | `docs/telas/08-pedidos.md` |
| Clientes | `docs/telas/09-clientes.md` |

Se a solicitação atual do usuário contrariar este arquivo, a solicitação explícita mais recente prevalece. Registre a nova decisão no documento funcional correspondente para que as próximas migrações não usem uma regra antiga.

## 3. Missão do projeto

Migrar o protótipo estático da Fluair para uma aplicação web interna com:

- backend real;
- banco de dados relacional;
- autenticação e autorização;
- matrizes de preço versionadas;
- cálculos executados e validados no servidor;
- produtos e kits originados pelos cálculos dos usuários;
- pesquisa compartilhada entre usuários;
- detalhes e histórico imutável dos cálculos;
- implantação simples e portável para Hostinger ou outro provedor compatível.

A migração será gradual. O sistema existente deve continuar sendo a referência visual e funcional enquanto cada área é substituída.

## 4. Estado atual do projeto

Login, usuários, clientes, listas de preço, cálculo e a montagem/cotação de Pedidos possuem módulos
TypeScript, APIs reais, persistência quando prevista e autorização por capacidade. Listas
`KIT_COMPONENT` e `STANDALONE_PRODUCT` são dirigidas por dados, com versões imutáveis, públicos e
faixas. A API antiga `/api/v1/matrices` e o enum fechado dos três perfis foram removidos.

`fluair-tabpreco-merge-pedidos.html` permanece como fonte visual do build. A transformação substitui
as telas migradas e remove seus mocks antes do bundle; `PEDIDO_PRODUTOS`, `PEDIDO_CLIENTES`, preços
fictícios e funções do carrinho demonstrativo não chegam à aplicação gerada. Busca, detalhe e
histórico já consultam as fotografias persistidas dos cálculos; os geradores artificiais dessas áreas
não chegam ao bundle.

Pedidos permite selecionar cliente e lista, consultar catálogo real de kits, itens unitários
calculados e produtos avulsos, montar carrinho misto e validar uma cotação integralmente no backend.
Os itens calculados exibem os kits atuais aos quais pertencem. Persistência, numeração, documento,
aprovação e envio do pedido continuam fora do escopo.

## 5. Decisões de escopo já confirmadas

### 5.1 Produtos e kits

- Não haverá inicialmente uma tela de cadastro manual de produtos.
- Produtos serão descobertos a partir das composições das folhas Korp processadas pelos usuários.
- Kits serão descobertos a partir do código e da descrição da folha de processo.
- Identificação básica do produto pode ser atualizada com aparições posteriores, conforme regra documentada.
- Preço não é atributo fixo do produto.
- Preços pertencem a versões de lista e são fotografados nos itens de cada cálculo.
- Histórico nunca deve ser reconstruído usando preços atuais.

### 5.2 Clientes

- O cadastro de clientes reais está persistido no MySQL e disponível na rota `/clientes`.
- A base inicial possui 1.507 registros migrados de `INIT_DB` do sistema de comissões.
- Código e razão social são obrigatórios; segmento, vendedor e representante permanecem opcionais.
- Na tela de Pedidos, administradores podem pré-cadastrar um cliente informando somente razão
  social, classe e segmento; o backend gera um código provisório `PRE-...` e o cadastro pode ser
  complementado depois na tela de Clientes.
- Clientes não são apagados: são ativados ou desativados para preservar referências históricas.
- Classe e segmento são normalizados; o texto legado de segmento permanece para Comissões.
- `PEDIDO_CLIENTES` não chega ao bundle de produção.
- Cliente, classe, segmento e lista de preço são conceitos distintos.

### 5.3 Listas de preço

- Listas `KIT_COMPONENT` autorizam classes e oferecem preço mínimo e normal.
- Listas `STANDALONE_PRODUCT` autorizam segmentos e oferecem preço unitário com IPI já incluído.
- Códigos, públicos, faixas e versões vêm do banco; não criar enums por lista no código.
- Perfis e matrizes antigas permanecem apenas para histórico, rollback e escrita dupla temporária.

### 5.4 Pedidos

- Montagem, catálogo real, faixas e cotação server-side estão implementados.
- A cotação não persiste um pedido.
- A geração definitiva do pedido ainda será definida.
- O formato do documento ainda será definido.
- O provedor e o endereço de e-mail remetente serão decididos depois.
- O envio por e-mail não faz parte do primeiro escopo.
- Não criar tabelas ou integrações de pedido antecipadamente sem solicitação do usuário, exceto se forem estritamente necessárias para a tela pedida.

### 5.5 Permissões

- Todas as telas internas exigirão autenticação.
- Somente alguns usuários poderão administrar tudo.
- A autorização será baseada em capacidades/permissões.
- Papéis como Administrador, Operador de Cálculo e Consulta funcionam como modelos de permissões.
- Ocultar menu ou botão não é segurança; o backend sempre valida a permissão.

## 6. Tecnologias obrigatórias

Utilizar esta stack, salvo nova decisão explícita do usuário:

### Runtime e linguagem

- Node.js 22 LTS.
- TypeScript com modo `strict`.
- NPM com lockfile versionado.

### Backend

- Express.
- API REST sob o prefixo `/api/v1`.
- Zod para validação de entrada, parâmetros e variáveis de ambiente.
- Prisma ORM e Prisma Migrate.
- `xlsx`/SheetJS instalado como dependência do servidor para leitura das planilhas.
- `decimal.js` ou biblioteca decimal equivalente para cálculos monetários e de quantidade.
- Sessões do lado do servidor com cookie seguro e armazenamento persistente no MySQL.
- Argon2id para hash de senha; se houver incompatibilidade comprovada de implantação, documentar e usar alternativa segura aprovada.

### Banco de dados

- MySQL 8 como alvo principal.
- Evitar recursos desnecessariamente exclusivos que impeçam compatibilidade razoável com MariaDB.
- Charset `utf8mb4`.
- Migrações versionadas; nunca alterar silenciosamente uma migração já aplicada em outro ambiente.

### Frontend

- Vite.
- TypeScript.
- HTML e CSS existentes reaproveitados gradualmente.
- JavaScript modular, sem novos estados globais em `window`.
- Não introduzir React, Vue, Next.js ou outro framework sem uma decisão explícita. A interface atual pode ser migrada com Vite e TypeScript puro.

### Testes

- Vitest para unidades e regras de domínio.
- Supertest para endpoints Express.
- Playwright para fluxos essenciais no navegador quando a infraestrutura estiver disponível.
- Planilhas sanitizadas como fixtures de parser e cálculo.

### Desenvolvimento e qualidade

- ESLint.
- Prettier.
- Docker Compose para o MySQL local, salvo ambiente já definido pelo usuário.
- Logs estruturados no backend.
- Git e commits pequenos; preservar alterações preexistentes do usuário.

## 7. Arquitetura alvo

Usar um monólito modular. Não criar microsserviços.

Estrutura recomendada:

```text
src/
  server/
    app.ts
    server.ts
    config/
    database/
    middleware/
    modules/
      auth/
      users/
      permissions/
      matrices/
      calculations/
      products/
      audit/
  web/
    index.html
    main.ts
    styles/
    components/
    pages/
      login/
      calculations/
      matrices/
      users/
    services/
    state/
  shared/
    contracts/
    constants/
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  fixtures/
  unit/
  integration/
  e2e/
docs/
  telas/
```

Essa estrutura é uma direção, não uma obrigação de criar pastas vazias. Criar apenas módulos necessários para a etapa atual.

### Fluxo de produção

Preferir um único domínio:

```text
Navegador
  ├── arquivos compilados do frontend
  └── /api/v1/*
          ├── autenticação e permissões
          ├── regras de negócio
          ├── parser e cálculo
          └── MySQL
```

O Express pode servir o build do Vite em produção. Durante o desenvolvimento, o Vite pode usar proxy para a API.

## 8. Scripts padronizados do projeto

Quando a base Node for criada, manter scripts equivalentes a:

```text
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run db:generate
npm run db:migrate
npm run db:seed
```

Não afirmar que um script existe antes de verificar `package.json`. Ao adicionar um script, documentar requisitos de ambiente.

## 9. Modelo de dados base

O modelo poderá evoluir, mas deve preservar estas responsabilidades.

### 9.1 Autenticação e autorização

#### `users`

- identificador interno opaco;
- nome;
- e-mail normalizado e único;
- hash da senha;
- papel/modelo principal;
- situação ativa/inativa;
- datas de criação e atualização.

#### `roles`

- código estável;
- nome de exibição;
- descrição.

#### `permissions`

- código estável da capacidade;
- descrição.

#### `role_permissions`

- relação entre papel e permissão.

#### `user_permission_overrides`

- exceções individuais de concessão ou negação;
- usuário;
- permissão;
- valor permitido/negado.

#### `sessions`

- identificador seguro da sessão;
- usuário;
- expiração;
- metadados mínimos necessários;
- possibilidade de invalidação.

#### `audit_logs`

- usuário autor;
- tipo de ação;
- entidade e identificador afetado;
- resumo seguro de antes/depois quando aplicável;
- data;
- identificador da requisição.

### 9.2 Listas de preço

`price_lists` define código, nome, tipo, situação, faixa e versão ativa. Associações com classes ou
segmentos determinam o público conforme o tipo. `price_list_versions` preserva arquivo, hash,
responsável, data e contagem; `price_list_items` fotografa descrição e preços com unicidade por
versão e código.

Versões `KIT_COMPONENT` usam preços mínimo e normal. Versões `STANDALONE_PRODUCT` usam referência,
preço unitário e IPI informativo já incluído. A criação e ativação são transacionais e nenhuma
versão histórica é alterada. Tabelas `price_profiles`/`price_matrix_*` continuam temporariamente para
compatibilidade de dados migrados, mas não possuem rota administrativa própria.

### 9.3 Produtos, kits e cálculos

#### `products`

- código de negócio como texto e único;
- descrição conhecida mais recente;
- unidade conhecida mais recente;
- primeira e última aparição;
- situação, se necessária futuramente.

Não armazenar “preço atual” genérico nesta tabela.

#### `kits`

- código de negócio como texto e único;
- descrição conhecida mais recente;
- primeira e última aparição.

#### `calculations`

Cada linha representa uma versão imutável de cálculo:

- kit;
- lista de componentes;
- versão sequencial dentro do kit/lista;
- versão da lista usada;
- usuário responsável;
- nome e hash da folha Korp;
- total mínimo;
- total normal;
- quantidade de itens;
- quantidade de itens sem preço;
- origem do cálculo;
- indicador de versão atual;
- data.

#### `calculation_items`

Fotografia do item no momento do cálculo:

- cálculo;
- produto conhecido, quando existir;
- posição original;
- operação;
- condição;
- código;
- descrição;
- quantidade decimal;
- unidade;
- preço unitário mínimo;
- preço unitário normal;
- total mínimo;
- total normal;
- indicador de preço encontrado.

Mesmo que o produto seja atualizado depois, descrição, unidade, quantidade e preços fotografados não mudam.

### 9.4 Entidades futuras

`orders` e `order_items` estão documentadas para etapas futuras. Não criá-las antecipadamente apenas para “completar” o modelo. `customers` já está implementada.

## 10. Regras obrigatórias de cálculo

O backend é a autoridade do cálculo. O frontend envia arquivo e escolhas; não envia totais confiáveis.

Fluxo obrigatório:

1. Validar sessão e `calculation.create`.
2. Validar extensão, tamanho e conteúdo do arquivo.
3. Identificar código e descrição do kit.
4. Identificar colunas e itens da composição.
5. Carregar a versão ativa da lista `KIT_COMPONENT` escolhida.
6. Fixar essa versão para toda a transação.
7. Localizar cada código na versão da lista.
8. Multiplicar preços pela quantidade usando aritmética decimal.
9. Somar totais usando aritmética decimal.
10. Registrar itens sem preço.
11. Criar/atualizar identificação de produtos e kit.
12. Criar nova versão do cálculo e seus itens.
13. Marcar a nova versão como atual sem apagar a anterior.
14. Confirmar a transação.
15. Somente então retornar sucesso e mostrar “salvo”.

Preservar inicialmente a semântica atual de item com preço: código encontrado e pelo menos um dos valores mínimo/normal maior que zero. Se essa regra for alterada, criar teste e atualizar `docs/telas/04-calculo-preco.md`.

Não usar `Number` ou `parseFloat` para a parte autoritativa dos valores monetários. O banco deve usar `DECIMAL` e o serviço deve usar aritmética decimal.

Não selecionar silenciosamente outra lista se a escolhida não possuir versão ativa. Retornar erro claro.

Não sobrescrever códigos duplicados silenciosamente. Apresentar erro ou resumo de conflito antes da ativação.

## 11. Permissões iniciais

Códigos conceituais obrigatórios:

```text
calculation.view
calculation.create
calculation.history
calculation.export
matrix.view
matrix.manage
matrix.recalculate
user.view
user.manage
order.access
price.view
price.override
customer.view
customer.manage
```

Criar no banco apenas as permissões necessárias ao escopo atual, mas preservar esses códigos na documentação.

Regras:

- menu filtrado pelas permissões efetivas;
- rota frontend protegida;
- endpoint backend protegido;
- ação específica protegida separadamente;
- conta inativa não autentica;
- desativação invalida sessões;
- sistema não pode ficar sem administrador ativo;
- usuários históricos não devem ser apagados se possuírem vínculos.

## 12. Convenções da API

### 12.1 Base

- Prefixo: `/api/v1`.
- JSON para dados comuns.
- `multipart/form-data` somente para uploads.
- IDs internos opacos na URL.
- Códigos de produto e kit tratados como strings.

### 12.2 Respostas

Objeto simples:

```json
{
  "data": {}
}
```

Lista paginada:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 30,
    "total": 0,
    "totalPages": 0
  }
}
```

Erro:

```json
{
  "error": {
    "code": "PRICE_LIST_ACTIVE_VERSION_REQUIRED",
    "message": "A lista de preço precisa possuir uma versão ativa.",
    "fieldErrors": {},
    "requestId": "..."
  }
}
```

Não retornar stack trace, SQL, caminho interno ou segredo ao navegador.

### 12.3 Endpoints conceituais

Autenticação:

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Usuários:

```text
GET   /api/v1/users
POST  /api/v1/users
GET   /api/v1/users/:id
PATCH /api/v1/users/:id
POST  /api/v1/users/:id/deactivate
POST  /api/v1/users/:id/activate
```

Listas de preço:

```text
GET   /api/v1/price-lists
POST  /api/v1/price-lists
PATCH /api/v1/price-lists/:id
POST  /api/v1/price-lists/:id/import/preview
POST  /api/v1/price-lists/:id/import/confirm
PUT   /api/v1/price-lists/:id/active-version
```

Cálculos:

```text
GET  /api/v1/calculations
GET  /api/v1/calculations/:id
GET  /api/v1/calculations/:id/history
POST /api/v1/calculations/preview/:priceListId
POST /api/v1/calculations/save/:priceListId
```

Pedidos:

```text
GET  /api/v1/orders/price-lists
GET  /api/v1/orders/catalog
POST /api/v1/orders/quote
```

Antes de criar variações, verificar se um endpoint existente pode atender com clareza.

## 13. Convenções do frontend

- Preservar a identidade visual e comportamentos úteis do protótipo, salvo pedido de redesign.
- Separar páginas, componentes, serviços de API e formatação.
- Não acessar banco diretamente pelo navegador.
- Não manter arrays de produção dentro do bundle.
- Não introduzir novos handlers inline `onclick` nas telas migradas.
- Não armazenar sessão sensível ou senha em `localStorage`.
- Não confiar em permissões calculadas no cliente.
- Não renderizar conteúdo de planilha ou API como HTML não tratado.
- Usar `textContent` ou mecanismo seguro para valores dinâmicos.
- Implementar estados de carregamento, vazio, erro, sem permissão e sucesso.
- Desabilitar envios duplicados.
- Preservar filtros de Busca na URL quando a tela for migrada.
- Usar o ID do cálculo nas rotas de detalhe; nunca o índice da linha.
- Mostrar valores persistidos do cálculo; não recalcular detalhes com a lista atual.

Ao migrar uma tela, remover seus dados e funções mock somente depois que a API correspondente estiver funcionando. Não remover mocks de outras telas que ainda dependam deles, salvo refatoração necessária e testada.

## 14. Segurança mínima obrigatória

- HTTPS em produção.
- Cookie de sessão `HttpOnly`, `Secure` em produção e `SameSite` adequado.
- Sessão armazenada de forma persistente; não usar MemoryStore em produção.
- Proteção de requisições mutáveis por token CSRF ou validação robusta de origem combinada com a política de cookie.
- `helmet` ou cabeçalhos equivalentes.
- Limitação de tentativas no login.
- Hash seguro de senha.
- Validação Zod no limite da API.
- Limite configurável de upload e de linhas processadas.
- Rejeição de arquivos vazios, corrompidos ou incompatíveis.
- ORM e queries parametrizadas.
- Segredos somente em variáveis de ambiente.
- Logs sem senha, cookie, conteúdo integral de planilha ou dados sensíveis desnecessários.
- Auditoria de login administrativo, usuários, permissões, listas e importações.
- Backend revalida autorização em todas as operações.

## 15. Variáveis de ambiente

Manter `.env.example` sem valores secretos. Base esperada:

```text
NODE_ENV=
PORT=
APP_URL=
DATABASE_URL=
SESSION_SECRET=
SESSION_TTL_HOURS=
MAX_UPLOAD_MB=
LOG_LEVEL=
```

Se for necessário criar o primeiro administrador por bootstrap, usar segredo temporário de ambiente ou comando administrativo documentado. Não gravar uma senha padrão no seed, no código ou no histórico Git.

## 16. Seed e dados de demonstração

Seeds de produção podem criar apenas dados estruturais, como:

- classes, segmentos e definições iniciais de listas sem preços;
- catálogo inicial de permissões;
- papéis padrão, se aprovados.

Não inserir em produção:

- Samara, João, Marcos ou Ana apenas porque aparecem no protótipo;
- produtos de `PEDIDO_PRODUTOS`;
- clientes de `PEDIDO_CLIENTES`;
- kits de `_buscaAllData`;
- versões geradas por `generateMockComposition()` ou `generateMatrizKits()`.

Fixtures de teste devem ser claramente identificadas e nunca misturadas com seed de produção.

## 17. Planilhas e testes de regressão

O maior risco do cálculo é alterar silenciosamente os resultados de referência.

Ao evoluir parsers ou cálculo no servidor:

1. Obter folhas Korp reais ou sanitizadas.
2. Obter listas de componentes reais ou sanitizadas dos formatos conhecidos.
3. Registrar os resultados corretos esperados.
4. Criar testes de parser para posições e cabeçalhos conhecidos.
5. Criar testes de cálculo para itens encontrados, ausentes, zerados e quantidades decimais.
6. Comparar totais do backend com a referência aprovada.

Se as planilhas contiverem informação comercial sensível, não versionar os originais. Criar versões sanitizadas que preservem estrutura, tipos e casos problemáticos.

Casos mínimos:

- arquivo válido;
- cabeçalho ausente;
- kit sem código;
- composição vazia;
- produto fora da versão da lista;
- preço zero;
- código duplicado;
- quantidade decimal;
- moeda com vírgula;
- lista inexistente ou sem versão ativa;
- reenvio acidental do mesmo arquivo;
- falha de persistência sem registro parcial.

## 18. Ordem recomendada de migração

Seguir preferencialmente:

1. Fundação do projeto, banco, configuração e testes.
2. Login, sessão, usuários e permissões mínimas.
3. Administração e versionamento de listas.
4. Cálculo de preço no backend e persistência.
5. Busca de cálculos.
6. Detalhe do cálculo.
7. Histórico de versões e exportação.
8. Recálculo em massa, depois de conhecer o volume.
9. Clientes e classificações.
10. Montagem e cotação de Pedidos; persistência, documento e e-mail depois das decisões comerciais.

Se o usuário pedir uma tela fora dessa ordem, implementar as dependências mínimas reais necessárias, mas não migrar automaticamente outras interfaces. Explicar quais fundações foram necessárias.

## 19. Procedimento obrigatório ao migrar uma tela

### Etapa A — análise

1. Ler os documentos obrigatórios.
2. Inspecionar HTML, IDs, funções, variáveis globais e mocks daquela tela.
3. Identificar dependências com telas ainda não migradas.
4. Confirmar que decisões pendentes não bloqueiam o trabalho.
5. Se houver ambiguidade com impacto de negócio, pedir confirmação; não inventar a regra.

### Etapa B — contrato e dados

1. Definir os casos de uso da tela.
2. Definir ou ajustar entidades e relacionamentos mínimos.
3. Criar migração Prisma.
4. Definir schemas Zod.
5. Definir resposta e erros da API.
6. Definir permissões por endpoint e ação.

### Etapa C — backend

1. Criar módulo de domínio da tela.
2. Separar controller, serviço e acesso a dados quando isso trouxer clareza.
3. Colocar regras de negócio no servidor, não no controller ou frontend.
4. Usar transação para alterações compostas.
5. Criar logs e auditoria necessários.
6. Criar testes unitários e de integração.

### Etapa D — frontend

1. Preservar layout e componentes documentados.
2. Substituir mock pela chamada de API.
3. Adicionar carregamento, vazio, erro, sucesso e sem permissão.
4. Aplicar proteção de rota e ações.
5. Remover apenas o estado global correspondente.
6. Garantir que atualizar o navegador recarregue o dado persistido.

### Etapa E — verificação

1. Executar typecheck, lint e testes relevantes.
2. Testar usuário autorizado e não autorizado.
3. Testar atualização do navegador e nova sessão.
4. Testar entradas inválidas.
5. Comparar comportamento com critérios de aceite do documento da tela.
6. Verificar que nenhuma outra tela foi quebrada.
7. Atualizar documentação se necessário.

## 20. Definição de pronto por tela

Uma tela somente está pronta quando:

- utiliza API e banco reais quando seu domínio exige persistência;
- não utiliza arrays ou geradores mock como fonte de produção;
- possui migração de banco reproduzível;
- possui validação de entrada no backend;
- possui autorização no endpoint;
- possui proteção correspondente no frontend;
- trata carregamento, vazio, erro e sucesso;
- evita submissão duplicada;
- mantém comportamento após atualizar o navegador;
- possui testes das regras críticas;
- satisfaz os critérios de aceite em `docs/telas`;
- não expõe segredos ou dados indevidos;
- preserva funcionalidades já existentes e aprovadas;
- tem documentação atualizada;
- informa claramente ao usuário o que foi alterado e como verificar.

## 21. Marco funcional vigente

O marco inicial já foi superado. O fluxo vigente permite:

```text
Administrador autentica
  ↓
Importa e ativa uma versão de lista
  ↓
Operador autentica
  ↓
Importa uma folha Korp e escolhe a lista
  ↓
Backend calcula e salva
  ↓
Seleciona cliente compatível e salva
  ↓
Monta carrinho com catálogo real e valida cotação no backend
```

Condições desse marco:

- dados sobrevivem ao fechamento do navegador;
- usuários compartilham resultados;
- permissões impedem ações administrativas;
- resultados conferem com planilhas de referência;
- atualizar a lista não altera o histórico;
- produtos e kits surgem dos cálculos;
- produtos e kits podem possuir foto atual, enquanto cada versão de cálculo preserva sua própria
  imagem histórica;
- Busca, Detalhes, Calcular, Produtos e Pedidos usam referências de imagem leves, e as exportações
  PDF/XLSX incorporam a foto da versão;
- nenhuma cotação persiste pedido antes da definição do modelo definitivo.

## 22. Implantação

Alvo inicial compatível:

- aplicação Node.js gerenciada;
- MySQL gerenciado;
- build e deploy a partir de repositório Git;
- frontend e API no mesmo domínio;
- variáveis de ambiente configuradas no provedor.

A Hostinger é uma opção prevista, mas o código não deve depender de APIs proprietárias dela. A aplicação deve poder ser implantada em outro provedor Node.js com MySQL por meio das mesmas variáveis e scripts.

Antes de produção:

- confirmar versão do Node disponível;
- configurar domínio e HTTPS;
- aplicar migrações em etapa controlada;
- criar primeiro administrador com segredo temporário;
- definir política de backup;
- testar restauração;
- configurar logs;
- verificar limites de upload e execução;
- executar smoke test de login, listas, cálculo, clientes, busca e Pedidos.

Como `media_assets` armazena as variantes binárias no MySQL, backup e restauração devem incluir a
tabela e os vínculos opcionais de `products`, `kits` e `calculation_versions`. A limpeza só pode
remover ativos sem nenhuma dessas referências, após janela de retenção, relatório prévio e backup
restaurável. Ativos históricos não são sobrescritos nem apagados ao trocar a foto atual.

Não usar armazenamento local da instância para arquivos que precisem sobreviver a novos deploys. Inicialmente guardar metadados e hash das planilhas; armazenar o arquivo bruto somente após decisão sobre retenção e armazenamento persistente.

## 23. Cuidados ao trabalhar no repositório

- Verificar se há Git antes de depender de histórico ou diff.
- Se ainda não houver Git, informar e recomendar inicialização/backup antes de uma migração grande.
- Preservar alterações existentes do usuário.
- Não executar comandos destrutivos ou redefinir arquivos sem autorização.
- Não apagar o protótipo original antes de todas as telas relevantes terem sido migradas e homologadas.
- Não fazer uma reescrita visual completa junto de uma migração de dados, salvo solicitação explícita.
- Fazer alterações pequenas e verificáveis.
- Não instalar dependências ou criar abstrações que não sejam usadas pela etapa atual.
- Não criar dados reais a partir dos exemplos visuais do protótipo.

## 24. Decisões ainda pendentes

Não decidir silenciosamente:

- regra para cálculo idêntico reenviado;
- limite de tamanho e linhas das planilhas;
- atualização automática de descrição/unidade do produto;
- possibilidade de tornar atual um cálculo com itens sem preço;
- recálculo usando composição salva ou exigindo nova folha Korp;
- permissão para visualizar tabela mínima e normal separadamente;
- política de preço negociado;
- itens que podem ser vendidos separadamente;
- necessidade futura de CPF/CNPJ, endereço e contatos adicionais de clientes;
- formato e estados do pedido;
- provedor, remetente e fluxo de e-mail;
- retenção do arquivo Excel original.

Quando uma dessas decisões for necessária para a tela solicitada, apresentar opções e impacto de forma objetiva antes de implementar.

## 25. Formato da entrega de cada migração

Ao concluir uma etapa, informar:

- tela migrada;
- comportamento entregue;
- arquivos principais alterados;
- migrações criadas;
- entidades/tabelas envolvidas;
- endpoints criados ou alterados;
- permissões aplicadas;
- mocks removidos;
- testes executados e seus resultados;
- comandos necessários para ambiente local;
- variáveis de ambiente novas;
- pendências deliberadamente deixadas para outra etapa.

O resumo deve distinguir claramente o que está funcional do que continua apenas documentado para o futuro.

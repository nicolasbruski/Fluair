# Fluair — Sistema de Formação de Preço

Aplicação Node.js/TypeScript migrada gradualmente a partir de
`fluair-tabpreco-merge-pedidos.html`. Login, usuários, clientes, listas de preço, cálculo e o recorte
de montagem/cotação de Pedidos usam APIs reais protegidas por permissões. A fonte HTML continua
como referência visual, mas sua transformação remove dados e comportamentos demonstrativos das
áreas migradas antes de gerar o bundle.

Clientes possuem classe e segmento normalizados. Listas `KIT_COMPONENT` e
`STANDALONE_PRODUCT` compartilham versionamento, importação com prévia e administração dinâmica. O
cálculo de kits e a cotação do carrinho são refeitos no backend com aritmética decimal. Pedidos
ainda não são persistidos, numerados, exportados nem enviados.

## Requisitos

- Node.js 22 LTS;
- NPM;
- MySQL 8 (o `docker-compose.yml` oferece um ambiente local);
- navegador do Playwright somente para `npm run test:e2e`.

## Ambiente local

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e preencha `SESSION_SECRET` com um segredo aleatório de pelo
   menos 32 caracteres.
3. Inicie o MySQL com `docker compose up -d mysql`.
4. Aplique a migração e os dados estruturais:

   ```text
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Crie o primeiro administrador sem gravar senha no código. No PowerShell:

   ```powershell
   $env:ADMIN_NAME='Nome do administrador'
   $env:ADMIN_EMAIL='email@empresa.com.br'
   $env:ADMIN_PASSWORD='uma senha temporária forte'
   npm run db:bootstrap-admin
   Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
   ```

6. Execute `npm run dev` e abra `http://localhost:5173/login`.

O bootstrap exige senha com pelo menos 8 caracteres, não altera contas existentes e deve ser
executado somente depois do seed. Não existe conta ou senha padrão.

## API de autenticação

- `POST /api/v1/auth/login` — valida credenciais e cria cookie de sessão;
- `GET /api/v1/auth/me` — revalida sessão, conta ativa e permissões efetivas;
- `POST /api/v1/auth/logout` — revoga a sessão no banco e limpa o cookie.

A sessão usa um token aleatório em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. O
banco armazena somente um HMAC do token. Requisições mutáveis verificam a origem, tentativas de
login são limitadas por conta e IP, e eventos relevantes são auditados sem senha ou cookie. A
origem é validada antes da leitura do corpo da requisição; JSON inválido e payload acima do limite
recebem respostas seguras. O HTML legado é apenas uma fonte de build e seu acesso direto no Vite é
redirecionado para a rota protegida de Login.

## API de usuários

- `GET /api/v1/users` — lista usuários, perfis e permissões efetivas;
- `POST /api/v1/users` — cria uma conta ativa com senha protegida por hash;
- `PATCH /api/v1/users/:id` — altera nome, e-mail, perfil, acesso a Comissões e, opcionalmente, senha;
- `POST /api/v1/users/:id/deactivate` — desativa a conta e revoga suas sessões;
- `POST /api/v1/users/:id/activate` — reativa a conta.

A listagem exige `user.view` ou `user.manage`; todas as alterações exigem `user.manage`. Usuários
não são apagados fisicamente, a própria conta não pode ser desativada e o último administrador
ativo não pode ser desativado nem rebaixado. Todas as alterações são registradas em `audit_logs`.

## API de clientes

- `GET /api/v1/customers` — lista clientes com busca, filtros, situação e paginação;
- `GET /api/v1/customers/export` — retorna a seleção completa para exportação;
- `POST /api/v1/customers` — cria um cliente;
- `PATCH /api/v1/customers/:id` — altera os dados cadastrais;
- `POST /api/v1/customers/:id/deactivate` — desativa sem apagar o histórico;
- `POST /api/v1/customers/:id/activate` — reativa o cadastro.

A consulta exige `customer.view` ou `customer.manage`; alterações exigem `customer.manage`. Código,
razão social, segmento, vendedor, representante e situação ficam no banco. Criação, edição e mudança
de situação geram eventos em `audit_logs`. A exportação da tela gera CSV UTF-8 compatível com Excel.

## Listas, cálculos e pedidos

- `GET /api/v1/price-lists` — lista definições, públicos, faixas, versão ativa e histórico;
- `POST /api/v1/price-lists` e `PATCH /api/v1/price-lists/:id` — criam e editam definições;
- `POST /api/v1/price-lists/:id/import/preview` — valida sem persistir;
- `POST /api/v1/price-lists/:id/import/confirm` — reanalisa, versiona e ativa em transação;
- `POST /api/v1/calculations/preview/:priceListId` — calcula uma folha Korp com a versão ativa exata da lista;
- `POST /api/v1/calculations/save/:priceListId` — exige cliente, revalida classe e versão e cria ou vincula o cálculo.
- `GET /api/v1/calculations` — busca cálculos atuais persistidos com texto, lista de preço, ordenação e paginação.
- `GET /api/v1/calculations/:id` — retorna a fotografia completa e os componentes persistidos de uma versão.
- `GET /api/v1/calculations/:id/history` — retorna as versões reais da mesma combinação de kit e lista.
- `GET /api/v1/price-lists/:id/products` — pesquisa código, descrição e referência somente na versão ativa;
- `GET /api/v1/price-lists/:id/products/:code/price` — resolve preço decimal, referência, IPI e ICMS informativos da versão ativa.
- `GET /api/v1/orders/price-lists` — retorna listas avulsas permitidas para cliente e quantidade;
- `GET /api/v1/orders/catalog` — retorna produtos da versão ativa e kits compatíveis;
- `POST /api/v1/orders/quote` — recalcula e valida integralmente o carrinho sem persistir pedido.

Os uploads usam corpo binário com limite de 10 MB. Arquivo, hash e linhas normalizadas ficam
persistidos em versões imutáveis. A administração usa `matrix.view`/`matrix.manage`; o cálculo usa
`calculation.create`; e catálogo e cotação exigem `order.access` e `price.view`. O preço permanece no
item da versão, enquanto `products` guarda somente a identidade conhecida mais recente. A API
legada `/api/v1/matrices`, limitada aos três perfis iniciais, foi removida; tabelas e escritas duplas
históricas permanecem temporariamente para compatibilidade e rollback.

## Fotos de produtos e kits

- `GET /api/v1/catalog` lista kits e produtos avulsos com `ImageReference | null`, busca, filtro e
  paginação, sem blobs ou Base64;
- `PUT /api/v1/media/products/:id` e `PUT /api/v1/media/kits/:id` adicionam ou substituem a foto
  atual;
- `DELETE /api/v1/media/products/:id` e `DELETE /api/v1/media/kits/:id` removem somente o vínculo
  atual;
- `GET /api/v1/media/:id/thumb` e `GET /api/v1/media/:id/display` entregam a variante autenticada
  com `ETag` e cache privado imutável.

As mutações exigem `catalog.manage`. A leitura exige uma capacidade funcional compatível com a
tela consumidora. JPEG, PNG e WebP são aceitos até 5 MB e aproximadamente 12 megapixels; o backend
valida a assinatura real, corrige orientação, remove metadados e normaliza para WebP. A variante
`display` tem no máximo 1600 x 1600 e a `thumb`, 320 x 320, sempre preservando proporção.

`Product.currentImageId` e `Kit.currentImageId` representam a foto atual. Cada
`CalculationVersion.kitImageId` fotografa a imagem da versão, portanto alterações no catálogo não
reescrevem histórico, PDF ou Excel antigos. Registros anteriores à migration permanecem válidos
com vínculo nulo. PDF usa a foto histórica e a exportação Excel é um `.xlsx` real com imagem
incorporada e células numéricas.

### Backup e limpeza de mídia

Os binários ficam em `media_assets` no próprio MySQL. O backup deve incluir schema e dados de todo o
banco, não somente as tabelas comerciais, e a restauração deve ser ensaiada antes de produção. Não
se deve limpar um ativo apenas porque deixou de ser a foto atual: ele pode estar referenciado por
`calculation_versions.kit_image_id`.

Uma limpeza segura deve primeiro identificar ativos sem referência em `products.current_image_id`,
`kits.current_image_id` e `calculation_versions.kit_image_id`, manter uma janela de retenção e
registrar contagem e identificadores antes da exclusão. A rotina não é automática nesta entrega;
execute-a somente depois de backup validado e nunca durante upload ou salvamento em andamento.

## Sistema de comissões

- `GET /comissoes` — entrega a aplicação somente a usuários com `commission.access`;
- `GET /api/v1/commissions/customers` — carrega do MySQL os clientes ativos usados no fechamento;
- `POST /api/v1/commissions/customers` — cadastra um cliente pela tela de Comissões;
- `POST /api/v1/commissions/customers/:id/deactivate` — remove o cliente da base ativa sem apagar seu histórico.

`commission.access` não pertence automaticamente a nenhum perfil. O acesso é habilitado ou
desabilitado individualmente nos formulários de criação e edição de usuário. O módulo não
mantém mais uma cópia `INIT_DB`; relatórios e cadastros usam a tabela compartilhada `customers`.

## Qualidade e testes

```text
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:integration
npm run build
npm run test:e2e
```

Para os testes de navegador, instale uma vez o Chromium do Playwright com
`npx playwright install chromium` e execute `npm run test:e2e`. Esses testes isolam a interface
com respostas HTTP controladas; os testes de integração cobrem cookie e ciclo da sessão no
Express. O MySQL real é validado pela migração e pode ser usado no smoke test local.

## Produção

Configure as variáveis de `.env.example`, use HTTPS e execute:

```text
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Em produção o Express serve `dist/web` e a API no mesmo domínio. Durante a transição, a política
de conteúdo permite os scripts e estilos inline já presentes nas telas legadas e o SheetJS do
CDN. Essa exceção deve ser removida quando essas telas forem modularizadas.

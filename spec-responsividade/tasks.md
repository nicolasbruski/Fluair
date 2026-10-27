# Tasks — Responsividade e adaptação multidispositivo

## 1. Objetivo

Implementar `spec-responsividade/spec.md` em oito entregas coesas, priorizadas e verificáveis, cobrindo
o sistema principal e o módulo de Comissões.

O resultado final deve tornar todos os fluxos utilizáveis de 320 px até monitores ultrawide, sem
overflow horizontal global, controles inacessíveis ou perda funcional. Este planejamento trata
responsividade como comportamento verificável, e não apenas como inclusão de media queries.

## 2. Convenções

- `[ ]`: não iniciada;
- `[~]`: em andamento;
- `[x]`: concluída e verificada;
- `[!]`: bloqueada por dependência ou decisão externa;
- referências `RG-*`, `RF-*` e `RNF-*` apontam para o `spec.md` desta pasta;
- cada tarefa deve entregar uma capacidade completa, incluindo testes e documentação aplicáveis;
- correções descobertas dentro do escopo permanecem na tarefa responsável;
- ao concluir uma tarefa, adicionar a subseção **Resultado e evidências** com arquivos, comandos,
  testes, screenshots e desvios;
- não marcar uma tarefa como concluída somente porque o layout parece correto em uma screenshot.

## 3. Regras de execução

1. Preservar mudanças locais preexistentes e revisar conflitos antes de editar arquivos já modificados.
2. Não alterar regras comerciais, permissões, payloads, cálculos ou persistência para resolver layout.
3. Não esconder informação ou ação sem oferecer acesso equivalente.
4. Preferir correções compartilhadas quando o mesmo problema ocorrer em vários módulos.
5. Evitar correções globais que afetem componentes não relacionados.
6. Testar com dados longos, estados vazios, erro, carregamento e permissões diferentes.
7. Manter a ordem do DOM coerente com leitura e foco; CSS não deve criar uma ordem visual enganosa.
8. Não usar detecção de modelo de aparelho ou user agent para definir layout.
9. Não reduzir dados essenciais abaixo de 11 px como solução de encaixe.
10. Não criar breakpoints específicos para um único aparelho quando o problema puder ser resolvido pelo
    espaço necessário ao conteúdo.

## 4. Definição global de pronto

Uma tarefa somente pode ser marcada como `[x]` quando:

1. todo o recorte descrito estiver implementado ou registrado como não aplicável com justificativa;
2. não houver overflow horizontal global nas rotas e estados abrangidos;
3. as ações essenciais estiverem visíveis e operáveis por toque e teclado;
4. telas de 320 px, celular atual, tablet e desktop tiverem sido verificadas conforme a tarefa;
5. textos longos e conteúdo variável não causarem corte, sobreposição ou expansão do documento;
6. testes E2E objetivos tiverem sido adicionados ou atualizados;
7. screenshots forem usadas como evidência complementar, não como única validação;
8. lint, formatação e typecheck dos arquivos afetados passarem;
9. testes funcionais relacionados passarem ou falhas preexistentes estiverem claramente isoladas;
10. documentação afetada permanecer consistente com a implementação;
11. o resultado e as evidências estiverem registrados nesta lista.

## 5. Matriz obrigatória de validação

| Identificador      | Viewport    | Uso principal                              |
| ------------------ | ----------- | ------------------------------------------ |
| `mobile-compact`   | 320 × 568   | Mínimos rígidos, modais e ações empilhadas |
| `mobile`           | 390 × 844   | Experiência móvel principal                |
| `mobile-wide`      | 412 × 915   | Conteúdo móvel com largura intermediária   |
| `mobile-landscape` | 667 × 375   | Baixa altura e orientação horizontal       |
| `tablet-portrait`  | 768 × 1024  | Transição para tablet                      |
| `tablet-landscape` | 1024 × 768  | Transição para desktop                     |
| `notebook`         | 1280 × 720  | Altura limitada de notebook                |
| `desktop`          | 1440 × 900  | Layout desktop principal                   |
| `desktop-large`    | 1920 × 1080 | Limites máximos de conteúdo                |
| `ultrawide`        | 2560 × 1080 | Centralização e uso controlado de largura  |

A suíte rápida de layout deve cobrir ao menos as sete dimensões exigidas na seção 16.2 da spec. As
dimensões adicionais desta tabela podem ser cobertas por testes profundos selecionados ou revisão
visual registrada.

## 6. Ordem e dependências

```text
TASK-001 Baseline e infraestrutura de testes
    ↓
TASK-002 Fundação responsiva compartilhada
    ├── TASK-003 Navegação, autenticação e Usuários
    ├── TASK-004 Busca, Produtos e Listas de Preço
    ├── TASK-005 Cálculo e Detalhe
    ├── TASK-006 Pedidos e Aprovações
    └── TASK-007 Clientes e Comissões
            ↓
TASK-008 Matriz completa, regressões e quality gate
```

- `TASK-002` depende do baseline e dos helpers definidos na `TASK-001`.
- `TASK-003` a `TASK-007` dependem da fundação compartilhada e podem avançar em paralelo desde que
  mudanças em `src/web/prototype-transform.ts` sejam coordenadas.
- `TASK-008` depende de todas as tarefas anteriores.
- Uma tarefa de tela não deve duplicar utilitários que pertençam à `TASK-002`.

## 7. Tarefas

### [x] TASK-001 — Registrar baseline e construir a infraestrutura de testes responsivos

- Prioridade: P0.
- Dependências: nenhuma.
- Seções principais: 4, 6, 16, 19 e 20.
- Entrega: baseline reproduzível, projetos/viewports Playwright e helpers objetivos capazes de detectar
  overflow, corte e sobreposição antes das mudanças visuais.

#### Trabalho incluído

1. Registrar o estado inicial de:
   - `npm run typecheck`;
   - lint e formatação;
   - testes unitários e de integração relevantes;
   - suíte E2E atual;
   - falhas preexistentes, separadas das regressões desta iniciativa.
2. Registrar explicitamente a falha inicial já observada em `tests/e2e/customers.spec.ts`, na expectativa
   de `#order-saved-draft`, e verificar se ela ainda ocorre antes de qualquer correção responsiva.
3. Configurar projetos ou fixtures Playwright reutilizáveis para a matriz da seção 5.
4. Criar helpers de teste para:
   - afirmar ausência de overflow horizontal no documento;
   - afirmar que um elemento está integralmente dentro da viewport;
   - detectar interseção indevida entre dois controles;
   - medir área interativa mínima;
   - registrar screenshot com nome estável por rota e viewport.
5. Criar uma suíte smoke de layout que autentique perfis representativos e percorra todas as rotas
   acessíveis sem repetir os testes funcionais completos.
6. Cobrir ao menos os estados carregado, vazio e erro quando eles produzirem estruturas diferentes.
7. Garantir que falhas de API não mockadas não invalidem silenciosamente a auditoria visual.
8. Definir onde screenshots e traces gerados serão armazenados, evitando versionar artefatos transitórios
   sem decisão explícita.

#### Arquivos prováveis

- `playwright.config.ts`;
- novo helper em `tests/e2e/helpers/`;
- novo teste `tests/e2e/responsiveness.spec.ts` ou conjunto equivalente;
- testes E2E existentes que já alteram viewport;
- `.gitignore`, somente se necessário para artefatos de teste.

#### Testes e verificações

- o helper deve falhar diante de um elemento propositalmente fora da viewport em teste controlado;
- a suíte deve diferenciar overflow interno permitido de overflow do documento;
- projetos/viewports devem poder ser executados separadamente;
- screenshots devem informar rota, estado e viewport;
- o baseline não deve alterar comportamento de produção.

#### Concluída quando

Existe uma base automatizada que reproduz o estado inicial, percorre todas as rotas e detecta os tipos
de regressão que esta iniciativa pretende corrigir.

#### Resultado e evidências

- Baseline registrado em 18/10/2026, antes de qualquer mudança de produção:
  - `npm run typecheck`: aprovado;
  - `npm run lint`: aprovado;
  - `npm run format:check`: reprovado por 53 arquivos preexistentes fora do padrão; os arquivos novos
    e alterados nesta tarefa passam em verificação direcionada;
  - `npm test`: 71 arquivos e 307 testes aprovados;
  - `npm run test:integration`: 10 arquivos e 84 testes aprovados;
  - `npm run test:e2e`: 30 de 33 testes aprovados. Além da falha conhecida de Clientes, a execução
    paralela expôs duas falhas preexistentes em `price-lists.spec.ts`, ambas chegando ao estado de erro
    por chamada não mockada de `orders/last-sale-prices`;
  - `npm run test:e2e -- tests/e2e/customers.spec.ts`: reproduziu isoladamente a falha conhecida em
    `#order-saved-draft` (1 aprovado e 1 reprovado), sem alteração responsiva aplicada.
- `playwright.config.ts` agora possui um projeto funcional e dez projetos responsivos nomeados para
  toda a matriz da seção 5. Cada dimensão pode ser executada isoladamente com
  `npx playwright test tests/e2e/responsiveness.spec.ts --project=<nome>`.
- `tests/e2e/helpers/responsive-layout.ts` fornece asserções para overflow global, contenção integral
  na viewport, interseção, área interativa mínima, auditoria de falhas de API e screenshots estáveis.
- `tests/e2e/responsive-layout-helpers.spec.ts`: 3 de 3 testes aprovados, incluindo falha controlada
  para elemento fora da viewport e distinção entre overflow interno permitido e overflow global.
- `tests/e2e/responsiveness.spec.ts` percorre Login, rotas autenticadas, acesso reduzido e Comissões,
  cobrindo estados carregado, vazio, erro e sem permissão sem depender de uma API real.
- Matriz inicial: 23 de 30 cenários aprovados. As sete reprovações são evidência do baseline que as
  tarefas visuais seguintes devem corrigir: largura global de 1248 px no sistema principal em 768 e
  1024 px, e largura global de 414 px em Comissões nas viewports de 320, 390 e 412 px.
- Screenshots ficam em `test-results/responsiveness/<viewport>/` com nomes
  `<rota>--<estado>.png`; traces e demais resultados ficam em `test-results/playwright/`. Ambos são
  transitórios e permanecem cobertos pelo `.gitignore` existente.
- Desvio ambiental: Vitest retorna `spawn EPERM` dentro do sandbox ao iniciar `esbuild`; as execuções
  válidas do baseline foram repetidas fora do sandbox. Nenhum arquivo de produção foi alterado.

---

### [x] TASK-002 — Implementar a fundação responsiva compartilhada

- Prioridade: P0.
- Dependências: `TASK-001`.
- Seções principais: 7, 9 a 12, 14 e 15.
- Entrega: primitives compartilhadas de layout, modal, ações, tabelas roláveis, mídia e viewport que as
  demais telas possam reutilizar.

#### Trabalho incluído

1. Definir e documentar um conjunto pequeno de breakpoints orientados pelo conteúdo.
2. Consolidar regras globais de:
   - `min-width: 0` em filhos flex/grid relevantes;
   - largura fluida e limites máximos;
   - padding de página em celular compacto;
   - quebra segura de textos e dados longos;
   - grupos de ações que quebram ou empilham.
3. Evoluir o modal base para:
   - respeitar largura e altura disponíveis;
   - ter cabeçalho e rodapé alcançáveis;
   - possuir região interna rolável previsível;
   - funcionar em 320 × 568 e 667 × 375;
   - considerar teclado virtual e viewport dinâmica;
   - evitar que especializações existentes percam seu comportamento.
4. Criar padrão compartilhado para região de tabela rolável com foco visível, contenção do overflow e
   indicação de conteúdo horizontal quando necessário.
5. Criar padrão compartilhado para cartões móveis de registros, incluindo rótulos por campo.
6. Garantir área interativa de 44 × 44 px para controles principais e ampliar a hit area de controles
   compactos sem alterar desnecessariamente sua aparência.
7. Adicionar suporte a áreas seguras para elementos fixos junto às bordas.
8. Adicionar tratamento de `prefers-reduced-motion` para animações e transições não essenciais.
9. Padronizar viewer, placeholder e estados de erro de imagem para não mudarem a largura do layout.
10. Reduzir a dependência de correções espalhadas entre o HTML legado e strings TypeScript; qualquer
    reorganização deve ser incremental e não transformar esta tarefa em reescrita geral do frontend.

#### Arquivos prováveis

- `fluair-tabpreco-merge-pedidos.html`;
- `src/web/prototype-transform.ts`;
- `src/web/components/media-image.ts`;
- eventual novo arquivo CSS compartilhado e ajuste em `vite.config.ts`/entrada HTML;
- testes responsivos criados na `TASK-001`.

#### Testes e verificações

- modal genérico com pouco e muito conteúdo nas quatro categorias móveis/tablet;
- modal com foco em campo próximo ao rodapé e altura reduzida;
- região de tabela rolável sem aumentar `documentElement.scrollWidth`;
- texto longo em flex e grid sem deslocar ações;
- viewer com imagem grande, sem imagem e erro;
- preferência por movimento reduzido aplicada via emulação de mídia.

#### Concluída quando

As telas passam a dispor de componentes compartilhados seguros para largura, altura, toque, rolagem e
mídia, e as tarefas seguintes não precisam reinventar essas proteções.

#### Resultado e evidências

- `src/web/responsive-foundation.css` centraliza os breakpoints orientados por conteúdo (480, 700 e
  1024 px), contenção de filhos flex/grid, largura e padding fluidos, quebra de texto, grupos de ações,
  alvos de toque de 44 px, foco visível, safe areas e `prefers-reduced-motion`.
- O modal base agora respeita `vh`/`dvh`, largura disponível e safe areas, possui rolagem interna
  previsível e espaçamento compacto em 320 × 568 e 667 × 375. Viewer e estados de mídia preservam a
  caixa e usam contenção sem deformar imagens.
- `src/web/responsive-foundation.ts` transforma wrappers compartilhados de tabela, inclusive os
  inseridos após chamadas à API, em regiões focáveis e rotuladas. Os atributos de estado indicam se
  existe conteúdo horizontal antes/depois da posição atual.
- As primitives `.responsive-actions`, `.responsive-table-region`, `.responsive-record-card` e
  `.responsive-record-field` ficam disponíveis para as tarefas de tela sem duplicar proteções.
- `tests/e2e/responsive-foundation.spec.ts`: 20 de 20 cenários aprovados nas dez viewports da matriz,
  cobrindo modal com conteúdo longo e campo próximo ao rodapé, tabela rolável, texto longo, alvos de
  toque, ausência de overflow global e movimento reduzido.
- O smoke de `tests/e2e/responsiveness.spec.ts` passou nos quatro cenários do sistema principal antes
  reprovados em `tablet-portrait` e `tablet-landscape`; a navegação larga fica contida em rolagem
  interna até receber a composição móvel da `TASK-003`.
- Os quatro testes E2E existentes de Detalhe e Produtos passaram, cobrindo viewer, imagem ausente e o
  fluxo de foto sem regressão funcional.
- Verificações aprovadas: build Vite, `npm run typecheck`, `npm run lint`, Prettier direcionado aos
  arquivos de código alterados, `npm test` (71 arquivos, 307 testes) e `npm run test:integration`
  (10 arquivos, 84 testes).
- Screenshots do smoke foram atualizadas em `test-results/responsiveness/<viewport>/`. A falha de
  overflow de 94 px no documento independente de Comissões em 320 px permanece isolada e pertence ao
  recorte explícito da `TASK-007`; nenhuma regra global foi usada para ocultá-la.

---

### [x] TASK-003 — Adaptar navegação, autenticação e administração de Usuários

- Prioridade: P0.
- Dependências: `TASK-002`.
- Seções principais: 8, 13.1, 13.9 e 14.
- Entrega: navegação móvel explícita, Login robusto em baixa altura e cartões de usuário totalmente
  utilizáveis em telas compactas.

#### Trabalho incluído

1. Definir e implementar a composição móvel da navegação principal.
2. Garantir que:
   - todos os links permitidos sejam alcançáveis;
   - a rota atual permaneça identificada;
   - logout, notificações e preferência de preços não cubram destinos;
   - abrir, fechar e navegar funcionem por toque e teclado;
   - o comportamento seja correto com menu completo e reduzido por permissões.
3. Ajustar sticky header, foco e posicionamento dos painéis para não cobrir o início do conteúdo.
4. Validar Login, conta desativada, API indisponível e sem acesso em 320 px e baixa altura.
5. Transformar cada linha de usuário em composição responsiva que preserve:
   - avatar;
   - nome e e-mail longos;
   - perfil e estado;
   - permissões resumidas;
   - editar e ativar/desativar.
6. Adaptar a tabela de permissões por perfil para cartão ou rolagem interna acessível.
7. Ajustar os modais de edição e alteração de estado às regras compartilhadas.
8. Garantir touch targets, foco visível e ausência de truncamento dos botões.

#### Arquivos prováveis

- `src/web/prototype-transform.ts`;
- `src/web/main.ts`;
- `src/web/users-page.ts`;
- `tests/e2e/login.spec.ts`;
- `tests/e2e/users.spec.ts`;
- suíte responsiva criada na `TASK-001`.

#### Testes e verificações

- administrador com todos os links em 320, 390, 768 e 1440 px;
- usuário com permissões reduzidas;
- acesso por teclado a todos os destinos e retorno do foco ao fechar menu;
- usuário com nome de 120 caracteres e e-mail próximo ao limite do contrato;
- botões de ação integralmente dentro da viewport e sem sobreposição;
- modal de edição em 320 × 568 e 667 × 375;
- zoom de 200% nos fluxos principais.

#### Concluída quando

Navegação, autenticação e Usuários são integralmente operáveis em celular compacto, sem links escondidos,
overflow, corte de dados ou ações inacessíveis.

#### Resultado e evidências

- `src/web/responsive-auth-users.css` implementa o menu compacto até 1024 px, contenção de nomes
  longos, Login em baixa altura, cartões de usuário e cartões rotulados para permissões por perfil.
- `src/web/main.ts` controla abertura, fechamento, `aria-expanded`, foco inicial, contenção de `Tab`,
  fechamento por `Escape`, retorno de foco e fechamento ao navegar ou trocar de breakpoint. O menu
  foi validado com todas as permissões e com apenas `calculation.view`.
- `src/web/users-page.ts` preserva avatar, nome, e-mail, estado, resumo, perfil e ações; os modais de
  edição e situação agora contêm o foco e o devolvem ao controle que os abriu.
- `tests/e2e/task-003-responsiveness.spec.ts`: 40 de 40 cenários aprovados nas dez viewports, com dados
  longos, menu completo e reduzido, alvos de toque, modais, Login indisponível, baixa altura, ausência
  de overflow e reflow equivalente a 200% em uma janela de 1280 px.
- `tests/e2e/login.spec.ts` e `tests/e2e/users.spec.ts`: 6 de 6 testes funcionais aprovados.
- O smoke geral `npm run test:e2e:responsive` aprovou 27 de 30 cenários. As três falhas restantes são
  o overflow preexistente de 414 px no módulo externo de Comissões em 320, 390 e 412 px, já atribuído
  à `TASK-007`; todas as rotas e estados do sistema principal passaram.
- `npm run build`, `npm run typecheck`, ESLint direcionado e Prettier direcionado foram aprovados.
- Screenshots transitórias ficam em `test-results/responsiveness/<viewport>/`, incluindo
  `usuarios--menu-aberto.png`, `usuarios--usuarios-longos.png` e `login--baixa-altura.png`.

---

### [x] TASK-004 — Adaptar Busca, Produtos e Listas de Preço para dados densos

- Prioridade: P1.
- Dependências: `TASK-002`.
- Seções principais: 9, 12, 13.2, 13.6 e 13.8.
- Entrega: estratégias móveis explícitas para os catálogos e tabelas administrativas, preservando
  comparação, filtros, fotos, paginação e ações.

#### Trabalho incluído

1. Definir para cada tabela se o comportamento móvel será cartão, prioridade de colunas ou rolagem
   horizontal interna documentada.
2. Busca:
   - adaptar foto, código, descrição, perfil, preços e data;
   - preservar ordenação, filtros, paginação e abertura do detalhe;
   - sinalizar rolagem horizontal se ela continuar necessária.
3. Produtos:
   - adaptar toolbar, busca e filtro em 320 px;
   - tornar ações de foto e composição adequadas ao toque;
   - tratar descrições e referências longas;
   - adaptar tabela principal, modal de foto, viewer e composição.
4. Listas de Preço:
   - empilhar cards, público, faixa, importação e ações;
   - passar o formulário para uma coluna quando necessário;
   - conter a tabela de estrutura dentro do modal;
   - adaptar toolbar e paginação da estrutura.
5. Garantir que ocultar preços de referência não desalinhe cartões ou tabelas.
6. Preservar estados vazios, erro, carregamento e ausência de versão ativa.

#### Arquivos prováveis

- `src/web/prototype-transform.ts`;
- `src/web/search-page.ts`;
- `src/web/products-page.ts`;
- `src/web/price-lists-page.ts`;
- `src/web/components/media-image.ts`;
- `tests/e2e/search.spec.ts`;
- `tests/e2e/products.spec.ts`;
- `tests/e2e/price-lists.spec.ts`.

#### Testes e verificações

- tabelas com descrição e referência longas;
- ordenação e paginação depois da adaptação móvel;
- ações acessíveis sem rolar o documento horizontalmente;
- modal de composição e estrutura em 320 × 568 e celular horizontal;
- viewer dentro da viewport;
- tabelas internas rolando somente no wrapper;
- pelo menos 320, 390, 768, 1280 e 2560 px nas rotas abrangidas.

#### Concluída quando

Busca, Produtos e Listas de Preço oferecem uma experiência móvel intencional, legível e completa, sem
usar somente redução de fonte ou rolagem global para acomodar dados.

#### Resultado e evidências

- `src/web/responsive-catalogs.css` documenta e implementa as estratégias: Busca e Produtos viram
  cartões rotulados até 700 px; composição de kits e estrutura de listas preservam comparação em
  regiões de rolagem interna acessíveis, com colunas de identificação em larguras legíveis.
- A Busca ganhou ordenação móvel explícita por campo e direção, sincronizada com a URL e o backend.
  Foto, código, descrição, referência, perfil, preços, data, responsável, paginação e detalhe continuam
  acessíveis; ocultar preços de referência não desorganiza o cartão.
- Produtos empilha busca, filtro e contagem, preserva referências e descrições longas e oferece ações de
  foto e composição com área mínima de toque. Modal de foto, viewer e composição respeitam largura,
  altura dinâmica e baixa altura.
- Listas de Preço empilha cards, público, faixa, versão, importação, prévia e ações. O formulário passa
  para uma coluna; busca e paginação da estrutura quebram sem corte dentro do modal.
- `tests/e2e/task-004-responsiveness.spec.ts`: 30 de 30 cenários aprovados nas dez viewports da matriz,
  cobrindo dados longos, ordenação, ações, viewer, modal de foto, composição, formulário, estrutura,
  rolagem interna e ausência de overflow global. Após revisão visual, os 3 cenários de 320 px foram
  repetidos e aprovados.
- Testes funcionais existentes de Busca e Produtos: 4 de 4 aprovados. Em Listas de Preço, 3 de 5
  passaram; as duas falhas são as chamadas não mockadas de `orders/last-sale-prices` já registradas no
  baseline da `TASK-001`, sem relação com as alterações responsivas.
- Verificações aprovadas: `npm run build`, `npm run typecheck`, `npm run lint`, Prettier direcionado,
  `npm test` (71 arquivos e 307 testes) e `npm run test:integration` (10 arquivos e 84 testes). A
  asserção do transformador foi alinhada ao logo decorativo da navegação entregue na `TASK-003`.
  Screenshots transitórias foram geradas em `test-results/responsiveness/<viewport>/` para os três
  fluxos.
- A documentação das telas foi atualizada em `docs/telas/02-busca.md`,
  `docs/telas/10-produtos.md` e `docs/telas/06-atualizacao-matriz.md`.

---

### [x] TASK-005 — Adaptar Cálculo, Detalhe e Histórico

- Prioridade: P0.
- Dependências: `TASK-002`.
- Seções principais: 7, 11, 12, 13.3 e 13.4.
- Entrega: fluxo completo de cálculo e consulta histórica seguro em 320 px, incluindo seletores,
  totais, tabelas, imagens e modais.

#### Trabalho incluído

1. Garantir que a sidebar do Cálculo fique acima do conteúdo principal quando não houver largura para
   duas colunas.
2. Corrigir mínimos rígidos na lista e no modal de seleção de cliente, especialmente em 320 px.
3. Adaptar toolbar, seleção de listas, upload, prévia, estados de matriz e ações.
4. Ajustar cards de totais para uma ou duas colunas conforme o conteúdo, sem valores truncados.
5. Conter a tabela de resultado e preservar código, quantidade, unidade e preços.
6. Adaptar modais de cliente, listas e salvamento às regras globais de largura e altura.
7. Detalhe:
   - reorganizar foto, identificação, totais e ações;
   - preservar exportação, voltar e abertura de histórico;
   - adaptar composição e versões.
8. Histórico:
   - garantir leitura de versões e ações em telas estreitas;
   - permitir rolagem interna do modal sem ocultar fechamento.
9. Validar ausência e presença de foto, preços ocultos e dados longos.

#### Arquivos prováveis

- `src/web/prototype-transform.ts`;
- `src/web/calculations-page.ts`;
- `src/web/detail-page.ts`;
- `src/web/calculation-export.ts`, somente se a interface de acionamento exigir ajuste;
- `tests/e2e/calculations.spec.ts`;
- `tests/e2e/detail.spec.ts`.

#### Testes e verificações

- modal de cliente sem overflow em 320 × 568;
- lista com cliente de código, razão social, classe e responsável longos;
- cálculo com e sem foto;
- totais com valores grandes;
- tabela de resultado com rolagem interna;
- detalhe com várias versões e composição extensa;
- celular horizontal com modal aberto;
- zoom de 200% no fluxo de seleção e salvamento.

#### Concluída quando

O usuário consegue configurar, simular, salvar e consultar um cálculo em todas as faixas obrigatórias,
sem mínimos incompatíveis, corte de modal ou perda de ações.

#### Resultado e evidências

- `src/web/responsive-calculations.css` implementa a estratégia das três telas: sidebar acima do
  resultado até 760 px, totais fluidos, ações empilháveis, textos longos seguros e tabelas com
  rolagem interna. A composição conserva código, descrição, quantidade, unidade e preços.
- O seletor de cliente passa a cartões completos em telas compactas, sem ocultar código, razão
  social, classe ou responsável. Os modais de cliente, listas e histórico mantêm cabeçalho e rodapé
  alcançáveis, com rolagem apenas na região de conteúdo em baixa altura.
- O Detalhe reorganiza foto, identificação, totais e toolbar. O Histórico usa uma grade fluida por
  versão, preserva todas as ações e mantém o placeholder de foto sem mudar a largura.
- `tests/e2e/task-005-responsiveness.spec.ts`: 21 cenários aprovados nas dez viewports; os 9 skips são
  intencionais porque o caso de reflow equivalente a 200% roda somente no projeto `notebook`.
  Foram cobertos cliente e dados longos, foto presente e ausente, valores grandes, preços ocultos,
  tabelas internas, modais em 320 × 568 e 667 × 375, ausência de overflow global e ações dentro
  da viewport.
- `tests/e2e/calculations.spec.ts` e `tests/e2e/detail.spec.ts`: 4 de 4 testes funcionais aprovados.
- `npm run build`, `npm run typecheck`, ESLint direcionado, Prettier direcionado e o teste unitário
  de `prototype-transform` foram aprovados. A primeira tentativa de build no sandbox não pôde
  baixar o checksum do Prisma; a repetição autorizada fora do sandbox concluiu toda a geração e o
  build de produção.
- A documentação foi alinhada em `docs/telas/03-detalhe-kit.md`,
  `docs/telas/04-calculo-preco.md` e `docs/telas/05-historico-versoes.md`. Screenshots transitórias
  ficam em `test-results/responsiveness/<viewport>/`.

---

### [x] TASK-006 — Adaptar Pedidos e Aprovações de preço

- Prioridade: P0.
- Dependências: `TASK-002`.
- Seções principais: 8 a 11, 13.5 e 13.10.
- Entrega: montagem, revisão e aprovação de pedidos totalmente operáveis em celular, incluindo drawer,
  carrinho, impostos, rascunhos e notificações.

#### Trabalho incluído

1. Adaptar cabeçalho, etapas, cliente, listas e shell principal de Pedidos para telas estreitas.
2. Revisar abas de rascunhos para rolagem e indicação de conteúdo adicional, preservando descarte e
   seleção.
3. Drawer:
   - ocupar adequadamente a largura móvel;
   - respeitar área segura;
   - manter fechar, origem, busca, filtros, lista e paginação acessíveis;
   - reorganizar foto, informações, preços e botão de adicionar em 320 px.
4. Carrinho:
   - empilhar quantidade, preço, impostos e subtotal;
   - evitar sobreposição com fotos e remoção;
   - preservar preços de referência, último preço e estados de exceção;
   - manter todos os campos utilizáveis com teclado virtual.
5. Adaptar observação, totais e ação de gerar pedido.
6. Revisão e aprovação do solicitante:
   - manter resumo, itens, valores, justificativa e totais legíveis;
   - manter voltar, confirmar e solicitar aprovação alcançáveis.
7. Aprovações administrativas:
   - preservar cartões móveis e filtros em uma coluna;
   - adaptar detalhe, histórico e decisão à altura disponível;
   - garantir que aprovar, reprovar e fechar permaneçam acessíveis.
8. Ajustar painel de notificações para não ser coberto pelo cabeçalho nem causar overflow.

#### Arquivos prováveis

- `src/web/prototype-transform.ts`;
- `src/web/orders-page.ts`;
- `src/web/order-draft-tabs.ts`;
- `src/web/admin-price-approvals-page.ts`;
- `src/web/notifications.ts`;
- `tests/e2e/orders-customers.spec.ts`;
- `tests/e2e/admin-price-approvals.spec.ts`.

#### Testes e verificações

- pedido com kit e produto, fotos, impostos e valores grandes;
- múltiplos rascunhos com nomes longos;
- drawer aberto em 320 × 568 e 667 × 375;
- teclado virtual simulado em quantidade, preço e observação;
- revisão com muitos itens;
- solicitação abaixo do mínimo e acompanhamento do estado;
- fila administrativa, notificação, detalhe, aprovação e reprovação;
- asserções de overflow global e bounding boxes das ações principais.

#### Concluída quando

Todo o ciclo do pedido, incluindo exceção e decisão administrativa, funciona nas viewports obrigatórias
sem sobreposição, corte ou necessidade de rolagem horizontal do documento.

#### Resultado e evidências

- `src/web/responsive-orders-approvals.css` centraliza a adaptação vertical: rascunhos possuem rolagem
  horizontal local e indicação lateral; o drawer usa largura móvel, `dvh` e `safe-area`; catálogo,
  cliente, observação, totais e paginação permanecem contidos.
- O carrinho empilha quantidade, preço-base, impostos e subtotal abaixo de 700 px. Fotos e remoção não
  se sobrepõem, os quatro impostos possuem área clicável mínima de 44 px e textos monetários longos
  quebram sem serem truncados. A revisão e a solicitação de exceção mantêm cabeçalho e rodapé enquanto
  o conteúdo interno rola.
- Aprovações preserva filtros, cartões móveis, tabela intermediária com overflow interno, detalhe,
  justificativa, itens e decisão. O painel de notificações fica ancorado à viewport até 1024 px e não
  herda o deslocamento do menu móvel.
- `tests/e2e/task-006-responsiveness.spec.ts`: 30 de 30 cenários aprovados nas dez viewports, cobrindo
  cinco rascunhos, drawer, fotos, carrinho misto, impostos, números e textos longos, observação com
  viewport reduzida, revisão, fila administrativa, detalhe, decisão e notificações. As asserções
  verificam overflow global, bounding boxes, sobreposição, área de toque e corte do subtotal.
- `tests/e2e/orders-customers.spec.ts` e `tests/e2e/admin-price-approvals.spec.ts`: 11 de 11 testes
  funcionais aprovados. O cenário móvel preexistente do sino foi alinhado à navegação entregue na
  `TASK-003`, abrindo o menu antes de acionar a notificação.
- Verificações aprovadas: `npm run build`, `npm run typecheck`, `npm run lint`, Prettier direcionado,
  `npm test` (71 arquivos e 307 testes) e `npm run test:integration` (10 arquivos e 84 testes).
  Build e Vitest precisaram ser repetidos fora do sandbox devido, respectivamente, ao bloqueio de rede
  do checksum do Prisma e a `spawn EPERM` do `esbuild`.
- A revisão visual de 320 × 568 identificou e corrigiu a sobreposição entre a segunda linha de impostos
  e o subtotal. Screenshots transitórias ficam em `test-results/responsiveness/<viewport>/`; a
  documentação foi atualizada em `docs/telas/08-pedidos.md` e `docs/telas/11-aprovacoes-preco.md`.

---

### [ ] TASK-007 — Adaptar Clientes e o módulo de Comissões

- Prioridade: P1.
- Dependências: `TASK-002`.
- Seções principais: 9 a 11, 13.7 e 13.11.
- Entrega: administração de clientes e operações de Comissões legíveis e operáveis em telas compactas,
  com estratégias móveis consistentes para filtros, cartões, tabelas e modais.

#### Trabalho incluído

1. Clientes:
   - preservar e fortalecer a conversão atual da tabela para cartões;
   - adaptar toolbar para uma coluna quando duas colunas comprimirem o conteúdo;
   - garantir ações, paginação, classificação e dados longos dentro da viewport;
   - ajustar formulário, detalhes, tabs e cálculos vinculados;
   - definir estratégia móvel para tabelas internas do detalhe.
2. Investigar e corrigir, se relacionada ao estado atual do fluxo, a falha E2E de
   `#order-saved-draft`; se for independente de responsividade, registrar e isolar sem ampliar esta
   tarefa indevidamente.
3. Comissões:
   - substituir a redução para fontes de 8–9 px por estratégia móvel explícita;
   - adaptar navegação, filtros, toolbar, estatísticas e formulários;
   - conter tabelas em cartões, colunas prioritárias ou wrapper rolável legível;
   - ajustar prévia, filtros flutuantes e modais;
   - preservar os campos e comportamentos específicos de comissões.
4. Alinhar espaçamento, touch targets e comportamento responsivo entre Clientes e Comissões sem exigir
   que os dois módulos compartilhem toda a implementação visual.
5. Validar grandes volumes de opções e dados longos.

#### Arquivos prováveis

- `src/web/prototype-transform.ts`;
- `src/web/customers-page.ts`;
- `Comissoes/sistema_comissao_v3.html`;
- `tests/e2e/customers.spec.ts`;
- `tests/e2e/commissions.spec.ts`;
- testes responsivos compartilhados.

#### Testes e verificações

- Clientes em 320, 390, 768, 1280 e 2560 px;
- toolbar com todas as opções e rótulos longos;
- formulário e detalhe em celular horizontal;
- cálculo vinculado com tabela extensa dentro do detalhe;
- Comissões com estatísticas, filtros e tabela preenchida;
- dados de vendedor, representante e segmento preservados;
- ausência de fontes essenciais abaixo de 11 px;
- ausência de overflow global nos dois módulos.

#### Concluída quando

Clientes e Comissões deixam de depender de compressão excessiva e oferecem acesso completo aos dados e
ações em todas as faixas de referência.

---

### [ ] TASK-008 — Executar a matriz completa, corrigir regressões e fechar o quality gate

- Prioridade: P3.
- Dependências: `TASK-003` a `TASK-007`.
- Seções principais: 6, 14 a 20.
- Entrega: validação integrada de todas as rotas, correção das regressões encontradas, documentação e
  evidência suficiente para declarar o sistema responsivo dentro da matriz acordada.

#### Trabalho incluído

1. Executar a suíte smoke em todas as dimensões mínimas exigidas.
2. Executar fluxos profundos selecionados em:
   - 320 × 568;
   - 390 × 844;
   - 667 × 375;
   - 768 × 1024;
   - 1280 × 720;
   - 1440 × 900;
   - 2560 × 1080.
3. Validar cada rota com:
   - administrador e usuário de permissões reduzidas quando aplicável;
   - estados carregado, vazio e erro;
   - textos e números longos;
   - modais, drawers e notificações abertos;
   - zoom de 200%;
   - navegação por teclado;
   - movimento reduzido.
4. Corrigir regressões de layout que pertençam às tarefas anteriores e registrar a origem.
5. Executar todos os testes unitários, integração e E2E relacionados.
6. Executar typecheck, lint, formatação e build.
7. Revisar screenshots da matriz e registrar exceções intencionais, como rolagem interna de tabela.
8. Atualizar `docs/telas/00-componentes-compartilhados.md` e documentos de telas afetadas com os padrões
   responsivos finais.
9. Registrar breakpoints, primitives, estratégia de tabelas e orientação para novas funcionalidades.
10. Confirmar que nenhuma alteração de domínio, permissão ou contrato foi introduzida acidentalmente.

#### Arquivos prováveis

- `tests/e2e/responsiveness.spec.ts` e helpers;
- `playwright.config.ts`;
- testes E2E de cada tela;
- `docs/telas/00-componentes-compartilhados.md`;
- documentos específicos em `docs/telas/`;
- arquivos de interface corrigidos nas tarefas anteriores.

#### Testes e verificações

- `npm run typecheck`;
- `npm run lint`;
- `npm run format:check`;
- `npm test`;
- `npm run test:integration`;
- `npm run test:e2e`;
- `npm run build`;
- suíte responsiva por projeto/viewport;
- revisão visual das screenshots e traces de falha.

#### Critérios finais de aceite

1. Todas as rotas incluídas passam na matriz mínima.
2. Nenhuma rota apresenta overflow horizontal global causado pelo layout.
3. Navegação, logout e ações primárias são alcançáveis em 320 px.
4. Modais e drawers são operáveis em 320 × 568 e 667 × 375.
5. Usuários e seleção de cliente do Cálculo não possuem os mínimos rígidos identificados na spec.
6. Busca, Produtos e Comissões possuem estratégia móvel explícita para tabelas.
7. Dados essenciais de tabela não são comprimidos abaixo de 11 px.
8. Controles principais atendem à área mínima de toque.
9. Fluxos críticos continuam funcionais com zoom de 200%.
10. Não existem regressões funcionais relacionadas.
11. Falhas preexistentes foram corrigidas ou registradas separadamente com evidência.
12. A documentação descreve o comportamento realmente entregue.

#### Concluída quando

O quality gate completo está aprovado e existem evidências objetivas suficientes para afirmar suporte à
matriz de resoluções definida, sem depender apenas de inspeção manual.

## 8. Cobertura da especificação por tarefa

| Área da spec                   | Tarefas responsáveis                                       |
| ------------------------------ | ---------------------------------------------------------- |
| Contexto, matriz e evidências  | `TASK-001`, `TASK-008`                                     |
| Layout global e telas grandes  | `TASK-002`, `TASK-008`                                     |
| Navegação e sessão             | `TASK-003`                                                 |
| Tabelas e coleções densas      | `TASK-002`, `TASK-004`, `TASK-005`, `TASK-006`, `TASK-007` |
| Formulários e ações            | `TASK-002` a `TASK-007`                                    |
| Modais, drawers e notificações | `TASK-002`, `TASK-003`, `TASK-005`, `TASK-006`, `TASK-007` |
| Imagens e mídia                | `TASK-002`, `TASK-004`, `TASK-005`, `TASK-006`             |
| Login e Usuários               | `TASK-003`                                                 |
| Busca, Produtos e Listas       | `TASK-004`                                                 |
| Cálculo, Detalhe e Histórico   | `TASK-005`                                                 |
| Pedidos e Aprovações           | `TASK-006`                                                 |
| Clientes e Comissões           | `TASK-007`                                                 |
| Acessibilidade responsiva      | `TASK-002` a `TASK-008`                                    |
| Organização técnica CSS        | `TASK-002`, `TASK-008`                                     |
| Testes e critérios de aceite   | `TASK-001`, `TASK-008`                                     |

## 9. Controle de escopo

Não criar tarefas separadas apenas para:

- adicionar um breakpoint isolado;
- corrigir um seletor CSS;
- ajustar uma única coluna ou botão;
- gerar uma screenshot;
- instalar ou configurar uma dependência de teste;
- atualizar um teste já pertencente a uma entrega;
- alterar um único modal;
- reorganizar um arquivo sem mudança funcional.

Esses trabalhos pertencem à tarefa vertical correspondente. Uma nona tarefa só deve ser criada se
surgir uma entrega independente que não possa ser absorvida sem tornar uma das oito tarefas impossível
de revisar; a justificativa, dependências e impacto devem ser registrados neste arquivo antes do início.

## 10. Resultado esperado da sequência

Ao final das oito tarefas:

- o sistema principal e Comissões terão comportamento responsivo coerente;
- celular compacto deixará de ser um caso não garantido;
- tabelas densas terão estratégia móvel consciente;
- modais, drawers e ações funcionarão com baixa largura e baixa altura;
- navegação e Usuários deixarão de depender do layout desktop;
- testes automatizados impedirão regressões de overflow e alcance;
- novas telas terão padrões documentados para manter a responsividade.

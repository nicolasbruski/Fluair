# Especificação — Responsividade e adaptação multidispositivo

## 1. Status do documento

- Status: especificação funcional e técnica pronta para decomposição em tarefas.
- Data: 2026-10-18.
- Escopo desta etapa: consolidar requisitos de responsividade; nenhuma alteração de interface está
  incluída.
- Próxima etapa: derivar `tasks.md` com tarefas pequenas, priorizadas e verificáveis.
- Aplicações abrangidas: sistema principal de formação de preço e módulo de Comissões.

## 2. Objetivo

Garantir que todas as telas e fluxos do sistema sejam utilizáveis, legíveis e operáveis em celulares,
tablets, notebooks, desktops e monitores grandes, sem perda de informação ou de funcionalidade.

A implementação deve:

1. eliminar overflow horizontal da página causado pelo layout;
2. permitir que componentes internos rolem apenas quando a natureza do conteúdo justificar;
3. adaptar navegação, tabelas, formulários, cards, modais, drawers, imagens e ações para cada faixa de
   largura;
4. suportar telas estreitas, orientação horizontal, alturas reduzidas e teclado virtual;
5. preservar todos os recursos e permissões existentes em qualquer resolução;
6. manter legibilidade e alvos de toque adequados;
7. estabelecer uma matriz automatizada de testes de responsividade;
8. evitar que novas funcionalidades reintroduzam problemas de layout.

## 3. Interpretação de “responsivo”

Para esta especificação, uma tela responsiva não é apenas uma tela que pode ser acessada no celular.
Ela deve atender simultaneamente aos seguintes critérios:

- nenhum controle essencial fica cortado, sobreposto ou inacessível;
- não existe rolagem horizontal no documento principal;
- textos essenciais não dependem de fonte excessivamente pequena para caber;
- ações primárias permanecem identificáveis e alcançáveis;
- a ordem visual continua coerente com a ordem de leitura e de foco;
- tabelas recebem uma estratégia móvel explícita, como cartões, colunas prioritárias ou uma região de
  rolagem identificável;
- modais e drawers cabem na largura e altura disponíveis;
- o conteúdo continua utilizável com zoom do navegador e textos longos;
- mouse, teclado e toque continuam funcionais;
- não há remoção silenciosa de informação ou função para fazer o conteúdo caber.

## 4. Contexto atual analisado

### 4.1 Pontos já preparados

- O documento principal e o módulo de Comissões possuem `meta viewport`.
- O sistema principal limita o conteúdo geral a 1200 px e centraliza as telas.
- Grids compartilhados passam para uma coluna abaixo de 700 px.
- Pedidos muda sua estrutura principal para uma coluna abaixo de 900 px.
- O drawer de catálogo limita a largura em relação à viewport.
- Clientes converte sua tabela para uma apresentação em cartões abaixo de 1100 px.
- Aprovações converte sua tabela para cartões abaixo de 620 px.
- A tela de Cálculo reorganiza sua área lateral abaixo de 760 px.
- Diversos modais específicos possuem largura e altura relativas à viewport.
- Imagens usam contenção proporcional e possuem ajustes em telas menores.
- A navegação permite rolagem horizontal abaixo de 760 px.
- Existem testes pontuais em 390 × 844 para Login, Produtos, Clientes, Pedidos e Aprovações.

### 4.2 Lacunas identificadas

1. A navegação móvel continua sendo uma faixa horizontal de desktop e pode esconder destinos atrás dos
   controles fixados à direita.
2. A tela de Usuários mantém avatar, identificação, perfil e ações em uma única linha, sem composição
   móvel própria.
3. A seleção de cliente do Cálculo conserva larguras mínimas que podem ultrapassar o espaço útil de
   celulares de aproximadamente 320 px.
4. O modal compartilhado não possui proteção vertical global; somente alguns modais específicos
   implementam altura máxima e rolagem.
5. Busca e Produtos preservam tabelas largas e dependem principalmente de rolagem horizontal.
6. Comissões reduz tabelas até fontes de 8–9 px, prejudicando leitura e interação em celular.
7. Há controles interativos menores que o recomendado para uso por toque.
8. Não há tratamento consistente para viewport dinâmica, áreas seguras, orientação horizontal ou
   preferência por movimento reduzido.
9. A validação automatizada se concentra em 390 × 844 e não cobre uma matriz representativa de
   resoluções.
10. Nem todos os testes móveis verificam overflow global, corte, sobreposição ou alcance dos controles.

## 5. Escopo

### 5.1 Incluído

- Login e estados de autenticação;
- navegação principal e controles de sessão;
- Busca de cálculos;
- Detalhe e histórico de cálculo;
- criação e salvamento de Cálculo;
- Pedidos, carrinho, catálogo lateral, revisão e aprovação;
- Produtos e composição de kits;
- Clientes e seus modais de cadastro e detalhes;
- Listas de Preço e visualização de estrutura;
- Usuários, permissões e seus modais;
- Aprovações de preço e notificações;
- módulo de Comissões;
- estados vazios, carregamento, erro, feedback e notificações;
- imagens, tabelas, formulários, cards, menus, drawers e modais compartilhados;
- comportamento com textos longos e quantidades variáveis de registros;
- acessibilidade diretamente relacionada à adaptação de layout;
- testes visuais, funcionais e de overflow em diferentes viewports.

### 5.2 Fora de escopo

- alteração de regras comerciais, cálculos ou permissões;
- redesign da identidade visual;
- criação de aplicativo móvel nativo;
- suporte a navegadores obsoletos sem cobertura do projeto;
- reformulação de relatórios, PDFs ou planilhas exportadas, salvo quando sua abertura afeta a interface;
- mudança de contratos de API que não seja indispensável à apresentação responsiva;
- otimizações gerais de performance sem relação direta com o layout.

## 6. Faixas de referência

As regras devem responder ao espaço disponível e não a modelos específicos de aparelho. A matriz
abaixo define larguras mínimas de validação, sem obrigar o uso exato desses valores como breakpoints
CSS.

| Categoria | Viewports mínimas de validação | Intenção |
| --- | --- | --- |
| Celular compacto | 320 × 568 e 360 × 640 | Detectar mínimos rígidos, corte e modais altos |
| Celular atual | 390 × 844 e 412 × 915 | Validar o uso móvel principal |
| Celular horizontal | 667 × 375 e 844 × 390 | Validar baixa altura e orientação horizontal |
| Tablet | 768 × 1024 e 1024 × 768 | Validar transição entre composições |
| Notebook | 1280 × 720 e 1366 × 768 | Validar altura limitada e layout padrão |
| Desktop | 1440 × 900 e 1920 × 1080 | Validar densidade e limites de conteúdo |
| Ultrawide | 2560 × 1080 | Validar centralização e largura de leitura |

O sistema deve permanecer funcional entre esses pontos, e não somente nas dimensões exatas listadas.

## 7. Requisitos globais de layout

### RG-RES-001 — Sem overflow horizontal global

Em todas as rotas e estados testados:

`document.documentElement.scrollWidth <= window.innerWidth`

Componentes deliberadamente roláveis, como certas tabelas, devem conter a rolagem dentro de seu
próprio wrapper e não aumentar a largura do documento.

### RG-RES-002 — Largura fluida

Contêineres de página devem respeitar a largura disponível, ter `min-width: 0` quando participarem de
flex ou grid e usar limites máximos somente para preservar leitura e hierarquia.

### RG-RES-003 — Espaçamento em telas estreitas

Em 320 px, o conteúdo deve manter margem lateral suficiente para não encostar nas bordas, sem consumir
espaço a ponto de impedir o uso dos controles.

### RG-RES-004 — Conteúdo em telas grandes

Em desktops e ultrawide, o conteúdo deve permanecer centralizado, legível e visualmente agrupado. A
largura máxima pode variar por tipo de tela, especialmente em consultas densas, mas linhas de texto e
formulários não devem se alongar sem necessidade.

### RG-RES-005 — Textos variáveis

Nomes, e-mails, códigos, descrições, cidades e mensagens longas devem quebrar, truncar com indicação ou
expandir de forma controlada. Nenhum texto de dados pode empurrar uma ação para fora da viewport.

### RG-RES-006 — Zoom e tamanho de texto

Os fluxos principais devem continuar utilizáveis com zoom de navegador de 200%. O layout não deve
depender de impedir zoom nem de fontes menores que o limite de leitura definido nesta especificação.

### RG-RES-007 — Altura dinâmica

Componentes dependentes da altura da tela devem preferir unidades de viewport dinâmica quando houver
benefício, com fallback compatível. Barras móveis, teclado virtual e orientação horizontal não podem
ocultar permanentemente ações de fechar, cancelar ou confirmar.

### RG-RES-008 — Áreas seguras

Elementos fixos junto às bordas devem considerar `env(safe-area-inset-*)` quando aplicável, sobretudo
drawers, notificações, rodapés de modal e ações inferiores.

### RG-RES-009 — Redução de movimento

Animações e transições não essenciais devem respeitar `prefers-reduced-motion: reduce`.

## 8. Navegação e sessão

### RF-NAV-001 — Navegação móvel explícita

A navegação deve possuir uma composição própria para telas pequenas. Pode ser menu expansível,
navegação rolável aprimorada ou outro padrão consistente, desde que:

- todos os destinos permitidos sejam alcançáveis;
- a página atual permaneça identificada;
- exista sinalização clara quando houver itens fora da área visível;
- os controles de sessão não cubram links;
- abrir e fechar funcione por toque e teclado.

### RF-NAV-002 — Controles prioritários

Sair, notificações e preferências de preço devem continuar acessíveis, mas não podem consumir a maior
parte da largura útil nem impedir a navegação entre módulos.

### RF-NAV-003 — Estado com permissões variadas

O comportamento deve ser validado com poucos e muitos links autorizados, incluindo administrador com
todos os módulos e usuário comum com menu reduzido.

### RF-NAV-004 — Cabeçalho fixo

O cabeçalho sticky não pode cobrir títulos, âncoras, painéis de notificação ou o primeiro controle
focável da página.

## 9. Tabelas e coleções densas

### RF-TAB-001 — Estratégia declarada por tabela

Cada tabela deve adotar explicitamente uma das estratégias abaixo:

1. conversão para cartões/linhas empilhadas;
2. exibição de colunas prioritárias com detalhe acessível;
3. rolagem horizontal interna, quando a comparação entre colunas for essencial.

Somente reduzir fonte e padding não é uma estratégia suficiente.

### RF-TAB-002 — Rolagem interna utilizável

Quando houver rolagem horizontal:

- a região deve caber integralmente na página;
- deve ser operável por toque e teclado;
- deve existir indicação visual de conteúdo adicional quando necessário;
- colunas de identificação ou ações podem permanecer fixas se isso não reduzir excessivamente o espaço;
- a fonte do conteúdo não deve ser reduzida abaixo de 11 px para dados essenciais.

### RF-TAB-003 — Cartões móveis completos

Quando uma linha virar cartão, cada valor deve possuir rótulo, a ordem deve refletir a importância do
dado e as ações devem permanecer associadas ao registro correto.

### RF-TAB-004 — Estados especiais

Carregamento, vazio, erro e paginação devem ocupar corretamente a largura tanto no modo tabela quanto
no modo cartão.

### RF-TAB-005 — Tabelas abrangidas

Devem ser revisadas individualmente as tabelas de Busca, Produtos, Clientes, estrutura de Listas de
Preço, composição de kits, Usuários/perfis, Aprovações, detalhes de cliente e Comissões.

## 10. Formulários e ações

### RF-FOR-001 — Colunas adaptáveis

Formulários com duas ou mais colunas devem passar para uma coluna antes que rótulos, inputs ou mensagens
de erro sejam comprimidos.

### RF-FOR-002 — Campos sem zoom involuntário

Inputs, selects e textareas devem usar tamanho de fonte que evite zoom automático indesejado em
navegadores móveis.

### RF-FOR-003 — Ações empilháveis

Grupos de botões devem quebrar ou empilhar em telas estreitas, mantendo a ação primária reconhecível e
sem truncar seus rótulos.

### RF-FOR-004 — Alvos de toque

Controles principais devem possuir área interativa de pelo menos 44 × 44 px. Controles compactos podem
ter representação visual menor, desde que a área clicável respeite esse mínimo e não se sobreponha a
outros controles.

### RF-FOR-005 — Teclado virtual

Ao focar um campo, o usuário deve conseguir visualizar o campo, sua mensagem de erro e a ação necessária
para prosseguir. Rodapés fixos não podem bloquear o conteúdo.

### RF-FOR-006 — Erros e ajuda

Mensagens de validação devem quebrar linhas sem alterar a largura da página e permanecer próximas do
campo correspondente.

## 11. Modais, drawers e notificações

### RF-MOD-001 — Proteção global

O componente base de modal deve possuir limite de largura e altura relativo à viewport, layout interno
flexível e uma área rolável previsível. Modais específicos podem especializar esse comportamento, mas
não devem precisar corrigir individualmente a ausência de proteção básica.

### RF-MOD-002 — Ações sempre alcançáveis

Cabeçalho, botão de fechar e ações críticas devem permanecer alcançáveis em telas baixas. Quando o
conteúdo rolar, a hierarquia entre conteúdo e rodapé deve continuar clara.

### RF-MOD-003 — Modal em celular compacto

Em 320 × 568, nenhum modal pode exceder a viewport ou exigir rolagem horizontal. O padding deve ser
reduzido de forma consistente quando necessário.

### RF-MOD-004 — Orientação horizontal

Em celular horizontal, o modal deve priorizar altura útil, permitir rolagem interna e evitar grandes
espaçamentos ou prévias que ocultem as ações.

### RF-MOD-005 — Drawer de Pedidos

O drawer deve usar a largura inteira disponível em celulares pequenos, respeitar áreas seguras e manter
busca, filtros, lista e fechamento acessíveis com diferentes alturas.

### RF-MOD-006 — Painel de notificações

O painel deve permanecer dentro da viewport, não ser coberto pelo cabeçalho e permitir acesso a todos
os itens e ações em celular.

## 12. Imagens e mídia

### RF-MID-001 — Proporção e contenção

Fotos de produtos e kits devem preservar proporção, usar contenção e não deformar ou ampliar além da
qualidade disponível.

### RF-MID-002 — Viewer

O visualizador deve caber em largura e altura, permitir fechamento mesmo com imagem grande e continuar
utilizável em orientação horizontal.

### RF-MID-003 — Estados sem imagem e erro

Placeholder, carregamento e erro devem ocupar as mesmas dimensões planejadas da imagem e não causar
saltos ou overflow.

## 13. Requisitos por tela

### 13.1 Login e autenticação

- O card deve caber em 320 px sem corte.
- Estados de erro e indisponibilidade devem quebrar corretamente.
- A tela deve continuar utilizável com teclado virtual e em baixa altura.
- Logo, campos e ação principal não podem depender de rolagem horizontal.

### 13.2 Busca

- Definir estratégia móvel para foto, código, descrição, perfil, preços e data.
- Filtros, ordenação e paginação devem permanecer acessíveis.
- Caso a tabela continue rolável, a rolagem deve ser interna e claramente percebida.

### 13.3 Detalhe e histórico

- O resumo do kit e a foto devem se reorganizar sem mínimos rígidos.
- Tabelas de composição e histórico devem seguir os requisitos de tabelas densas.
- Ações de voltar, exportar e abrir histórico devem quebrar de forma previsível.

### 13.4 Cálculo

- A área lateral deve ficar acima do conteúdo principal em telas estreitas.
- A seleção de cliente deve funcionar em 320 px sem larguras mínimas incompatíveis.
- Cards de totais devem permanecer legíveis; em 320 px pode ser necessária uma única coluna.
- Seleção de listas, prévia, tabela de resultado e salvamento devem ser testados em baixa altura.
- Todos os modais do fluxo devem seguir o comportamento global de modais.

### 13.5 Pedidos

- Etapas, cliente, listas, carrinho e aprovações devem usar uma coluna em celular.
- Controles de quantidade, preço e impostos não podem se sobrepor.
- O drawer deve adaptar imagem e informações sem sacrificar o botão de adicionar.
- Revisão e aprovação devem manter totais e ações visíveis.
- Abas de rascunhos devem ser roláveis e indicar que existem outras abas.

### 13.6 Produtos

- Definir uma estratégia móvel além da simples redução de padding da tabela.
- Busca e filtro devem ocupar linhas adequadas em 320 px.
- Ações de foto e composição devem ser fáceis de tocar.
- Modal de foto, viewer e composição devem caber em telas baixas.

### 13.7 Clientes

- Preservar a conversão atual para cartões e validá-la em 320, 390 e 768 px.
- Toolbar deve passar para uma coluna quando duas colunas comprimirem selects ou botões.
- Formulário e detalhes devem permitir rolagem interna sem esconder ações.
- Tabelas internas dos cálculos do cliente devem ter estratégia móvel explícita.

### 13.8 Listas de Preço

- Cards, público, faixa e ações devem empilhar em telas estreitas.
- Formulário deve passar para uma coluna.
- A visualização da estrutura deve manter rolagem dentro do modal.
- Toolbar e paginação da estrutura devem quebrar ou empilhar sem corte.

### 13.9 Usuários

- Cada linha deve virar cartão ou composição empilhada no celular.
- Nome, e-mail, perfil, estado e ações devem permanecer visíveis com dados longos.
- Ações administrativas não podem sair da viewport.
- A tabela de permissões por perfil deve possuir estratégia móvel.
- Modais de edição e estado devem funcionar em 320 × 568.

### 13.10 Aprovações

- Preservar a conversão atual da tabela em cartões.
- Filtros devem ocupar uma coluna quando necessário.
- Detalhes, itens, justificativas e decisões devem rolar internamente.
- Botões de aprovar, reprovar e fechar devem permanecer alcançáveis.
- O painel de notificações deve continuar sem overflow global.

### 13.11 Comissões

- A responsividade não deve depender de reduzir dados essenciais para 8–9 px.
- Tabelas devem receber uma estratégia de cartão, prioridade de colunas ou rolagem interna legível.
- Navegação, filtros, estatísticas e formulários devem funcionar em 320 px.
- Prévia, filtros flutuantes e modais devem permanecer dentro da viewport.
- O comportamento deve ser consistente com o sistema principal, mesmo que o módulo mantenha seus estilos
  próprios.

## 14. Acessibilidade relacionada à responsividade

### RNF-ACE-001 — Ordem de foco

Mudanças visuais entre desktop e mobile não podem produzir uma ordem de foco incoerente.

### RNF-ACE-002 — Conteúdo oculto

Informações escondidas por prioridade visual devem continuar disponíveis por detalhe, rótulo acessível
ou outra interação equivalente.

### RNF-ACE-003 — Foco visível

Todos os controles devem possuir foco visível, inclusive dentro de regiões roláveis, menus, modais e
drawers.

### RNF-ACE-004 — Legibilidade

- Texto essencial: mínimo recomendado de 12 px; preferencialmente 14–16 px em formulários e conteúdo
  principal.
- Metadados auxiliares: nunca menores que 10 px.
- Dados essenciais de tabela não devem ser reduzidos abaixo de 11 px para evitar rolagem.

### RNF-ACE-005 — Contraste e estados

Seleção, erro, desabilitado e foco não podem depender apenas de cor nem perder contraste em layouts
compactos.

## 15. Requisitos técnicos e organização CSS

### RNF-TEC-001 — Fonte única e rastreável

As regras responsivas devem ser organizadas por componente ou módulo, evitando acumular correções
globais conflitantes no HTML legado e em blocos extensos de strings TypeScript.

### RNF-TEC-002 — Breakpoints consistentes

Breakpoints podem variar quando o conteúdo exigir, mas devem partir de um conjunto pequeno e documentado.
Regras duplicadas ou contraditórias para a mesma faixa devem ser consolidadas.

### RNF-TEC-003 — Componentes compartilhados

Modal, toolbar, tabela rolável, card móvel, grupo de ações e estados de mídia devem ter comportamento
compartilhado sempre que suas necessidades forem equivalentes.

### RNF-TEC-004 — Sem detecção por dispositivo

A interface não deve depender de user agent ou modelo de aparelho para decidir layout. As decisões
devem ser baseadas em espaço, capacidades de entrada e preferências do usuário.

### RNF-TEC-005 — Sem regressão funcional

Mudanças de layout não podem alterar permissões, payloads, cálculos, persistência ou fluxo comercial.

## 16. Estratégia de testes

### 16.1 Verificações comuns em todas as rotas

Cada rota relevante deve validar pelo menos:

- ausência de overflow horizontal global;
- visibilidade do título e da ação principal;
- acesso à navegação e ao logout;
- ausência de sobreposição entre componentes;
- foco visível e navegação básica por teclado;
- textos longos sem expansão indevida;
- carregamento, vazio, erro e dados preenchidos;
- screenshots de referência em pontos críticos.

### 16.2 Matriz mínima automatizada

Os testes E2E de responsividade devem incluir, no mínimo:

- 320 × 568;
- 390 × 844;
- 667 × 375;
- 768 × 1024;
- 1280 × 720;
- 1440 × 900;
- 2560 × 1080.

Não é obrigatório executar todos os fluxos completos em todas as dimensões. Deve existir uma suíte
rápida de layout cobrindo todas as rotas e uma suíte funcional mais profunda nas dimensões de maior
risco.

### 16.3 Testes específicos

- Navegação com todas as permissões e com permissões reduzidas.
- Usuários com nome e e-mail longos e ações administrativas.
- Cálculo com modal de cliente em 320 px.
- Pedidos com carrinho misto, impostos, aprovação e drawer aberto.
- Busca e Produtos com descrições longas e múltiplas colunas.
- Clientes com filtros, cartões, formulário e detalhe.
- Listas com estrutura larga dentro do modal.
- Aprovações com filtros, notificação, detalhe e decisão.
- Comissões com tabela larga, filtros e modal aberto.
- Modal com conteúdo maior que a altura disponível.
- Campo próximo ao final do formulário com teclado virtual simulado ou viewport reduzida.

### 16.4 Critério de estabilidade visual

Screenshots não devem ser a única evidência. Cada cenário deve combinar, quando aplicável:

- asserções de `scrollWidth` e `clientWidth`;
- bounding boxes dentro da viewport;
- visibilidade e possibilidade de clique;
- ausência de sobreposição por comparação geométrica;
- screenshot para revisão humana.

## 17. Critérios de aceite

A iniciativa será considerada concluída quando:

1. todas as rotas incluídas passarem pela matriz mínima de viewports;
2. não houver overflow horizontal global causado pelo layout;
3. navegação, logout e ações primárias forem alcançáveis em 320 px;
4. nenhum modal ou drawer exigir rolagem horizontal;
5. todos os modais forem operáveis em 320 × 568 e 667 × 375;
6. Usuários e Cálculo não apresentarem os mínimos rígidos identificados na análise;
7. Busca, Produtos e Comissões tiverem estratégia móvel explícita para suas tabelas;
8. nenhuma tabela usar fonte essencial menor que 11 px como solução de encaixe;
9. controles principais atenderem à área mínima de toque;
10. o sistema continuar funcional com zoom de 200%;
11. os fluxos existentes não sofrerem regressão funcional;
12. os testes automatizados incluírem verificações objetivas de overflow e alcance;
13. documentação e padrões de componentes forem atualizados para orientar novas telas.

## 18. Priorização recomendada para a futura decomposição

### P0 — Bloqueios e riscos de corte

- proteção global de modais;
- navegação móvel;
- tela de Usuários;
- seleção de cliente no Cálculo em 320 px;
- overflow global e drawer de Pedidos.

### P1 — Experiência móvel de dados densos

- Busca;
- Produtos;
- tabelas internas de Clientes e Listas de Preço;
- Comissões;
- áreas e controles de toque.

### P2 — Robustez multidispositivo

- orientação horizontal;
- viewport dinâmica e teclado virtual;
- áreas seguras;
- telas ultrawide;
- movimento reduzido;
- consolidação e organização das regras CSS.

### P3 — Prevenção de regressões

- suíte E2E matricial;
- helpers compartilhados de asserção de layout;
- screenshots de referência;
- documentação de padrões responsivos.

## 19. Riscos e cuidados de implementação

1. A interface atual combina CSS do protótipo HTML com estilos injetados por
   `src/web/prototype-transform.ts`; mudanças isoladas podem ser sobrescritas pela ordem das regras.
2. Alterar tabelas para cartões exige garantir rótulos corretos e preservar ações, ordenação e estados
   vazios.
3. A navegação varia conforme permissões; testar apenas um perfil pode ocultar overflow.
4. Alguns testes E2E dependem de mocks extensos e podem falhar antes de alcançar a etapa responsiva.
5. O módulo de Comissões possui documento e estilos próprios e deve ser tratado explicitamente.
6. Esconder colunas ou textos sem alternativa acessível pode corrigir o visual e criar perda funcional.
7. Breakpoints baseados apenas em aparelhos atuais tendem a falhar com zoom, textos maiores e janelas
   redimensionadas.

## 20. Evidências da análise inicial

- Os cenários E2E de Login, Produtos e Aprovações foram executados em conjunto: 11 testes passaram,
  incluindo os cenários móveis existentes.
- O teste principal de Clientes falhou antes da etapa móvel por ausência de `#order-saved-draft` em
  uma expectativa funcional; por isso, a validação responsiva desse fluxo ficou inconclusiva nessa
  execução.
- A suíte atual usa predominantemente 390 × 844 e não constitui evidência suficiente para declarar
  suporte a todas as resoluções.
- Nenhuma mudança de aplicação foi realizada durante a análise que originou esta especificação.


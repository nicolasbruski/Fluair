# Componentes e comportamentos compartilhados

## Finalidade

Este documento define elementos comuns a todas as telas. O objetivo é evitar que navegação, mensagens, carregamento, erros e formatação sejam implementados de maneiras diferentes durante a migração gradual.

## Estrutura geral da aplicação

A aplicação autenticada terá uma estrutura comum composta por:

1. Cabeçalho ou menu principal.
2. Logo oficial da Fluair, igual à usada no sistema de Comissões, posicionada à esquerda do menu principal.
3. Itens de navegação filtrados pelas permissões do usuário.
4. Identificação do usuário logado e ação de sair.
5. Área principal onde a tela atual é carregada.
6. Camada global de mensagens, confirmações e modais.

No protótipo atual, todas as telas permanecem no mesmo HTML e a função `show(id)` apenas alterna a classe visual. No sistema migrado, cada tela deverá possuir uma rota própria para permitir atualização do navegador, link direto, histórico de navegação e proteção de acesso.

## Navegação esperada

Rotas conceituais iniciais:

| Rota | Destino |
|---|---|
| `/login` | Login |
| `/calculos` | Busca de cálculos |
| `/calculos/novo` | Novo cálculo |
| `/calculos/:id` | Detalhe de um cálculo |
| `/kits/:codigo/historico` | Histórico do kit |
| `/matrizes` | Atualização e versões de matriz |
| `/usuarios` | Usuários e permissões |
| `/pedidos/novo` | Montagem de pedido, em etapa futura |
| `/clientes` | Cadastro de clientes, em etapa futura |

O nome final das rotas poderá mudar, mas os identificadores usados para carregar detalhe e histórico devem ser estáveis e não depender da posição de um item em uma lista.

## Componentes visuais compartilhados

| Componente | Responsabilidade |
|---|---|
| Menu de navegação | Exibir somente destinos permitidos ao usuário atual |
| Cabeçalho de página | Apresentar título, descrição curta e ações principais |
| Botão primário | Ação principal da tela, com estado normal, carregando e desabilitado |
| Botão secundário | Navegação ou ação não destrutiva |
| Botão destrutivo | Exclusão ou desativação; sempre exige confirmação |
| Campo de texto | Rótulo persistente, valor, ajuda e mensagem de validação |
| Seletor | Escolha entre valores previamente definidos |
| Upload de arquivo | Seleção, nome, validação, progresso, sucesso e erro |
| Imagem de catálogo | Miniatura ou exibição, placeholder estável, texto alternativo e ampliação opcional |
| Tabela de dados | Cabeçalho, ordenação, paginação, estado vazio e carregamento |
| Tag de status | Situação curta, sem depender apenas da cor |
| Card de total | Valor monetário ou indicador agregado |
| Modal | Ação contextual que não justifica uma rota separada |
| Drawer | Seleção auxiliar extensa, usado atualmente em Pedidos |
| Toast | Confirmação transitória de sucesso, aviso ou erro não bloqueante |
| Alerta persistente | Problema que exige decisão, como matriz desatualizada |

## Estados obrigatórios

Toda tela que consulta o backend deverá prever:

- **Carregando:** indicador visível e prevenção de envio duplicado.
- **Vazio:** mensagem específica e próxima ação sugerida.
- **Erro recuperável:** explicação e botão para tentar novamente.
- **Sem permissão:** mensagem própria; não deve parecer erro técnico.
- **Sessão expirada:** redirecionamento ao login preservando, quando seguro, a rota pretendida.
- **Sucesso:** confirmação da ação e atualização dos dados exibidos.
- **Dados desatualizados:** tratamento quando outro usuário alterou o registro desde que a tela foi aberta.
- **Imagem indisponível:** substituir o ícone quebrado por placeholder sem bloquear os demais dados.

## Formatação e dados

- Valores monetários serão exibidos em real brasileiro, por exemplo `R$ 1.234,56`.
- Valores serão enviados pela API como números decimais ou strings decimais bem definidas, nunca derivados do texto formatado.
- Datas serão armazenadas de forma consistente no servidor e exibidas no fuso `America/Sao_Paulo`.
- Códigos de produto e kit são identificadores textuais. Zeros à esquerda, se existirem, não podem ser removidos.
- Quantidades podem exigir casas decimais; essa regra deverá acompanhar o conteúdo real das folhas Korp.
- Nenhum HTML vindo de planilhas, nomes ou descrições deve ser renderizado sem tratamento.
- Listagens usam somente `thumbnailUrl`; `displayUrl` fica reservado para detalhe, prévia e
  ampliação. Nenhuma resposta JSON transporta Base64 ou bytes da imagem.

## Glossário de domínio

### Cliente real

Empresa ou pessoa para quem um pedido será preparado. Possui nome, localização, contato e, futuramente, outras informações comerciais. Será mantido na tela de Clientes.

### Perfil de preço

Categoria usada para escolher a matriz de cálculo: `Implementador`, `Comércio / Reposição` ou `Consumidor Final`. No protótipo ela aparece em alguns lugares como “cliente”, mas não representa o cadastro de um cliente real.

### Produto

Item identificado por código, descrição e unidade que aparece na composição importada da folha do Korp. Inicialmente será descoberto e atualizado por cálculos realizados pelos usuários.

### Kit

Produto composto identificado pela folha de processo do Korp. Um kit pode possuir vários cálculos ao longo do tempo e para diferentes perfis de preço.

### Matriz de preço

Conjunto versionado de preços mínimo e normal por código de produto, associado a um perfil de preço.

### Cálculo

Resultado de cruzar uma folha de processo com uma versão de matriz. Deve guardar uma fotografia completa dos itens e valores usados para que o histórico não mude no futuro.

## Regras de segurança compartilhadas

- Esconder um item do menu melhora a interface, mas não concede segurança. Toda ação deve ser autorizada novamente no backend.
- Senhas e segredos nunca serão incluídos no frontend ou em arquivos versionados.
- A sessão deverá usar cookie seguro e inacessível ao JavaScript quando frontend e backend estiverem no mesmo domínio.
- Uploads terão limite de tamanho, extensão, conteúdo e quantidade de linhas.
- Ações administrativas e alterações relevantes de preço deverão registrar usuário, data e contexto.
- Mensagens técnicas completas ficarão nos logs; o usuário receberá uma mensagem segura e compreensível.

## Responsividade e acessibilidade

- Todas as ações devem funcionar por teclado.
- Modais devem manter o foco internamente e devolver o foco ao elemento que os abriu.
- Cores de tabela mínima, normal, alerta e sucesso precisam ser acompanhadas por texto.
- Tabelas largas podem ter rolagem horizontal sem ocultar ações essenciais.
- Em telas menores, colunas secundárias podem ser reorganizadas, mas código, descrição, preço e ação principal devem continuar disponíveis.
- Toda imagem informativa possui texto alternativo; ampliação abre por teclado, fecha com `Escape`
  e devolve o foco. Código, descrição e tipo nunca dependem apenas da imagem.

# Documentação funcional das telas — Fluair

## Objetivo

Esta pasta documenta o comportamento efetivo e o escopo futuro de cada tela durante a migração do
protótipo estático para uma aplicação com backend e banco de dados.

Esta documentação não é o plano de implementação. O plano técnico e a ordem definitiva das alterações serão definidos somente depois que os fluxos e regras abaixo forem revisados.

As decisões técnicas, a arquitetura e o procedimento obrigatório para migrar cada tela estão consolidados em [`CLAUDE.md`](../../CLAUDE.md). Os dois contextos devem ser usados juntos: `CLAUDE.md` orienta como implementar e o documento da tela define o que aquela tela precisa fazer.

## Fonte analisada

`fluair-tabpreco-merge-pedidos.html` é a fonte visual. O Vite substitui as áreas migradas e remove
seus dados demonstrativos antes de gerar o bundle.

## Índice

| Documento | Tela ou assunto | Situação pretendida |
|---|---|---|
| [00-componentes-compartilhados.md](00-componentes-compartilhados.md) | Navegação, mensagens, padrões de estado e glossário | Base de todas as telas |
| [00-permissoes.md](00-permissoes.md) | Autenticação, papéis e permissões por capacidade | Fundação implementada no recorte de Login |
| [01-login.md](01-login.md) | Login e início da sessão | Migrada para API, MySQL e sessão persistente |
| [02-busca.md](02-busca.md) | Busca dos cálculos já realizados | Parte da primeira migração funcional |
| [03-detalhe-kit.md](03-detalhe-kit.md) | Resultado completo de um cálculo salvo | Parte da primeira migração funcional |
| [04-calculo-preco.md](04-calculo-preco.md) | Cálculo server-side com listas dinâmicas | Implementada |
| [05-historico-versoes.md](05-historico-versoes.md) | Histórico de cálculos e versões | Parte da primeira migração funcional |
| [06-atualizacao-matriz.md](06-atualizacao-matriz.md) | Administração e importação de listas | Implementada |
| [07-usuarios-permissoes.md](07-usuarios-permissoes.md) | Administração de usuários e acessos | Restrita a usuários autorizados |
| [08-pedidos.md](08-pedidos.md) | Montagem e cotação do carrinho | Implementada sem persistência do pedido |
| [09-clientes.md](09-clientes.md) | Cadastro e classificação de clientes reais | Implementada |
| [10-produtos.md](10-produtos.md) | Catálogo unificado e gestão de fotos | Implementada |

## Escopo confirmado

- Produtos possui catálogo unificado de kits e produtos avulsos e permite administrar a foto
  principal; identidade e ofertas continuam vindas dos cálculos e listas persistidas.
- Produtos e kits serão formados a partir dos cálculos executados pelos usuários.
- Pedidos consome cálculos e listas avulsas versionadas; não usa lista fixa no JavaScript.
- O cadastro de clientes usa a base real migrada do sistema de comissões e não depende de dados no navegador.
- A finalização de pedidos será concluída posteriormente.
- O envio de pedidos por e-mail será definido em uma etapa futura, depois da regra de geração do pedido.
- Todas as telas internas exigirão autenticação.
- O acesso às telas e ações será controlado por permissões. Somente usuários autorizados poderão administrar todo o sistema.

## Convenções usadas nos documentos

- **Estado atual:** comportamento encontrado no arquivo HTML.
- **Comportamento alvo:** comportamento esperado depois da migração da tela.
- **Fora do escopo atual:** requisito conhecido, mas que não deve bloquear a primeira versão funcional.
- **Permissão:** capacidade validada no frontend para exibição e obrigatoriamente no backend para autorização.
- **Cálculo:** registro imutável do resultado de uma execução, incluindo composição, preços, matriz, usuário e data.
- **Versão atual:** cálculo mais recente de um kit para determinada lista; versões anteriores continuam preservadas.

## Regra para atualização desta documentação

Quando uma regra for decidida ou alterada, o documento da tela deve ser atualizado antes ou junto da implementação. Cada tela migrada deverá satisfazer seus critérios de aceite e não apenas reproduzir a aparência do protótipo.

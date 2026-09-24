# Autenticação e permissões

## Objetivo

Garantir que cada usuário veja e execute somente as telas e ações para as quais recebeu acesso. Apenas alguns usuários poderão administrar integralmente o sistema.

## Princípio adotado

O sistema poderá oferecer papéis como modelos de acesso, mas a autorização será baseada em permissões explícitas. Isso evita limitar o sistema a apenas “Admin” e “Operador” quando surgir, por exemplo, um usuário que pode atualizar matrizes, mas não gerenciar outras contas.

## Papéis iniciais sugeridos

### Administrador

Modelo com todas as permissões. Deve ser atribuído a poucas pessoas.

### Operador de cálculo

Modelo para quem consulta resultados existentes, visualiza históricos e exporta arquivos. A criação de
novos cálculos passou a ser exclusiva do modelo Administrador.

### Consulta

Modelo futuro para quem pode apenas buscar, abrir detalhes e exportar resultados já existentes.

Os nomes e a composição final dos papéis ainda devem ser confirmados. A implementação não deve espalhar comparações como `role === "ADMIN"` em cada tela; deve consultar capacidades.

## Catálogo inicial de permissões

| Código conceitual | Permite |
|---|---|
| `calculation.view` | Acessar Busca e Detalhe do Kit |
| `calculation.create` | Acessar a tela de Cálculo e salvar novos resultados |
| `calculation.history` | Visualizar versões anteriores |
| `calculation.export` | Exportar resultado ou versão em Excel |
| `matrix.view` | Consultar listas, versões e situação |
| `matrix.manage` | Administrar listas, importar e ativar versões |
| `matrix.recalculate` | Recalcular kits com uma nova versão de lista |
| `user.view` | Consultar usuários e permissões |
| `user.manage` | Criar, editar, desativar e alterar permissões |
| `order.access` | Acessar a montagem e cotação de pedidos |
| `price.view` | Visualizar catálogo e valores na montagem de pedidos |
| `price.override` | Informar preço negociado diferente da referência |
| `customer.view` | Selecionar, consultar e exportar clientes |
| `customer.manage` | Criar, editar, ativar e desativar clientes |
| `catalog.manage` | Adicionar, substituir e remover fotos de produtos e kits |
| `commission.access` | Acessar o sistema de comissões e sua base compartilhada de clientes |

## Matriz preliminar

| Tela ou ação | Administrador | Operador de cálculo | Consulta |
|---|---:|---:|---:|
| Login | Sim | Sim | Sim |
| Busca | Sim | Sim | Sim |
| Detalhe do cálculo | Sim | Sim | Sim |
| Novo cálculo | Sim | Não | Não |
| Histórico | Sim | Sim | Sim |
| Exportar Excel | Sim | Sim | Opcional |
| Consultar listas | Sim | Opcional | Não |
| Administrar/importar listas | Sim | Não | Não |
| Recalcular em massa | Sim | Não | Não |
| Gerenciar usuários | Sim | Não | Não |
| Pedidos | Sim | Por concessão | Por concessão |
| Clientes | Sim | Por concessão | Por concessão |
| Comissões | Individual | Individual | Individual |

`Opcional` significa que a capacidade poderá ser concedida individualmente sem transformar o usuário em administrador.

## Comportamento da interface

- O menu mostra somente telas acessíveis.
- Acessar diretamente uma URL sem permissão apresenta “Você não possui acesso a esta área”.
- Botões de ações restritas não aparecem para quem não possui a capacidade correspondente.
- Se a permissão for removida durante uma sessão, a próxima chamada ao backend será recusada e a interface deverá atualizar a sessão.
- A tela de usuários deve impedir que o último administrador ativo retire de si mesmo todas as permissões administrativas.

## Regras do backend

- Toda rota autenticada identifica o usuário pela sessão.
- Cada endpoint valida a permissão necessária; não confia em flags enviadas pelo navegador.
- Tentativas negadas relevantes entram no log de segurança.
- Contas devem ser desativadas em vez de apagadas fisicamente quando já tiverem cálculos ou operações associadas.
- Registros históricos continuam mostrando o nome do responsável mesmo se a conta for desativada.

## Sessão e senha

- E-mail normalizado e único por usuário.
- Senha armazenada somente por hash seguro.
- Login com limitação de tentativas.
- Cookie de sessão `HttpOnly`, `Secure` em produção e com política `SameSite` adequada.
- Logout invalida a sessão no servidor.
- Alteração administrativa de senha poderá, conforme decisão posterior, invalidar outras sessões do usuário.

## Pontos ainda a confirmar

- Quem será o primeiro administrador de produção.
- Se usuários de consulta poderão exportar valores.
- Se haverá permissão independente para enxergar tabela mínima e tabela normal.
- Política para preço negociado abaixo ou acima da tabela quando Pedidos for finalizado.
- Necessidade futura de recuperação de senha por e-mail.

Esses pontos não impedem o uso das capacidades já implementadas e podem ser refinados sem trocar a
autorização por comparações de papel.

## Estado implementado

A fundação técnica de autenticação e autorização foi implementada com papéis usados somente como
modelos e permissões efetivas calculadas a cada chamada. O seed estrutural inicial adota:

- **Administrador:** todas as permissões gerais documentadas; Comissões permanece individual;
- **Operador de cálculo:** `calculation.view`, `calculation.history` e `calculation.export`;
- **Consulta:** `calculation.view` e `calculation.history`.

Como a exportação para Consulta está marcada como opcional na matriz preliminar, ela não é
concedida automaticamente. Pode ser concedida por override individual quando a regra for
aprovada. A composição dos modelos pode evoluir pelo seed/migração sem introduzir verificações de
papel nas telas.

As tabelas `roles`, `permissions`, `role_permissions` e `user_permission_overrides` armazenam essa
estrutura. O endpoint de sessão retorna apenas as permissões efetivas; negações individuais
prevalecem sobre concessões do papel. O backend disponibiliza middlewares de autenticação e de
capacidade usados por Clientes, Listas, Cálculo, Pedidos e demais endpoints migrados.

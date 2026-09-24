# Tela de Usuários e Permissões

## Identificação

- Rota conceitual: `/usuarios`
- Permissões: `user.view` para consulta e `user.manage` para alterações
- Estado atual: listagem e administração integradas à API e ao banco
- Prioridade: necessária para administrar acessos

## Objetivo

Permitir que usuários autorizados criem contas, desativem acessos e definam quais telas e ações cada pessoa poderá utilizar.

## Componentes

| Componente | Responsabilidade |
|---|---|
| Lista de usuários | Nome, e-mail, situação, papel e resumo de permissões |
| Busca/filtro | Localizar por nome, e-mail, papel ou situação quando houver volume |
| Formulário de criação | Nome, e-mail, senha inicial, modelo e acesso individual a Comissões |
| Modal de edição | Alterar identificação, papel, acesso a Comissões e senha opcional |
| Confirmação de desativação | Explicar impacto antes de remover o acesso |
| Matriz de permissões | Exibir as capacidades dos papéis; edição individual permanece futura |
| Estado da conta | Ativa, desativada ou convite pendente, se adotado futuramente |

Os campos de senha inicial e de nova senha possuem controle para exibir ou ocultar o valor enquanto ele está sendo digitado. Senhas já gravadas não podem ser recuperadas ou exibidas: o administrador deve definir uma nova senha quando necessário.

No formulário de criação, o campo de perfil oferece somente **Admin** e **Vendedor**. Esses nomes correspondem, respectivamente, aos papéis internos `ADMINISTRATOR` e `CALCULATION_OPERATOR`. Papéis legados continuam preservados para contas existentes e podem ser exibidos na edição, mas não podem ser escolhidos ao criar uma conta.

## Mapeamento técnico do protótipo

| Elemento ou comportamento | Identificador/função atual |
|---|---|
| Container | `#s-usuarios` |
| Lista | `#lista-usuarios`; linhas criadas a partir de `GET /api/v1/users` |
| Campos de criação | `#novo-nome`, `#novo-email`, `#novo-senha`, `#novo-perfil` |
| Criação | `#users-create-form` / `createUser()` |
| Modal de edição | `#modal-editar-usuario` / `updateUser()` |
| Modal de situação | `#modal-status-usuario` / `setUserActive()` |
| Serviço frontend | `src/web/services/users-api.ts` |
| Módulo backend | `src/server/modules/users` |

## Criação de usuário

Campos mínimos:

- nome;
- e-mail único;
- senha inicial ou mecanismo futuro de convite;
- papel/modelo inicial;
- permissões efetivas.

Fluxo:

1. Administrador preenche os dados.
2. Interface valida campos obrigatórios e formato.
3. Backend valida unicidade do e-mail e autorização do administrador.
4. Senha é transformada em hash seguro antes da gravação.
5. Conta é criada ativa ou pendente, conforme a regra escolhida.
6. Lista é atualizada a partir da resposta real.

## Edição

Deve permitir:

- corrigir nome;
- alterar e-mail, respeitando unicidade;
- alterar modelo de papel;
- conceder ou retirar permissões específicas;
- ativar ou desativar a conta;
- redefinir senha, se essa opção for mantida.

Deve exibir claramente a diferença entre um papel usado como modelo e permissões personalizadas.

## Exclusão versus desativação

O protótipo fala em excluir e remove visualmente a linha. No sistema com histórico, a operação recomendada é desativar:

- usuário perde novas sessões e acesso;
- cálculos e operações antigas continuam ligados à sua identidade;
- conta pode ser reativada por um administrador;
- o registro não é apagado fisicamente.

Uma exclusão definitiva só deve existir para contas criadas por engano e ainda sem qualquer vínculo, se houver necessidade real.

## Proteções administrativas

- Um usuário não pode conceder permissões que ele próprio não possui, salvo regra superior definida.
- O sistema não pode ficar sem pelo menos um administrador ativo.
- Remover a própria permissão de administrar deve exigir confirmação reforçada.
- Desativar um usuário deve invalidar suas sessões ativas.
- Alterações de permissão devem valer nas chamadas seguintes ao backend.
- Alterações devem entrar no log de auditoria com autor, alvo, antes e depois.

## Permissões da própria tela

- `user.view`: visualizar usuários, situações e acessos.
- `user.manage`: criar, editar, desativar e redefinir acessos.
- Se a separação não for necessária inicialmente, apenas `user.manage` poderá liberar a rota inteira.

## Estado implementado

- Os quatro usuários fictícios são removidos do HTML entregue pela aplicação.
- A lista retorna usuários, papéis e permissões efetivas diretamente do banco.
- Criação normaliza o e-mail, valida unicidade e armazena somente o hash Argon2 da senha.
- Edição permite alterar nome, e-mail, papel, acesso individual a Comissões e, opcionalmente, a senha.
- A antiga exclusão foi substituída por desativação reversível; sessões abertas são revogadas.
- A própria conta não pode ser desativada e o último administrador ativo não pode ser desativado nem rebaixado.
- Usuários com apenas `user.view` consultam a lista, sem formulário ou botões administrativos.
- Criação, edição, ativação e desativação são registradas em `audit_logs`.
- Atualizar a página recarrega o estado persistido.

## Estados e validações

- E-mail já utilizado.
- Formato inválido ou campos ausentes.
- Usuário não encontrado por alteração concorrente.
- Tentativa de remover último administrador.
- Falha ao desativar sessões.
- Sucesso com confirmação e atualização da lista.
- Lista vazia não deve ocorrer em produção, pois precisa existir administrador inicial.

## Critérios de aceite

- Usuário criado consegue autenticar com as permissões configuradas.
- Alterações permanecem após atualizar a página.
- Conta desativada não consegue entrar ou continuar usando sessão antiga.
- Menu e endpoints respondem imediatamente às permissões efetivas.
- Último administrador não pode ser removido ou desativado.
- Histórico de cálculos mantém o nome de usuários desativados.
- Senhas nunca aparecem em listagens, respostas ou logs.
- Todas as alterações administrativas são auditáveis.

## Decisões pendentes

- Senha inicial manual ou convite por e-mail em etapa futura.
- Se o próprio usuário poderá alterar sua senha fora desta tela.
- Necessidade de exigir troca de senha no primeiro acesso.
- Interface genérica para as demais concessões e negações em `user_permission_overrides`; o acesso a Comissões já possui controle individual.

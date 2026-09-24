# Tela de Login

## Identificação

- Rota conceitual: `/login`
- Acesso: público, somente enquanto não houver sessão autenticada
- Estado atual: migrado para API, MySQL e sessão persistente
- Prioridade: necessária para liberar qualquer tela funcional

## Objetivo

Identificar o usuário, iniciar uma sessão segura e carregar suas permissões. A tela não decide quais áreas o usuário pode acessar; ela recebe essa informação do backend após a autenticação.

## Componentes

| Componente | Conteúdo ou responsabilidade |
|---|---|
| Marca | Logo oficial da Fluair, reutilizada diretamente do sistema de Comissões |
| Título | Sistema de Formação de Preço |
| Campo de e-mail | Identificador da conta |
| Campo de senha | Credencial secreta, com botão para exibir/ocultar os caracteres |
| Botão Entrar | Envia as credenciais e apresenta estado de carregamento |
| Mensagem de erro | Credenciais inválidas, conta desativada, excesso de tentativas ou indisponibilidade |
| Ajuda de acesso | Orientação para falar com o administrador |

## Mapeamento técnico do protótipo

| Elemento atual | Identificador ou implementação |
|---|---|
| Container da tela | `#s-login` |
| Navegação após clique | `show('busca')` |
| Campo de e-mail | Sem `id`; possui valor demonstrativo |
| Campo de senha | Sem `id`; possui valor demonstrativo |

Na migração, os campos precisarão de estado controlado, associação entre rótulo e input, envio de formulário e tratamento da resposta da API.

## Fluxo principal

1. Usuário acessa uma rota protegida ou abre `/login`.
2. Informa e-mail e senha.
3. A interface valida presença e formato básico do e-mail.
4. O botão entra em estado de carregamento e evita cliques duplicados.
5. O backend valida credenciais e situação da conta.
6. Em caso de sucesso, cria a sessão e retorna dados básicos do usuário e suas permissões.
7. A aplicação redireciona para a rota originalmente solicitada ou para a primeira tela permitida.

## Estados e mensagens

### Inicial

Campos vazios. O protótipo hoje preenche e-mail e uma senha ilustrativa; esses valores devem ser removidos.

### Enviando

Botão desabilitado com indicador de progresso. Os campos podem permanecer visíveis, mas não devem permitir múltiplos envios simultâneos.

### Credenciais inválidas

Mensagem genérica: “E-mail ou senha inválidos”. A tela não deve revelar se determinado e-mail existe.

### Conta desativada

Mensagem orientando o contato com o administrador, sem iniciar sessão.

### Muitas tentativas

Mensagem informando bloqueio temporário. A limitação deve acontecer no backend.

### Backend indisponível

Mensagem de falha temporária com opção de tentar novamente.

### Usuário já autenticado

Acessar `/login` com sessão válida redireciona para uma tela permitida.

## Dados

Entrada:

- `email`
- `password`

Retorno conceitual de sucesso:

- identificador do usuário;
- nome de exibição;
- e-mail;
- permissões efetivas;
- informação de sessão, preferencialmente em cookie seguro.

## Regras de segurança

- A senha nunca deve ser registrada em log, retornada pela API ou mantida no estado além do necessário.
- A sessão não deve ser simulada apenas escondendo ou mostrando telas.
- O backend deve conferir a senha por hash seguro.
- O login deve aplicar limitação de tentativas por conta e origem.
- Todas as telas protegidas devem validar a sessão ao serem carregadas.

## Estado atual encontrado

- Os campos possuem valores ilustrativos.
- O botão `Entrar` chama diretamente `show('busca')`.
- Não há formulário enviado, API, sessão, hash de senha ou validação.
- Qualquer pessoa com o arquivo consegue navegar pelas telas.

## Dependências para migração

- Tabelas ou serviço de usuários, papéis e permissões.
- Endpoint de autenticação.
- Mecanismo de sessão.
- Componente global de proteção de rotas.

## Critérios de aceite

- Credenciais válidas iniciam uma sessão real.
- Credenciais inválidas não liberam nenhuma tela.
- Usuário desativado não consegue entrar.
- Atualizar o navegador mantém uma sessão válida.
- Sair invalida a sessão e retorna ao login.
- Menu e rota inicial respeitam as permissões recebidas.
- Nenhuma senha ou token sensível aparece no HTML, URL ou armazenamento inseguro do navegador.

## Fora do escopo inicial

- Recuperação de senha por e-mail.
- Autenticação em dois fatores.
- Login social ou integração com diretório corporativo.

## Implementação entregue

- Banco MySQL versionado para usuários, papéis, permissões, overrides, sessões, limitação de
  tentativas e auditoria.
- Senhas com Argon2id e criação explícita do primeiro administrador por comando, sem senha padrão.
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me` e `POST /api/v1/auth/logout`.
- Cookie opaco `HttpOnly`, `SameSite=Lax`, `Secure` em produção e token armazenado no banco somente
  como HMAC.
- Limitação persistente por combinação de e-mail normalizado e origem, com identificador derivado
  e sem e-mail gravado na tabela de limitação.
- Validação Zod, proteção de origem nas mutações, cabeçalhos de segurança, logs com campos
  sensíveis ocultos e auditoria de sucesso, falha, logout e negação de capacidade.
- A proteção de origem ocorre antes da leitura do corpo; JSON malformado e requisições acima do
  limite recebem erros seguros `400` e `413`, e novas tentativas durante um bloqueio são auditadas.
- Rota `/login`, restauração após recarregar, retorno seguro à rota solicitada, primeira rota
  permitida, menu filtrado e estado próprio de acesso negado.
- Campos inicialmente vazios, validação acessível, bloqueio de envio duplicado e mensagens para
  credenciais inválidas, conta desativada, excesso de tentativas, sessão expirada e indisponibilidade.
- A marca textual provisória foi substituída pela logo oficial da Fluair no topo do card de login.

O arquivo `fluair-tabpreco-merge-pedidos.html` permanece intacto. O Vite o usa como fonte no build,
substitui apenas Login e navegação compartilhada, e preserva as telas ainda não migradas com seus
mocks atuais. No servidor de desenvolvimento, uma tentativa de abrir diretamente o arquivo-fonte é
redirecionada para `/login`, impedindo o acesso à navegação legada sem a proteção nova.

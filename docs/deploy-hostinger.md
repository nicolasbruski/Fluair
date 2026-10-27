# Deploy na Hostinger pelo GitHub

Este projeto deve ser publicado como uma aplicação Node.js/Express, e não como um site Vite
estático. O Express serve tanto a API quanto os arquivos de `dist/web`.

## 1. Preparar o MySQL

No painel da Hostinger, abra **Websites > Dashboard > Databases > Management** e crie um banco,
um usuário e uma senha. Guarde os nomes completos fornecidos pelo painel, inclusive o prefixo da
conta.

A URL usada pela aplicação tem este formato:

```text
mysql://USUARIO:SENHA@127.0.0.1:3306/BANCO
```

Use `127.0.0.1`, não `localhost`. Caracteres reservados da senha, como `@`, `:`, `/`, `#` e `%`,
devem estar codificados para URL.

## 2. Primeiro deploy: banco novo e primeiro administrador

Em **Websites > Create Website > Web App > Import Git Repository**, selecione o repositório e a
branch `main`. Use:

- Node.js: `22.x`;
- diretório raiz: `.`;
- comando de build: `npm run build` (detectado automaticamente pela Hostinger);
- diretório de saída: `dist`;
- arquivo de entrada, se solicitado: `dist/src/server/server.js`;
- comando de inicialização, se solicitado: `npm start`.

Cadastre estas variáveis no painel antes do primeiro deploy:

```dotenv
NODE_ENV=production
PORT=3000
APP_URL=https://SEU-DOMINIO
DATABASE_URL=mysql://USUARIO:SENHA@127.0.0.1:3306/BANCO
SESSION_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
LOG_LEVEL=info
ORDER_PRICE_APPROVAL_VALIDITY_DAYS=7
ORDER_NOTIFICATION_RECIPIENTS=EMAIL_QUE_RECEBE_OS_PEDIDOS
EMAIL_DELIVERY_ENABLED=false
EMAIL_WORKER_ENABLED=false
HOSTINGER_DEPLOY=true
HOSTINGER_INITIAL_SETUP=true
ADMIN_NAME=NOME_DO_PRIMEIRO_ADMINISTRADOR
ADMIN_EMAIL=EMAIL_DO_PRIMEIRO_ADMINISTRADOR
ADMIN_PASSWORD=SENHA_FORTE_DO_PRIMEIRO_ADMINISTRADOR
```

Para gerar `SESSION_SECRET` localmente:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Com `HOSTINGER_DEPLOY=true`, o comando `build` compila a aplicação e aplica todas as migrations.
No primeiro deploy, `HOSTINGER_INITIAL_SETUP=true` também executa o seed e cria o primeiro
administrador. Se esse deploy for repetido, o seed e a criação do mesmo administrador são
idempotentes; a senha existente não é alterada.

Após o primeiro deploy bem-sucedido:

1. remova `HOSTINGER_INITIAL_SETUP`, `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` das variáveis
   da Hostinger;
2. mantenha `HOSTINGER_DEPLOY=true`;
3. faça um novo deploy e teste o login.

Nos deploys seguintes, `npm run build` compila o projeto e aplica apenas migrations pendentes.

## 3. Habilitar os e-mails com cron

Primeiro, valide um domínio remetente no Resend. Depois configure:

```dotenv
EMAIL_PROVIDER=resend
EMAIL_DELIVERY_ENABLED=true
EMAIL_WORKER_ENABLED=false
EMAIL_API_KEY=CHAVE_DA_RESEND
EMAIL_FROM=pedidos@SEU-DOMINIO
EMAIL_FROM_NAME=Fluair
EMAIL_REPLY_TO=EMAIL_PARA_RESPOSTAS
ORDER_NOTIFICATION_RECIPIENTS=EMAIL_QUE_RECEBE_OS_PEDIDOS
```

Reinicie a aplicação. `EMAIL_WORKER_ENABLED=false` impede o temporizador contínuo, que não é
garantido na hospedagem Cloud, mas os pedidos continuam entrando na fila do banco.

No painel, abra **Advanced > Cron Jobs** e agende a execução a cada minuto. A Hostinger preenche o
caminho inicial do Node.js; o comando completo deve seguir este modelo, substituindo usuário e
domínio:

```text
/opt/alt/alt-nodejs22/root/bin/node --env-file=/home/u123456789/domains/exemplo.com/hbuilds/config/.env /home/u123456789/domains/exemplo.com/hbuilds/current/nodejs/dist/src/server/scripts/process-order-emails.js
```

O cron roda em UTC. Cada execução envia até 100 itens elegíveis e termina; falhas transitórias são
reagendadas pela própria fila. Confira o resultado em **Cron Jobs > View Output**.

## 4. Verificação após publicar

1. abra a URL HTTPS e entre com o administrador inicial;
2. confira no phpMyAdmin se as tabelas e dados iniciais existem;
3. crie um registro de teste e confirme que ele persiste após reiniciar a aplicação;
4. depois de habilitar o Resend, gere um pedido de teste e verifique o cron e o status do envio;
5. mantenha o deploy automático da `main` desligado até concluir esses testes; depois, habilite-o.

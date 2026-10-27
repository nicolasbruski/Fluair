import { spawnSync } from 'node:child_process';

const enabled = process.env.HOSTINGER_DEPLOY === 'true';
const initialSetup = process.env.HOSTINGER_INITIAL_SETUP === 'true';

function runNpmScript(script: string): void {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`O comando npm run ${script} terminou com status ${String(result.status)}.`);
  }
}

function requireInitialAdministrator(): void {
  const missing = ['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'].filter(
    (key) => !process.env[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(`Variaveis obrigatorias para o primeiro deploy: ${missing.join(', ')}.`);
  }
}

function main(): void {
  if (!enabled) {
    console.info('Etapa de banco da Hostinger ignorada (HOSTINGER_DEPLOY diferente de true).');
    return;
  }

  console.info('Aplicando migrations do banco da Hostinger.');
  runNpmScript('db:migrate');

  if (!initialSetup) {
    console.info('Setup inicial da Hostinger desabilitado; seed e administrador foram ignorados.');
    return;
  }

  requireInitialAdministrator();
  console.info('Executando seed inicial da Hostinger.');
  runNpmScript('db:seed');
  console.info('Criando o primeiro administrador da Hostinger.');
  runNpmScript('db:bootstrap-admin');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

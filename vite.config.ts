import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { defineConfig, type Plugin } from 'vite';

import { transformPrototype } from './src/web/prototype-transform.js';

const prototypeFileName = 'fluair-tabpreco-merge-pedidos.html';

function isDirectPrototypeRequest(requestUrl: string | undefined): boolean {
  if (!requestUrl) return false;
  try {
    const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname)
      .replaceAll('\\', '/')
      .toLocaleLowerCase('en-US');
    return pathname === `/${prototypeFileName.toLocaleLowerCase('en-US')}`;
  } catch {
    return false;
  }
}

function preservedPrototype(): Plugin {
  return {
    name: 'fluair-preserved-prototype',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isDirectPrototypeRequest(req.url)) {
          next();
          return;
        }
        res.statusCode = 302;
        res.setHeader('Location', '/login');
        res.end();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      async handler() {
        const source = await readFile(resolve(import.meta.dirname, prototypeFileName), 'utf8');
        return transformPrototype(source);
      },
    },
  };
}

function privateCommissionsBuild(): Plugin {
  return {
    name: 'fluair-private-commissions-build',
    apply: 'build',
    async closeBundle() {
      const sourceDirectory = resolve(import.meta.dirname, 'Comissoes');
      const outputDirectory = resolve(import.meta.dirname, 'dist/private/comissoes');
      await mkdir(resolve(outputDirectory, 'imagem'), { recursive: true });
      await Promise.all([
        copyFile(
          resolve(sourceDirectory, 'sistema_comissao_v3.html'),
          resolve(outputDirectory, 'sistema_comissao_v3.html'),
        ),
        copyFile(
          resolve(sourceDirectory, 'imagem/Logo.jpg'),
          resolve(outputDirectory, 'imagem/Logo.jpg'),
        ),
      ]);
    },
  };
}

export default defineConfig({
  plugins: [preservedPrototype(), privateCommissionsBuild()],
  publicDir: resolve(import.meta.dirname, 'Comissoes/imagem'),
  build: { outDir: 'dist/web', emptyOutDir: true },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
      '/comissoes': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
});

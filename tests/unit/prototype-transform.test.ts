import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { transformPrototype } from '../../src/web/prototype-transform.js';

describe('transformPrototype', () => {
  it('migra Login, Busca e Usuários, preservando as telas legadas intermediárias', async () => {
    const original = await readFile(
      resolve(process.cwd(), 'fluair-tabpreco-merge-pedidos.html'),
      'utf8',
    );
    const transformed = transformPrototype(original);

    expect(transformed).toContain('id="login-form"');
    expect(transformed.match(/<img[^>]+src="\/Logo\.jpg"[^>]+alt="Fluair"/g)).toHaveLength(2);
    expect(transformed).toContain('class="nav-logo"');
    expect(transformed).toContain('id="hide-reference-prices"');
    expect(transformed).toContain('id="order-hide-reference-prices"');
    expect(transformed.match(/data-reference-price-visibility/g)).toHaveLength(2);
    expect(transformed).toContain(
      '#s-pedido .order-drawer-meta{justify-content:space-between;gap:16px}',
    );
    expect(transformed).toContain('.reference-prices-hidden .reference-price');
    expect(transformed).toContain('class="login-logo"');
    expect(transformed).not.toContain('class="login-mark"');
    expect(transformed).not.toContain('<div class="navLogo"><div class="dot"></div>Fluair</div>');
    expect(transformed).toContain('src="/src/web/main.ts"');
    expect(transformed).toContain(
      '</script>\n<script type="module" src="/src/web/main.ts"></script>\n</body>',
    );
    expect(transformed.match(/src="\/src\/web\/main\.ts"/g)).toHaveLength(1);
    expect(transformed).not.toContain('value="samara@fluair.com.br"');
    expect(transformed).not.toContain('onclick="show(\'login\')"');
    for (const screen of [
      'busca',
      'detalhe',
      'pedido',
      'calc',
      'historico',
      'matriz',
      'clientes',
      'usuarios',
    ]) {
      expect(transformed).toContain(`id="s-${screen}"`);
    }
    expect(original).toContain('const PEDIDO_PRODUTOS');
    expect(transformed).not.toContain('const PEDIDO_PRODUTOS');
    expect(transformed).not.toContain("cod:'703100'");
    expect(transformed).not.toContain('min:4287.50');
    expect(transformed).not.toContain('pedidoRenderGrid');
    expect(transformed).not.toContain('pedidoEnviar');
    expect(transformed).not.toContain('let pedidoCart');
    expect(original).toContain('const PEDIDO_CLIENTES');
    expect(transformed).not.toContain('const PEDIDO_CLIENTES');
    expect(transformed).not.toContain('Implementador Exemplo Ltda.');
    expect(transformed).not.toContain('pedidoRenderClienteOptions()');
    expect(transformed).toContain('id="pedido-client-trigger"');
    expect(transformed).toContain('id="order-customer-add"');
    expect(transformed).toContain(
      'class="btn btn-ghost btn-sm" id="order-customer-add">Pré cadastro de cliente',
    );
    expect(transformed).toContain('id="order-customer-pre-form"');
    expect(transformed).toContain('id="pedidoClienteOptions" role="listbox"');
    expect(transformed).toContain('id="order-price-lists"');
    expect(transformed).toContain('id="order-drawer-list"');
    expect(transformed).toContain(
      '.order-drawer-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 18px 24px;',
    );
    expect(transformed).not.toContain('2 · Lista de preço e itens do pedido');
    expect(transformed).not.toContain(
      'Escolha o cliente e adicione os itens pelo painel lateral para montar o pedido.',
    );
    expect(transformed).not.toContain('id="order-catalog"');
    expect(original).toContain('value="samara@fluair.com.br"');
    expect(original).toContain('const _buscaAllData=(()=>{');
    expect(transformed).not.toContain('const _buscaAllData=[];');
    expect(transformed).not.toContain('const _buscaAllData=(()=>{');
    expect(transformed).not.toContain('id="recentes-body"');
    expect(transformed).not.toContain('id="result-area"');
    expect(transformed).not.toContain('buscaFiltrar()');
    expect(transformed).not.toContain('buscaInit()');
    expect(transformed).not.toContain('function verDetalheByCode(code)');
    expect(transformed).not.toContain('function generateMockComposition(');
    expect(transformed).not.toContain('function renderDetalhe(item)');
    expect(transformed).toContain('id="detail-history"');
    expect(transformed).toContain('HISTÓRICO ACESSADO PELO DETALHE REAL');

    const searchStart = transformed.indexOf('id="s-busca"');
    const searchEnd = transformed.indexOf('id="s-detalhe"');
    const transformedSearch = transformed.slice(searchStart, searchEnd);
    expect(transformedSearch).not.toContain('onclick="buscaSort');
    expect(transformedSearch).not.toContain('130001');
    expect(transformedSearch).not.toContain('Buscas Recentes');
    expect(original).toContain('id="user-row-samara"');
    expect(transformed).not.toContain('id="user-row-samara"');
    expect(transformed).not.toContain('samara@fluair.com.br');
    expect(transformed).not.toContain('function criarUsuario()');
    expect(transformed).not.toContain('function salvarEdicao()');
    expect(transformed).toContain('id="users-create-form"');
    expect(transformed).toContain('id="modal-status-usuario"');
    expect(transformed).toContain('id="customers-body"');
    expect(transformed).toContain('id="customer-form-modal"');
    expect(transformed).toContain('.customers-table{width:100%;table-layout:auto;font-size:10px}');
    expect(transformed).toContain('.customers-table th,.customers-table td{padding-inline:14px;');
    expect(transformed).not.toMatch(/\.customers-table th:nth-child\(\d+\)\{width:/);
    expect(transformed).toContain('href="/clientes"');
    expect(transformed).toContain('href="/listas"');
    expect(transformed).toContain('id="price-lists-content"');
    expect(transformed).toContain('id="calc-matrices-open"');
    expect(transformed).toContain('id="calc-gear-status"');
    const productsStart = transformed.indexOf('id="s-produtos"');
    const productsEnd = transformed.indexOf('id="products-photo-modal"');
    const productsScreen = transformed.slice(productsStart, productsEnd);
    expect(productsScreen).toContain('<th>Foto</th><th>Tipo</th>');
    expect(productsScreen).toContain('id="products-filter"');
    expect(productsScreen).toContain('Catálogo de produtos');
    expect(transformed).toContain('id="products-photo-modal"');
    expect(transformed).toContain('id="products-composition-modal"');
    expect(transformed).toContain(
      '.calc-photo-preview img{box-sizing:border-box;padding:8px;object-position:center}',
    );
    expect(transformed).toContain(
      '.products-photo-preview-image{box-sizing:border-box;padding:8px;object-position:center}',
    );
    expect(transformed).toContain('.media-image{background:#fff}');
    expect(productsScreen).toContain('<th>Origem</th>');
    expect(productsScreen).toContain('<th>Referência</th>');
    expect(transformedSearch).toContain('id="bsh-reference"');
    expect(transformed).not.toContain('Novo cálculo de preço');
    expect(transformed).not.toContain('Matriz 1 — Implementador');
    expect(transformed).toContain(
      'href="/comissoes" data-screen="comissoes" data-permissions="commission.access"',
    );

    const normalizedOriginal = original.replace(/\r\n/g, '\n');
    const legacyStartMarker = '     TELA DETALHE: KIT — via Busca';
    const originalLegacyStart = normalizedOriginal.indexOf(legacyStartMarker);
    const transformedLegacyStart = transformed.indexOf(legacyStartMarker);
    const originalUsersStart = normalizedOriginal.indexOf('     TELA 6: USUÁRIOS');
    const originalUsersCommentStart = normalizedOriginal.lastIndexOf('<!--', originalUsersStart);
    const transformedCustomersStart = transformed.indexOf('<!-- CLIENTES INTEGRADOS À API -->');
    const transformedUsersStart = transformed.indexOf('<!-- USUÁRIOS INTEGRADOS À API -->');
    expect(originalLegacyStart).toBeGreaterThan(-1);
    expect(transformedLegacyStart).toBeGreaterThan(-1);
    expect(originalUsersStart).toBeGreaterThan(originalLegacyStart);
    expect(originalUsersCommentStart).toBeGreaterThan(originalLegacyStart);
    expect(transformedCustomersStart).toBeGreaterThan(transformedLegacyStart);
    expect(transformedUsersStart).toBeGreaterThan(transformedLegacyStart);
    expect(transformed.slice(transformedLegacyStart, transformedCustomersStart)).toContain(
      'id="s-pedido"',
    );
  });
});

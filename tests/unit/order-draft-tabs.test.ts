import { describe, expect, it } from 'vitest';

import { customerDraftLabel } from '../../src/web/order-draft-tabs.js';

describe('rótulo das abas de pedidos', () => {
  it('exibe o código e o primeiro nome do cliente', () => {
    expect(customerDraftLabel('CLI-1042', 'Comercial Figueiredo Equipamentos Ltda.')).toBe(
      'CLI-1042 · Comercial',
    );
  });

  it('ignora números e espaços antes do primeiro nome com letras', () => {
    expect(customerDraftLabel('25', '  001  4092   Maria   da Silva  ')).toBe('25 · Maria');
  });

  it('exibe somente o código quando o cadastro não possui uma palavra com letras', () => {
    expect(customerDraftLabel('25', '001 4092')).toBe('25');
  });
});

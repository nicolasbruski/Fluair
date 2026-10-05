import { describe, expect, it } from 'vitest';

import { OrderEmailRenderer } from '../../src/server/modules/email/order-email-renderer.js';

describe('OrderEmailRenderer', () => {
  it('escapa conteudo variavel no HTML e preserva os dados essenciais no texto', () => {
    const rendered = new OrderEmailRenderer().render({
      number: 'PED-2026-000001',
      submittedAt: new Date('2026-09-29T18:00:00.000Z'),
      customer: { code: 'CLI-1', name: '<script>cliente</script>', city: 'Curitiba', state: 'PR' },
      creator: { name: 'Ana & Cia', email: 'ana@example.com' },
      note: '<img src=x onerror=alert(1)>\nLinha 2',
      totalQuantity: '2.0000',
      totalAmount: '1234.5000',
      items: [
        {
          code: 'P-1',
          description: '<b>Produto</b>',
          reference: 'REF&1',
          quantity: '2.0000',
          unit: 'UN',
          negotiatedUnitPrice: '617.2500',
          subtotal: '1234.5000',
        },
      ],
    });

    expect(rendered.subject).not.toContain('\n');
    expect(rendered.html).toContain('&lt;script&gt;cliente&lt;/script&gt;');
    expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('javascript:');
    expect(rendered.text).toContain('PED-2026-000001');
    expect(rendered.text).toContain('P-1 | <b>Produto</b>');
    expect(rendered.text).toContain('Data: 29/09/2026 as 15:00h');
    expect(rendered.text).toContain('P-1 | <b>Produto</b> | 2 UN | R$ 617,25 | R$ 1.234,50');
    expect(rendered.text).toContain('Quantidade total: 2');
    expect(rendered.text).toContain('Total: R$ 1.234,50');
    expect(rendered.html).not.toMatch(/<img|<script|attachment/i);
  });

  it('converte a data UTC para o horario de Sao Paulo', () => {
    const rendered = new OrderEmailRenderer().render({
      number: 'PED-2026-000002',
      submittedAt: new Date('2026-10-02T15:14:37.148Z'),
      customer: { code: 'CLI-2', name: 'Cliente', city: null, state: null },
      creator: { name: 'Ana', email: 'ana@example.com' },
      note: null,
      totalQuantity: '1.5000',
      totalAmount: '277.0000',
      items: [
        {
          code: 'P-2',
          description: 'Produto',
          reference: null,
          quantity: '1.5000',
          unit: null,
          negotiatedUnitPrice: '135.0000',
          subtotal: '202.5000',
        },
      ],
    });

    expect(rendered.text).toContain('Data: 02/10/2026 as 12:14h');
    expect(rendered.text).toContain('P-2 | Produto | 1,5 | R$ 135,00 | R$ 202,50');
    expect(rendered.text).toContain('Quantidade total: 1,5');
    expect(rendered.text).toContain('Total: R$ 277,00');
  });
});

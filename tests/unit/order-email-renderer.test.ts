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
          referenceUnitPrice: '650.0000',
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
    expect(rendered.text).toContain(
      'P-1 | <b>Produto</b> | 2 UN | Valor de referência: R$ 650,00 | Preço unitário: R$ 617,25 | Preço com impostos: R$ 617,25 | Subtotal: R$ 1.234,50',
    );
    expect(rendered.text).toContain('Total de itens: 2');
    expect(rendered.text).toContain('Valor Total: R$ 1.234,50');
    expect(rendered.html).not.toContain('Quantidade total:');
    expect(rendered.html).toMatch(
      /<tbody>[\s\S]*<tr>[\s\S]*<td colspan="5"[\s\S]*<td[^>]*><strong>Total de itens:<\/strong> 2<\/td>[\s\S]*<td[^>]*><strong>Valor Total:<\/strong><br><span[^>]*font-size:18px[^>]*>R\$ 1\.234,50<\/span><\/td>[\s\S]*<\/tr><\/tbody>/,
    );
    expect(rendered.html).not.toMatch(/<\/table>\s*<p><strong>Total de itens:/);
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
          referenceUnitPrice: '135.0000',
          negotiatedUnitPrice: '135.0000',
          subtotal: '202.5000',
        },
      ],
    });

    expect(rendered.text).toContain('Data: 02/10/2026 as 12:14h');
    expect(rendered.text).toContain(
      'P-2 | Produto | 1,5 | Valor de referência: R$ 135,00 | Preço unitário: R$ 135,00 | Preço com impostos: R$ 135,00 | Subtotal: R$ 202,50',
    );
    expect(rendered.text).toContain('Total de itens: 1,5');
    expect(rendered.text).toContain('Valor Total: R$ 277,00');
  });

  it('separa o preço-base do valor com impostos sem exibir o detalhamento tributário', () => {
    const rendered = new OrderEmailRenderer().render({
      number: 'PED-2026-000003',
      submittedAt: new Date('2026-10-07T12:00:00.000Z'),
      customer: { code: 'CLI-3', name: 'Cliente', city: null, state: null },
      creator: { name: 'Ana', email: 'ana@example.com' },
      note: null,
      totalQuantity: '1.0000',
      totalAmount: '118.5000',
      items: [
        {
          code: 'P-3',
          description: 'Produto tributado',
          reference: null,
          quantity: '1.0000',
          unit: 'UN',
          referenceUnitPrice: '110.0000',
          negotiatedUnitPrice: '100.0000',
          finalUnitPrice: '118.5000',
          taxes: {
            pis: { selected: true, rate: '1.6500', unitAmount: '1.6500' },
            cofins: { selected: true, rate: '7.6000', unitAmount: '7.6000' },
            icms: { selected: false, rate: '18.0000', unitAmount: '0.0000' },
            ipi: { selected: true, rate: '9.2500', unitAmount: '9.2500' },
            totalUnitAmount: '18.5000',
          },
          subtotal: '118.5000',
        },
      ],
    });

    expect(rendered.html).toContain('Preço unitário');
    expect(rendered.html).toContain('Valor de referência');
    expect(rendered.html).toContain('R$ 110,00');
    expect(rendered.html).toContain('Preço com impostos');
    expect(rendered.html).toContain('R$ 100,00');
    expect(rendered.html).toContain('R$ 118,50');
    expect(rendered.html).not.toContain('PIS');
    expect(rendered.html).not.toContain('COFINS');
    expect(rendered.html).not.toContain('IPI');
    expect(rendered.html).not.toContain('1.6500%');
    expect(rendered.text).toContain('Preço unitário: R$ 100,00');
    expect(rendered.text).toContain('Valor de referência: R$ 110,00');
    expect(rendered.text).toContain('Preço com impostos: R$ 118,50');
    expect(rendered.text).not.toContain('PIS');
  });
});

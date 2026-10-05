export const ORDER_EMAIL_TEMPLATE_VERSION = 'order-v1';

export interface OrderEmailRenderInput {
  number: string;
  submittedAt: Date;
  customer: { code: string; name: string; city: string | null; state: string | null };
  creator: { name: string; email: string };
  note: string | null;
  totalQuantity: string;
  totalAmount: string;
  items: Array<{
    code: string;
    description: string;
    reference: string | null;
    quantity: string;
    unit: string | null;
    negotiatedUnitPrice: string;
    subtotal: string;
  }>;
}

export interface RenderedOrderEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanText(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('')
    .trim();
}

function cleanHeader(value: string): string {
  return cleanText(value)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 180);
}

function formatQuantity(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const significantFraction = fraction.replace(/0+$/, '');
  return `${grouped}${significantFraction ? `,${significantFraction}` : ''}`;
}

function formatMoney(value: string): string {
  return `R$ ${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} as ${part('hour')}:${part('minute')}h`;
}

export class OrderEmailRenderer {
  readonly version = ORDER_EMAIL_TEMPLATE_VERSION;

  render(input: OrderEmailRenderInput): RenderedOrderEmail {
    const subject = cleanHeader(`Pedido ${input.number} - ${input.customer.name}`);
    const rows = input.items
      .map(
        (item) => `<tr>
<td style="padding:8px;border:1px solid #d7dde5">${escapeHtml(cleanText(item.code))}</td>
<td style="padding:8px;border:1px solid #d7dde5">${escapeHtml(cleanText(item.description))}${item.reference ? `<br><small>${escapeHtml(cleanText(item.reference))}</small>` : ''}</td>
<td style="padding:8px;border:1px solid #d7dde5;text-align:right">${escapeHtml(formatQuantity(item.quantity))}${item.unit ? ` ${escapeHtml(cleanText(item.unit))}` : ''}</td>
<td style="padding:8px;border:1px solid #d7dde5;text-align:right">${escapeHtml(formatMoney(item.negotiatedUnitPrice))}</td>
<td style="padding:8px;border:1px solid #d7dde5;text-align:right">${escapeHtml(formatMoney(item.subtotal))}</td>
</tr>`,
      )
      .join('');
    const location = [input.customer.city, input.customer.state].filter(Boolean).join(' / ');
    const note = input.note ? cleanText(input.note) : 'Sem observacao.';
    const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#182230">
<main style="max-width:760px;margin:auto"><h1 style="font-size:22px">Pedido ${escapeHtml(input.number)}</h1>
<p><strong>Cliente:</strong> ${escapeHtml(cleanText(input.customer.code))} - ${escapeHtml(cleanText(input.customer.name))}${location ? `<br><strong>Local:</strong> ${escapeHtml(cleanText(location))}` : ''}</p>
<p><strong>Emissor:</strong> ${escapeHtml(cleanText(input.creator.name))} (${escapeHtml(cleanText(input.creator.email))})<br><strong>Data:</strong> ${escapeHtml(formatDateTime(input.submittedAt))}</p>
<table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;border:1px solid #d7dde5">Codigo</th><th style="padding:8px;border:1px solid #d7dde5">Descricao</th><th style="padding:8px;border:1px solid #d7dde5">Quantidade</th><th style="padding:8px;border:1px solid #d7dde5">Preco</th><th style="padding:8px;border:1px solid #d7dde5">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
<p><strong>Quantidade total:</strong> ${escapeHtml(formatQuantity(input.totalQuantity))}<br><strong>Total:</strong> ${escapeHtml(formatMoney(input.totalAmount))}</p>
<p><strong>Observacao:</strong><br>${escapeHtml(note).replaceAll('\n', '<br>')}</p></main></body></html>`;
    const itemLines = input.items.map(
      (item) =>
        `- ${cleanText(item.code)} | ${cleanText(item.description)} | ${formatQuantity(item.quantity)}${item.unit ? ` ${cleanText(item.unit)}` : ''} | ${formatMoney(item.negotiatedUnitPrice)} | ${formatMoney(item.subtotal)}`,
    );
    const text = [
      `Pedido ${input.number}`,
      `Cliente: ${cleanText(input.customer.code)} - ${cleanText(input.customer.name)}`,
      ...(location ? [`Local: ${cleanText(location)}`] : []),
      `Emissor: ${cleanText(input.creator.name)} (${cleanText(input.creator.email)})`,
      `Data: ${formatDateTime(input.submittedAt)}`,
      '',
      'Itens:',
      ...itemLines,
      '',
      `Quantidade total: ${formatQuantity(input.totalQuantity)}`,
      `Total: ${formatMoney(input.totalAmount)}`,
      `Observacao: ${note}`,
    ].join('\n');
    return { subject, html, text };
  }
}

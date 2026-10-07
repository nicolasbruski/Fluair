export interface OrderMoneyLine {
  price: number;
  taxRate?: number | undefined;
  taxes?:
    | {
    pis: { selected: boolean; rate: number };
    cofins: { selected: boolean; rate: number };
    icms: { selected: boolean; rate: number };
    ipi: { selected: boolean; rate: number };
      }
    | undefined;
  quantity: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function orderTaxUnitAmount(
  line: Pick<OrderMoneyLine, 'price'> & Partial<Pick<OrderMoneyLine, 'taxes' | 'taxRate'>>,
): number {
  if (!line.taxes) return 0;
  const rate = Object.values(line.taxes).reduce(
    (total, tax) => total + (tax.selected ? tax.rate : 0),
    0,
  );
  return money((line.price * rate) / 100);
}

export function orderUnitAmount(
  line: Pick<OrderMoneyLine, 'price'> & Partial<Pick<OrderMoneyLine, 'taxes' | 'taxRate'>>,
): number {
  return money(line.price + orderTaxUnitAmount(line));
}

export function orderLineAmount(line: OrderMoneyLine): number {
  return money(orderUnitAmount(line) * line.quantity);
}

export function orderAmount(lines: OrderMoneyLine[]): number {
  return money(lines.reduce((total, line) => total + orderLineAmount(line), 0));
}

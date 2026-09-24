export interface OrderMoneyLine {
  price: number;
  taxRate: number;
  quantity: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function orderUnitAmount(line: Pick<OrderMoneyLine, 'price' | 'taxRate'>): number {
  return money(line.price);
}

export function orderLineAmount(line: OrderMoneyLine): number {
  return money(orderUnitAmount(line) * line.quantity);
}

export function orderAmount(lines: OrderMoneyLine[]): number {
  return money(lines.reduce((total, line) => total + orderLineAmount(line), 0));
}

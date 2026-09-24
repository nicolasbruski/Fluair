export interface OrderQuantityLine {
  quantity: number;
}

/** Single quantity definition shared by browser flows and server-side order validation. */
export function orderTotalQuantity(lines: readonly OrderQuantityLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function isOrderQuantityInRange(
  totalQuantity: number,
  minimumQuantity: number | null,
  maximumQuantity: number | null,
): boolean {
  return (
    (minimumQuantity === null || totalQuantity >= minimumQuantity) &&
    (maximumQuantity === null || totalQuantity <= maximumQuantity)
  );
}

export function customerDraftLabel(customerCode: string, customerName: string): string {
  const firstName = customerName
    .trim()
    .split(/\s+/)
    .find((part) => /\p{L}/u.test(part));
  return firstName ? `${customerCode} · ${firstName}` : customerCode;
}

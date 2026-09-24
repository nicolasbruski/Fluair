export function descriptionWithoutUser(value: string): string {
  return value.replace(/\s+usu[aá]rio\s*:\s*.*$/isu, '').trim();
}

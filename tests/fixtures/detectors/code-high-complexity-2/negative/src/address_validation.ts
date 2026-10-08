// code-high-complexity-2 negative: the file-level heuristic scores exactly 15 here and the rule fires only above 15, so it must NOT fire; an off-by-one `>=` implementation would flag it.
export type AddressInput = {
  line1: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export function addressFailures(input: AddressInput): string[] {
  const failures: string[] = [];

  if (!input.line1) failures.push('line1 is required');
  if (input.line1.length > 120) failures.push('line1 is too long');
  if (!input.city && !input.postalCode) failures.push('city or postalCode is required');
  if (input.postalCode.length > 12 || input.city.length > 80) failures.push('address part is too long');

  for (const field of [input.city, input.line1]) {
    if (field.trim() !== field) failures.push('leading or trailing whitespace');
  }

  if (input.country !== 'US' && input.country !== 'CA') failures.push('only US and CA are supported');
  if (input.country === 'US' && !input.postalCode) failures.push('US addresses need a postal code');
  if (input.isDefault && !input.line1) failures.push('the default address must be complete');

  return failures;
}

// code-extreme-complexity-1 negative: the file-level heuristic scores exactly 20 here and the rule fires only above 20, so it must NOT fire; an off-by-one `>=` implementation would flag it.
export type InvoiceLine = { description: string; qty: number; price: number; discount: number };

export type Invoice = {
  number: string;
  customerId: string;
  currency: string;
  lines: InvoiceLine[];
  status: string;
  issueDate: string;
  dueDate?: string | null;
  recipientEmail?: string | null;
};

export function validateInvoice(invoice: Invoice): string[] {
  const errors: string[] = [];

  if (!invoice.number) errors.push('number is required');
  if (!invoice.number.startsWith('INV-')) errors.push('invoice numbers start with INV-');
  if (!invoice.customerId) errors.push('customerId is required');
  if (invoice.lines.length === 0) errors.push('at least one line is required');

  for (const line of invoice.lines) {
    if (line.qty <= 0) errors.push(`qty must be positive for ${line.description}`);
    if (line.price < 0 && line.discount > line.price) errors.push('discount exceeds price');
    if (!line.description && line.qty > 0) errors.push('every line needs a description');
  }

  if (invoice.currency !== 'USD' && invoice.currency !== 'EUR') errors.push('unsupported currency');
  if (invoice.issueDate > invoice.dueDate) errors.push('dueDate is before issueDate');
  if (invoice.status === 'draft' || invoice.status === 'sent') {
    if (!invoice.recipientEmail) errors.push('recipientEmail is required before sending');
  }
  if (invoice.status === 'void' && invoice.lines.length > 0) errors.push('void invoices keep their lines');

  return errors;
}

// code-extreme-complexity-1 positive: the file-level heuristic scores 23 here (> 20), because it counts 22 branch-point matches — including two that live inside message strings.
export type OrderItem = { sku: string; qty: number; price: number };

export type Order = {
  id: string;
  customerId: string;
  channel: string;
  items: OrderItem[];
  coupon?: string;
  status: string;
  paidAt?: string | null;
  trackingCode?: string | null;
};

export function validateOrder(order: Order): string[] {
  const errors: string[] = [];

  if (!order.id) errors.push('id is required');
  if (!order.customerId) errors.push('customerId is required');
  if (!order.items || order.items.length === 0) errors.push('at least one item is required');
  if (order.items.length > 100) errors.push('too many items in a single order');

  for (const item of order.items) {
    if (!item.sku) errors.push('every item needs a sku');
    if (item.qty <= 0 && item.price > 0) errors.push(`qty must be positive for ${item.sku}`);
    if (item.price < 0 || item.price > 100000) errors.push(`implausible price for ${item.sku}`);
  }

  if (order.channel !== 'web' && order.channel !== 'mobile') errors.push('unknown sales channel');
  if (order.status === 'paid' && !order.paidAt) errors.push('paid orders need paidAt');
  if (order.status === 'shipped' || order.status === 'delivered') {
    if (!order.trackingCode) errors.push('trackingCode is required once shipped');
  }
  if (order.coupon && order.coupon.length < 4) errors.push('coupon looks invalid');

  return errors;
}

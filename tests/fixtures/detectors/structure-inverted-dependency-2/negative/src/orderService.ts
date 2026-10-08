// structure-inverted-dependency-2 negative: the controller is named only in a comment, never imported or required, so it must NOT fire; a naive unanchored `Controller` grep over *Service.* files would flag it.
import { orderTotals } from './totals';
import type { Order } from './types';

// OrderService must never depend on OrderController: URLs come from configuration, not from the web layer.
export class OrderService {
  constructor(private readonly baseUrl: string) {}

  receiptUrl(orderId: string): string {
    return `${this.baseUrl}/orders/${orderId}/receipt`;
  }

  summarize(orders: Order[]): number {
    return orderTotals(orders);
  }
}

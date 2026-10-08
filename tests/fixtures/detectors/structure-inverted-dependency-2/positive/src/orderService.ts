// structure-inverted-dependency-2 positive: a service importing a controller inverts the dependency direction, so this file MUST fire.
import { OrderController } from './OrderController';
import { orderTotals } from './totals';

export class OrderService {
  constructor(private readonly controller: OrderController) {}

  receiptUrl(orderId: string): string {
    return `${this.controller.baseUrl()}/orders/${orderId}/receipt`;
  }

  summarize(orders: { total: number }[]): number {
    return orderTotals(orders);
  }
}

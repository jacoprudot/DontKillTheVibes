// structure-layer-violation-1 positive: the controller reaches past the service layer into the repository, so this file MUST fire.
import { OrderRepository } from './OrderRepository';
import { orderToDto } from './dto';

export class OrderController {
  constructor(private readonly orders: OrderRepository) {}

  async show(id: string) {
    const order = await this.orders.findById(id);
    return orderToDto(order);
  }
}

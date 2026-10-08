// structure-layer-violation-1 negative: the repository is named only in a comment and every read goes through the service, so it must NOT fire; a naive unanchored `Repositor(y|ies)` grep over *Controller.* files would flag it.
import { orderService } from './orderService';

// This controller never touches OrderRepository directly: every read goes through the service layer.
export class OrderController {
  async show(id: string) {
    return orderService.getOrderById(id);
  }
}

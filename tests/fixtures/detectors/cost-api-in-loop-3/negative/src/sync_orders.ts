// cost-api-in-loop-3 negative: the loop reads from the local repository and the one external call is batched outside any loop, so it must NOT fire; a naive `fetch`-near-`for` (or `fetch`-anywhere) scan would flag it.
const API_URL = process.env.API_URL ?? 'https://api.example.com';

type Order = { id: string; sku: string };

export async function syncOrderStatuses(orderIds: string[], repo: { fetchOrder(id: string): Promise<Order> }) {
  const orders: Order[] = [];

  for (const id of orderIds) {
    const order = await repo.fetchOrder(id);
    orders.push(order);
  }

  const res = await fetch(`${API_URL}/orders/statuses?ids=${orderIds.join(',')}`);
  const statuses = await res.json();
  return orders.map((order) => ({ ...order, status: statuses[order.id] }));
}

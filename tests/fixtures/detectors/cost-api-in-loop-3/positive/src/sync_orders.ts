// cost-api-in-loop-3 positive: the loop performs one HTTP request per order, so this file MUST fire.
const API_URL = process.env.API_URL ?? 'https://api.example.com';

export async function syncOrderStatuses(orderIds: string[]) {
  const updated: string[] = [];

  for (const id of orderIds) {
    const res = await fetch(`${API_URL}/orders/${id}`);
    const order = await res.json();
    updated.push(order.status);
  }

  return updated;
}

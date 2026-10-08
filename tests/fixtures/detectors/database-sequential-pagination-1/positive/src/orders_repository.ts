// database-sequential-pagination-1 positive: count() and findMany() are awaited one after the other, so this file MUST fire.
import { prisma } from './prisma';

const PAGE_SIZE = 25;

export async function listOrders(page: number, status?: string) {
  const where = status ? { status } : {};
  const total = await prisma.order.count({ where });
  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { rows, total, pages: Math.ceil(total / PAGE_SIZE) };
}

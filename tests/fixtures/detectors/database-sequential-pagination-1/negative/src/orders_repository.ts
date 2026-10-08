// database-sequential-pagination-1 negative: both queries run concurrently inside Promise.all, so it must NOT fire; a naive order-insensitive `count` + `findMany` co-occurrence scan would flag it.
import { prisma } from './prisma';

const PAGE_SIZE = 25;

export async function listOrders(page: number, status?: string) {
  const where = status ? { status } : {};

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return { rows, total, pages: Math.ceil(total / PAGE_SIZE) };
}

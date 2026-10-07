import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  OrderDraftPayloadCommand,
  OrderDraftSaveCommand,
  OrderDraftSwapCommand,
} from './orders.schemas.js';

const maximumDraftsPerUser = 5;

const draftSelection = {
  id: true,
  customerId: true,
  payload: true,
  revision: true,
  updatedAt: true,
  customer: {
    select: { id: true, code: true, legalName: true, active: true },
  },
} satisfies Prisma.OrderDraftSelect;

export type StoredOrderDraft = Prisma.OrderDraftGetPayload<{ select: typeof draftSelection }>;

export interface DraftMutationResult {
  draft: StoredOrderDraft;
  drafts: StoredOrderDraft[];
  evicted: StoredOrderDraft | null;
}

export interface DraftSwapResult {
  restored: StoredOrderDraft | null;
  drafts: StoredOrderDraft[];
  evicted: StoredOrderDraft | null;
}

export interface OrderDraftsRepository {
  findForUser(userId: string): Promise<StoredOrderDraft[]>;
  save(userId: string, command: OrderDraftSaveCommand): Promise<DraftMutationResult>;
  swap(userId: string, command: OrderDraftSwapCommand): Promise<DraftSwapResult>;
  deleteForUser(userId: string, customerId?: string): Promise<boolean>;
}

function jsonPayload(payload: OrderDraftPayloadCommand): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

async function lockUser(transaction: Prisma.TransactionClient, userId: string): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
}

async function listDrafts(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<StoredOrderDraft[]> {
  return transaction.orderDraft.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: maximumDraftsPerUser,
    select: draftSelection,
  });
}

async function pruneDrafts(
  transaction: Prisma.TransactionClient,
  userId: string,
  protectedCustomerIds: string[],
): Promise<StoredOrderDraft | null> {
  const count = await transaction.orderDraft.count({ where: { userId } });
  if (count <= maximumDraftsPerUser) return null;

  const evicted = await transaction.orderDraft.findFirst({
    where: { userId, customerId: { notIn: protectedCustomerIds } },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    select: draftSelection,
  });
  if (!evicted) return null;
  await transaction.orderDraft.delete({ where: { id: evicted.id } });
  return evicted;
}

export class PrismaOrderDraftsRepository implements OrderDraftsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findForUser(userId: string): Promise<StoredOrderDraft[]> {
    return this.prisma.orderDraft.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: maximumDraftsPerUser,
      select: draftSelection,
    });
  }

  async save(userId: string, command: OrderDraftSaveCommand): Promise<DraftMutationResult> {
    return this.prisma.$transaction(async (transaction) => {
      await lockUser(transaction, userId);
      const draft = await transaction.orderDraft.upsert({
        where: { userId_customerId: { userId, customerId: command.customerId } },
        create: {
          id: randomUUID(),
          userId,
          customerId: command.customerId,
          payload: jsonPayload(command.payload),
          revision: 1,
        },
        update: {
          payload: jsonPayload(command.payload),
          revision: { increment: 1 },
        },
        select: draftSelection,
      });
      const evicted = await pruneDrafts(transaction, userId, [command.customerId]);
      return { draft, drafts: await listDrafts(transaction, userId), evicted };
    });
  }

  async swap(userId: string, command: OrderDraftSwapCommand): Promise<DraftSwapResult> {
    return this.prisma.$transaction(async (transaction) => {
      await lockUser(transaction, userId);
      const restored = await transaction.orderDraft.findUnique({
        where: { userId_customerId: { userId, customerId: command.targetCustomerId } },
        select: draftSelection,
      });

      if (command.current) {
        await transaction.orderDraft.upsert({
          where: {
            userId_customerId: { userId, customerId: command.current.customerId },
          },
          create: {
            id: randomUUID(),
            userId,
            customerId: command.current.customerId,
            payload: jsonPayload(command.current.payload),
            revision: 1,
          },
          update: {
            payload: jsonPayload(command.current.payload),
            revision: { increment: 1 },
          },
        });
      }

      const protectedCustomers = [command.targetCustomerId];
      if (command.current) protectedCustomers.push(command.current.customerId);
      const evicted = await pruneDrafts(transaction, userId, protectedCustomers);
      return { restored, drafts: await listDrafts(transaction, userId), evicted };
    });
  }

  async deleteForUser(userId: string, customerId?: string): Promise<boolean> {
    const result = await this.prisma.orderDraft.deleteMany({
      where: { userId, ...(customerId ? { customerId } : {}) },
    });
    return result.count > 0;
  }
}

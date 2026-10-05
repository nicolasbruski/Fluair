import { randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';

import type {
  OrderDraftPayloadCommand,
  OrderDraftSaveCommand,
  OrderDraftSwapCommand,
} from './orders.schemas.js';

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

export interface OrderDraftsRepository {
  findForUser(userId: string): Promise<StoredOrderDraft | null>;
  save(userId: string, command: OrderDraftSaveCommand): Promise<StoredOrderDraft>;
  swap(
    userId: string,
    command: OrderDraftSwapCommand,
  ): Promise<{ restored: StoredOrderDraft | null; draft: StoredOrderDraft | null }>;
  deleteForUser(userId: string, customerId?: string): Promise<boolean>;
}

function jsonPayload(payload: OrderDraftPayloadCommand): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

export class PrismaOrderDraftsRepository implements OrderDraftsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findForUser(userId: string): Promise<StoredOrderDraft | null> {
    return this.prisma.orderDraft.findUnique({ where: { userId }, select: draftSelection });
  }

  async save(userId: string, command: OrderDraftSaveCommand): Promise<StoredOrderDraft> {
    return this.prisma.orderDraft.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        customerId: command.customerId,
        payload: jsonPayload(command.payload),
        revision: 1,
      },
      update: {
        customerId: command.customerId,
        payload: jsonPayload(command.payload),
        revision: { increment: 1 },
      },
      select: draftSelection,
    });
  }

  async swap(
    userId: string,
    command: OrderDraftSwapCommand,
  ): Promise<{ restored: StoredOrderDraft | null; draft: StoredOrderDraft | null }> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.orderDraft.findUnique({
        where: { userId },
        select: draftSelection,
      });
      const restored = existing?.customerId === command.targetCustomerId ? existing : null;

      if (command.current) {
        await transaction.orderDraft.upsert({
          where: { userId },
          create: {
            id: randomUUID(),
            userId,
            customerId: command.current.customerId,
            payload: jsonPayload(command.current.payload),
            revision: 1,
          },
          update: {
            customerId: command.current.customerId,
            payload: jsonPayload(command.current.payload),
            revision: { increment: 1 },
          },
        });
      }

      const draft = await transaction.orderDraft.findUnique({
        where: { userId },
        select: draftSelection,
      });
      return { restored, draft };
    });
  }

  async deleteForUser(userId: string, customerId?: string): Promise<boolean> {
    const result = await this.prisma.orderDraft.deleteMany({
      where: { userId, ...(customerId ? { customerId } : {}) },
    });
    return result.count > 0;
  }
}

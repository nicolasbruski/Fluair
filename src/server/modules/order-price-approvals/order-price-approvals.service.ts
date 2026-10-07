import type { Logger } from 'pino';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import type {
  CreatedOrderPriceApprovalEnvelope,
  CreateOrderPriceApprovalSnapshot,
  AdminOrderPriceApprovalDetail,
  AdminOrderPriceApprovalSummary,
  MyOrderPriceApprovalDetail,
  MyOrderPriceApprovalSummary,
  OrderPriceApprovalDetailEnvelope,
  OrderPriceApprovalCreateResult,
  OrderPriceApprovalListEnvelope,
  OrderPriceApprovalCountEnvelope,
} from '../../../shared/order-price-approvals.js';
import { orderPriceApprovalSummary } from '../../../shared/order-price-approvals.js';
import { AppError } from '../../errors/app-error.js';
import {
  approvalContentFromQuote,
  hashOrderPriceApprovalContent,
} from './order-price-approval-content.js';
import type {
  OrderPriceApprovalRepositoryContext,
  OrderPriceApprovalsRepository,
} from './order-price-approvals.repository.js';
import {
  OrderPriceApprovalIdempotencyConflictError,
  OrderPriceApprovalSupersedeConflictError,
} from './order-price-approvals.repository.js';
import type {
  CancelOrderPriceApprovalCommand,
  CreateOrderPriceApprovalCommand,
  MyOrderPriceApprovalsQuery,
  AdminOrderPriceApprovalsQuery,
  ApproveOrderPriceApprovalCommand,
  RejectOrderPriceApprovalCommand,
} from './order-price-approvals.schemas.js';
import type { OrdersService } from '../orders/orders.service.js';
import { canReviewOrderPriceApproval } from './order-price-approval-state.js';

export class OrderPriceApprovalNotRequiredError extends Error {
  readonly code = 'ORDER_PRICE_APPROVAL_NOT_REQUIRED';

  constructor() {
    super('O carrinho não possui preço abaixo do mínimo e não exige aprovação.');
    this.name = 'OrderPriceApprovalNotRequiredError';
  }
}

export class OrderPriceApprovalsService {
  private readonly clock: { now(): Date };
  private readonly approvalValidityDays: number;
  private readonly logger: Logger | undefined;

  constructor(
    private readonly repository: OrderPriceApprovalsRepository,
    private readonly orders?: OrdersService,
    dependencies: {
      clock?: { now(): Date };
      approvalValidityDays?: number;
      logger?: Logger;
    } = {},
  ) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
    this.approvalValidityDays = dependencies.approvalValidityDays ?? 7;
    this.logger = dependencies.logger;
  }

  async persistResolvedSnapshot(
    input: CreateOrderPriceApprovalSnapshot,
    context: OrderPriceApprovalRepositoryContext,
  ): Promise<OrderPriceApprovalCreateResult> {
    if (!input.items.some((item) => item.requiresApproval)) {
      throw new OrderPriceApprovalNotRequiredError();
    }
    return this.repository.create(input, context);
  }

  async create(
    command: CreateOrderPriceApprovalCommand,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<CreatedOrderPriceApprovalEnvelope> {
    if (!this.orders) throw new Error('OrdersService não configurado para aprovações.');
    const quote = await this.orders.quote(
      { customerId: command.customerId, lines: command.lines },
      actor,
    );
    if (!quote.data.approval.required) {
      const error = new OrderPriceApprovalNotRequiredError();
      throw new AppError(422, error.code, error.message);
    }

    const { content, exceptionAmount } = approvalContentFromQuote(quote.data, actor.id);
    const items = content.items;
    const totalQuantity = content.totalQuantity;
    const requestedTotalAmount = content.requestedTotalAmount;
    const hashed = hashOrderPriceApprovalContent(content);
    const snapshot: CreateOrderPriceApprovalSnapshot = {
      idempotencyKey,
      contentHash: hashed.hash,
      hashVersion: hashed.version,
      requester: { id: actor.id, name: actor.name, email: actor.email.trim().toLowerCase() },
      customer: {
        id: quote.data.customer.id,
        code: quote.data.customer.code,
        legalName: quote.data.customer.legalName,
        customerClass: quote.data.customer.customerClass,
        customerSegment: quote.data.customer.customerSegment,
      },
      justification: command.justification,
      totalQuantity,
      minimumTotalAmount: content.minimumTotalAmount,
      requestedTotalAmount,
      exceptionAmount,
      items,
      ...(command.supersedesRequestId ? { supersedesRequestId: command.supersedesRequestId } : {}),
    };
    try {
      const result = await this.persistResolvedSnapshot(snapshot, { requestId });
      return {
        data: {
          approval: orderPriceApprovalSummary(result.approval),
          violations: quote.data.approval.violations,
          replayed: result.replayed,
        },
      };
    } catch (error) {
      if (error instanceof OrderPriceApprovalNotRequiredError) {
        throw new AppError(422, error.code, error.message);
      }
      if (error instanceof OrderPriceApprovalIdempotencyConflictError) {
        throw new AppError(409, error.code, error.message);
      }
      if (error instanceof OrderPriceApprovalSupersedeConflictError) {
        throw new AppError(409, error.code, error.message);
      }
      throw error;
    }
  }

  async mine(
    query: MyOrderPriceApprovalsQuery,
    actor: AuthenticatedUser,
    requestId = 'internal-read',
  ): Promise<OrderPriceApprovalListEnvelope<MyOrderPriceApprovalSummary>> {
    await this.expire({ requestId, requesterId: actor.id });
    return this.repository.listOwned({
      requesterId: actor.id,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {}),
      ...(query.requestedFrom ? { requestedFrom: query.requestedFrom } : {}),
    });
  }

  async ownDetails(
    id: string,
    actor: AuthenticatedUser,
    requestId = 'internal-read',
  ): Promise<OrderPriceApprovalDetailEnvelope<MyOrderPriceApprovalDetail>> {
    await this.expire({ id, requestId, requesterId: actor.id });
    const approval = await this.repository.findOwnedById(id, actor.id);
    if (!approval) {
      throw new AppError(404, 'ORDER_PRICE_APPROVAL_NOT_FOUND', 'Solicitação não encontrada.');
    }
    return { data: approval };
  }

  async cancel(
    id: string,
    command: CancelOrderPriceApprovalCommand,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<OrderPriceApprovalDetailEnvelope<MyOrderPriceApprovalDetail>> {
    const current = await this.repository.findOwnedById(id, actor.id);
    if (!current) {
      throw new AppError(404, 'ORDER_PRICE_APPROVAL_NOT_FOUND', 'Solicitação não encontrada.');
    }
    if (current.status !== 'PENDING' || current.version !== command.expectedVersion) {
      throw new AppError(
        409,
        'ORDER_PRICE_APPROVAL_NOT_PENDING',
        'A solicitação não está mais pendente ou foi atualizada.',
      );
    }
    const cancelled = await this.repository.cancelOwned({
      id,
      requesterId: actor.id,
      expectedVersion: command.expectedVersion,
      requestId,
    });
    if (!cancelled) {
      throw new AppError(
        409,
        'ORDER_PRICE_APPROVAL_NOT_PENDING',
        'A solicitação foi atualizada por outra operação.',
      );
    }
    const updated = await this.repository.findOwnedById(id, actor.id);
    if (!updated) throw new Error('Solicitação cancelada não encontrada.');
    return { data: updated };
  }

  async adminCount(): Promise<OrderPriceApprovalCountEnvelope> {
    return { data: { pending: await this.repository.countPending() } };
  }

  async adminList(
    query: AdminOrderPriceApprovalsQuery,
    requestId = 'internal-read',
  ): Promise<OrderPriceApprovalListEnvelope<AdminOrderPriceApprovalSummary>> {
    const now = this.clock.now();
    await this.expire({ now, requestId });
    return this.repository.listAdmin({
      page: query.page,
      pageSize: query.pageSize,
      now,
      ...(query.status ? { status: query.status } : {}),
      ...(query.requestedFrom ? { requestedFrom: query.requestedFrom } : {}),
      ...(query.requestedTo ? { requestedTo: query.requestedTo } : {}),
      ...(query.requesterId ? { requesterId: query.requesterId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.code ? { code: query.code } : {}),
    });
  }

  async adminDetails(
    id: string,
    requestId = 'internal-read',
  ): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
    await this.expire({ id, requestId });
    const approval = await this.repository.findById(id);
    if (!approval) {
      throw new AppError(404, 'ORDER_PRICE_APPROVAL_NOT_FOUND', 'Solicitação não encontrada.');
    }
    return { data: approval };
  }

  async approve(
    id: string,
    command: ApproveOrderPriceApprovalCommand,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
    const now = this.clock.now();
    const approvedUntil = new Date(
      now.getTime() + this.approvalValidityDays * 24 * 60 * 60 * 1_000,
    );
    return this.decide(
      id,
      command.expectedVersion,
      'APPROVED',
      command.note ?? null,
      actor,
      now,
      approvedUntil,
      requestId,
    );
  }

  async reject(
    id: string,
    command: RejectOrderPriceApprovalCommand,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
    return this.decide(
      id,
      command.expectedVersion,
      'REJECTED',
      command.reason,
      actor,
      this.clock.now(),
      null,
      requestId,
    );
  }

  private async decide(
    id: string,
    expectedVersion: number,
    status: 'APPROVED' | 'REJECTED',
    note: string | null,
    actor: AuthenticatedUser,
    now: Date,
    approvedUntil: Date | null,
    requestId: string,
  ): Promise<OrderPriceApprovalDetailEnvelope<AdminOrderPriceApprovalDetail>> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new AppError(404, 'ORDER_PRICE_APPROVAL_NOT_FOUND', 'Solicitação não encontrada.');
    }
    if (!canReviewOrderPriceApproval(current.requester.id, actor.id)) {
      throw new AppError(
        403,
        'ORDER_PRICE_APPROVAL_SELF_REVIEW',
        'Você não pode decidir a própria solicitação.',
      );
    }
    if (current.status !== 'PENDING' || current.version !== expectedVersion) {
      throw this.concurrentDecisionError(current.status, current.version);
    }
    const changed = await this.repository.decide({
      id,
      expectedVersion,
      status,
      reviewer: { id: actor.id, name: actor.name, email: actor.email.trim().toLowerCase() },
      reviewNote: note,
      reviewedAt: now,
      approvedUntil,
      requestId,
    });
    if (!changed) {
      const latest = await this.repository.findById(id);
      throw this.concurrentDecisionError(
        latest?.status ?? current.status,
        latest?.version ?? current.version,
      );
    }
    const updated = await this.repository.findById(id);
    if (!updated) throw new Error('Solicitação decidida não encontrada.');
    this.logger?.info(
      {
        requestId,
        approvalRequestId: id,
        reviewerId: actor.id,
        status,
        approvedUntil: approvedUntil?.toISOString() ?? null,
      },
      'Solicitação de aprovação de preço decidida.',
    );
    return { data: updated };
  }

  private concurrentDecisionError(status: string, version: number): AppError {
    return new AppError(
      409,
      'ORDER_PRICE_APPROVAL_CONCURRENT_DECISION',
      'A solicitação foi atualizada por outra operação.',
      { currentStatus: [status], currentVersion: [String(version)] },
    );
  }

  private async expire(input: {
    requestId: string;
    now?: Date;
    id?: string;
    requesterId?: string;
  }): Promise<void> {
    const expired = await this.repository.expireApproved({
      now: input.now ?? this.clock.now(),
      requestId: input.requestId,
      ...(input.id ? { id: input.id } : {}),
      ...(input.requesterId ? { requesterId: input.requesterId } : {}),
    });
    if (expired > 0) {
      this.logger?.info(
        { requestId: input.requestId, approvalRequestId: input.id, expiredCount: expired },
        'Aprovações de preço vencidas foram expiradas.',
      );
    }
  }
}

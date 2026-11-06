import { OrderStatus } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  CUSTOMER_CANCELLABLE_STATUSES,
  STOCK_CONSUMING_STATUSES,
  canTransitionOrder,
} from './orders.service';

describe('order status transitions', () => {
  it('allows pending orders to be confirmed, processed or cancelled', () => {
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
  });

  it('requires shipments to be packed before they can ship', () => {
    expect(canTransitionOrder(OrderStatus.PROCESSING, OrderStatus.PACKED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransitionOrder(OrderStatus.PACKED, OrderStatus.SHIPPED)).toBe(true);
  });

  it('treats delivered and cancelled orders as terminal', () => {
    expect(ALLOWED_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
    expect(ALLOWED_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });

  it('prevents cancellation once an order has shipped', () => {
    expect(canTransitionOrder(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransitionOrder(OrderStatus.PACKED, OrderStatus.CANCELLED)).toBe(true);
  });

  it('consumes stock from processing onwards', () => {
    expect(STOCK_CONSUMING_STATUSES.has(OrderStatus.PENDING)).toBe(false);
    expect(STOCK_CONSUMING_STATUSES.has(OrderStatus.PROCESSING)).toBe(true);
    expect(STOCK_CONSUMING_STATUSES.has(OrderStatus.PACKED)).toBe(true);
    expect(STOCK_CONSUMING_STATUSES.has(OrderStatus.SHIPPED)).toBe(true);
    expect(STOCK_CONSUMING_STATUSES.has(OrderStatus.DELIVERED)).toBe(true);
    expect(STOCK_CONSUMING_STATUSES.has(OrderStatus.CANCELLED)).toBe(false);
  });

  it('lets customers cancel only before fulfilment starts', () => {
    expect(CUSTOMER_CANCELLABLE_STATUSES.has(OrderStatus.PENDING)).toBe(true);
    expect(CUSTOMER_CANCELLABLE_STATUSES.has(OrderStatus.AWAITING_PAYMENT)).toBe(true);
    expect(CUSTOMER_CANCELLABLE_STATUSES.has(OrderStatus.PROCESSING)).toBe(false);
  });
});

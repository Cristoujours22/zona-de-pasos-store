import { describe, expect, it } from "vitest";

import {
  applyInventoryAdjustment,
  assertCopPrice,
  getStockStatus,
  presentStock,
} from "@/lib/catalog/domain";
import type { InventoryState } from "@/types/catalog";

const now = new Date("2026-04-02T12:00:00.000Z");

function state(quantity = 2): InventoryState {
  return { quantity, adjustments: [] };
}

describe("catalog domain", () => {
  it.each([
    [0, 3, "out_of_stock"],
    [3, 3, "low"],
    [4, 3, "full"],
  ] as const)("classifies stock at %s with threshold %s as %s", (quantity, threshold, expected) => {
    expect(getStockStatus(quantity, threshold)).toBe(expected);
  });

  it("renders detailed stock labels", () => {
    expect(presentStock(8, 3, "detailed")).toEqual({ status: "full", available: true, label: "Disponible" });
    expect(presentStock(3, 3, "detailed")).toEqual({ status: "low", available: true, label: "Pocas unidades" });
    expect(presentStock(0, 3, "detailed")).toEqual({ status: "out_of_stock", available: false, label: "Sin stock" });
  });

  it("supports availability-only and hidden display modes", () => {
    expect(presentStock(2, 3, "availability_only")).toEqual({ status: "low", available: true, label: "Disponible" });
    expect(presentStock(0, 3, "availability_only")).toEqual({ status: "out_of_stock", available: false, label: "No disponible" });
    expect(presentStock(2, 3, "hidden")).toEqual({ status: "low", available: true, label: null });
  });

  it("accepts only nonnegative integer COP prices", () => {
    expect(assertCopPrice(249900)).toBe(249900);
    expect(() => assertCopPrice(-1)).toThrowError(/COP price/);
    expect(() => assertCopPrice(249900.5)).toThrowError(/COP price/);
    expect(() => assertCopPrice(Number.NaN)).toThrowError(/COP price/);
  });

  it("rejects an adjustment that would make stock negative without mutating history", () => {
    const before = state(2);
    expect(() => applyInventoryAdjustment(before, {
      actorUserId: "admin-1",
      delta: -3,
      reason: "Venta confirmada",
      createdAt: now,
    })).toThrowError(/negative/);
    expect(before).toEqual({ quantity: 2, adjustments: [] });
  });

  it("records a valid adjustment with actor, reason, order reference, and boundaries", () => {
    const after = applyInventoryAdjustment(state(2), {
      actorUserId: "admin-1",
      delta: -2,
      reason: "Venta confirmada",
      orderReference: "order-7",
      createdAt: now,
    });
    expect(after.quantity).toBe(0);
    expect(after.adjustments).toEqual([{
      actorUserId: "admin-1",
      delta: -2,
      reason: "Venta confirmada",
      orderReference: "order-7",
      createdAt: now,
      stockBefore: 2,
      stockAfter: 0,
    }]);
  });
});

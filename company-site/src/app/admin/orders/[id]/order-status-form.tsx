"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { OrderStatus } from "@/generated/prisma/client";
import {
  ADMIN_ORDER_TRANSITIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
} from "@/lib/order-status";

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local state in step with the server after router.refresh() or when
  // the webhook moves the order underneath us.
  useEffect(() => {
    setStatus(currentStatus);
    setError(null);
  }, [currentStatus]);

  const allowed = ADMIN_ORDER_TRANSITIONS[currentStatus] ?? [];
  const options: OrderStatus[] = [currentStatus, ...allowed];

  async function handleChange(value: string) {
    if (!isOrderStatus(value) || value === status) return;
    const previous = status;
    setStatus(value);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });

      if (!response.ok) {
        let message = `Failed to update status (${response.status})`;
        try {
          const body = (await response.json()) as { error?: unknown };
          if (typeof body.error === "string" && body.error) message = body.error;
        } catch {
          // non-JSON error body; keep the generic message
        }
        setStatus(previous);
        setError(message);
        return;
      }

      router.refresh();
    } catch {
      setStatus(previous);
      setError("Failed to update status. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="status" className="text-sm font-medium">
          Status:
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => handleChange(e.target.value)}
          disabled={loading || allowed.length === 0}
          aria-describedby={error ? "status-error" : undefined}
          className="border rounded px-3 py-1 disabled:opacity-50"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {allowed.length === 0 && (
          <span className="text-xs text-gray-500">
            No further changes allowed from this status.
          </span>
        )}
      </div>
      {error && (
        <p id="status-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

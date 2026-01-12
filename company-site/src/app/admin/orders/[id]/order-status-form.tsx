"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    setStatus(newStatus);
    setLoading(true);

    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } catch (err) {
      setStatus(currentStatus);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="status" className="text-sm font-medium">
        Status:
      </label>
      <select
        id="status"
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="border rounded px-3 py-1 disabled:opacity-50"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

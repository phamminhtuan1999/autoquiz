"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

export function BuyCreditsButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to start checkout");
      if (payload.url) window.location.href = payload.url;
      else throw new Error("Stripe URL missing");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="sm"
        onPress={handleClick}
        isDisabled={loading}
      >
        {loading ? "Redirecting…" : "Buy 10 credits — $4.99"}
      </Button>
      {error && (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}

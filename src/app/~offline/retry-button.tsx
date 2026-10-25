"use client";

import { PrimaryButton } from "@/components/form";

export function RetryButton({ label }: { label: string }) {
  return (
    <PrimaryButton type="button" onClick={() => window.location.reload()}>
      {label}
    </PrimaryButton>
  );
}

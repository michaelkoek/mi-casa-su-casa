"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/navigate";
import { SoftButton } from "./form";

export function SignOutButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <SoftButton
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut().catch(() => {});
        hardNavigate("/login");
      }}
    >
      {label}
    </SoftButton>
  );
}

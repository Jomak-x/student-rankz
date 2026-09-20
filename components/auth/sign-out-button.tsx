"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const signingOut = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (signingOut.current) {
      return;
    }

    signingOut.current = true;
    setPending(true);
    setError(null);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setError("We couldn't sign you out. Please try again.");
        return;
      }

      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("We couldn't sign you out right now. Please try again.");
    } finally {
      signingOut.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleSignOut}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

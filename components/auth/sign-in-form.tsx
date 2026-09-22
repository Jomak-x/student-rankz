"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { AuthUnavailable } from "@/components/auth/auth-unavailable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export interface SignInFormProps {
  available: boolean;
  redirectTo: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

function validateSignIn(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function SignInForm({ available, redirectTo }: SignInFormProps) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const nextErrors = validateSignIn(email, password);

    setErrors(nextErrors);
    setFormError(null);

    if (!available || Object.keys(nextErrors).length > 0) {
      return;
    }

    submitting.current = true;
    setPending(true);

    try {
      const result = await authClient.signInEmail({ email, password });

      if (result.error || !result.data) {
        setFormError(
          "We couldn't sign you in. Check your email and password and try again.",
        );
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setFormError(
        "We couldn't sign you in right now. Please wait a moment and try again.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {!available ? <AuthUnavailable /> : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            disabled={!available || pending}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Password</Label>
            <span className="text-xs text-muted-foreground">
              Password recovery is coming later
            </span>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            disabled={!available || pending}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password ? (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!available || pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Student Rankz?{" "}
        <Link
          href={`/sign-up?next=${encodeURIComponent(redirectTo)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export { validateSignIn };

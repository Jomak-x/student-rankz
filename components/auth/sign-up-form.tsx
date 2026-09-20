"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import { AuthUnavailable } from "@/components/auth/auth-unavailable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export interface SignUpFormProps {
  available: boolean;
  redirectTo: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validateSignUp(
  name: string,
  email: string,
  password: string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (name.trim().length < 2) {
    errors.name = "Enter your name using at least 2 characters.";
  }

  if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (password.length < 8) {
    errors.password = "Use at least 8 characters.";
  } else if (password.length > 128) {
    errors.password = "Use no more than 128 characters.";
  }

  return errors;
}

export function SignUpForm({ available, redirectTo }: SignUpFormProps) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const nextErrors = validateSignUp(name, email, password);

    setErrors(nextErrors);
    setFormError(null);

    if (!available || Object.keys(nextErrors).length > 0) {
      return;
    }

    submitting.current = true;
    setPending(true);

    try {
      const result = await authClient.signUpEmail({ name, email, password });

      if (result.error || !result.data) {
        setFormError(
          "We couldn't create your account. Check your details and try again.",
        );
        return;
      }

      if (result.data.token) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setSubmitted(true);
      }
    } catch {
      setFormError(
        "We couldn't create your account right now. Please wait a moment and try again.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5 text-center" role="status">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="font-semibold">Account request accepted</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Neon Auth created your account without an active session. If email
            verification is enabled for this environment, use its verification
            message before signing in.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href={`/sign-in?next=${encodeURIComponent(redirectTo)}`} />}
        >
          Continue to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!available ? <AuthUnavailable /> : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            disabled={!available || pending}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name ? (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>

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
            aria-describedby={errors.email ? "signup-email-error" : undefined}
          />
          {errors.email ? (
            <p id="signup-email-error" className="text-xs text-destructive">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            disabled={!available || pending}
            aria-invalid={Boolean(errors.password)}
            aria-describedby="signup-password-help"
          />
          <p
            id="signup-password-help"
            className={
              errors.password
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {errors.password ?? "Use at least 8 characters."}
          </p>
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/sign-in?next=${encodeURIComponent(redirectTo)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export { validateSignUp };

import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirect } from "@/lib/auth/redirect";
import { getAuthAvailability } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params.next);

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access your Student Rankz account."
    >
      <SignInForm
        available={getAuthAvailability()}
        redirectTo={redirectTo}
      />
    </AuthShell>
  );
}

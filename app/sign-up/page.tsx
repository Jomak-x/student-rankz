import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeRedirect } from "@/lib/auth/redirect";
import { getAuthAvailability } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Create account",
};

export const dynamic = "force-dynamic";

interface SignUpPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params.next);

  return (
    <AuthShell
      title="Create your account"
      description="Use an email address you can access. No university affiliation is granted at sign-up."
    >
      <SignUpForm
        available={getAuthAvailability()}
        redirectTo={redirectTo}
      />
    </AuthShell>
  );
}

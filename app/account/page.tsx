import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleUserRound, Mail, ShieldAlert } from "lucide-react";

import { AuthUnavailable } from "@/components/auth/auth-unavailable";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getVerifiedSession } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Account",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getVerifiedSession();

  if (session.status === "anonymous") {
    redirect("/sign-in?next=%2Faccount");
  }

  if (session.status === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <AuthUnavailable />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your sign-in details.
        </p>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleUserRound className="size-5 text-primary" aria-hidden="true" />
            {session.user.name}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Mail className="size-4" aria-hidden="true" />
            {session.user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-medium">Identity only</p>
              <p className="leading-relaxed text-muted-foreground">
                This account confirms your sign-in identity. It does not confirm
                enrollment, student status, or affiliation with any university.
                University verification will be a separate flow.
              </p>
            </div>
          </div>

          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}

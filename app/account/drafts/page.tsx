import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthUnavailable } from "@/components/auth/auth-unavailable";
import { DraftList } from "@/components/drafts/draft-list";
import { getVerifiedSession } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Your drafts",
};

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const session = await getVerifiedSession();

  if (session.status === "anonymous") {
    redirect("/sign-in?next=%2Faccount%2Fdrafts");
  }

  if (session.status === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <AuthUnavailable />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Your private drafts</h1>
        <p className="text-sm text-muted-foreground">
          Review drafts are visible only to you and are never published from this page.
        </p>
      </div>
      <DraftList />
    </div>
  );
}

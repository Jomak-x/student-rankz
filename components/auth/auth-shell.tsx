import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-lg items-center px-4 py-10 sm:px-6">
      <div className="w-full space-y-5">
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          Student Rankz
        </Link>

        <Card className="border border-border/70 shadow-sm">
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="text-xl font-semibold"><h1>{title}</h1></CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <div className="border-t border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </Card>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Signing in establishes your account identity. University affiliation
          and student status require a separate verification step that is not
          available yet.
        </p>
      </div>
    </div>
  );
}

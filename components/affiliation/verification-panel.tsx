"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Verification = {
  universityId: string;
  universityName: string;
  verified: boolean;
  verifiedAt: string | null;
};
type StatusPage = { items: Verification[]; hasMore: boolean; nextOffset: number | null };
type Feedback = { text: string; signIn: boolean };
type Operation = "list" | "initiate" | "consume";

const messages: Record<string, string> = {
  INVALID_INPUT: "Check the email address and code, then try again.",
  INVALID_EMAIL: "Enter a valid university email address.",
  UNKNOWN_DOMAIN: "This email domain is not supported. Try your university email address.",
  NOT_PENDING: "There is no active code for this address. Request a new code.",
  INVALID_CODE: "This code is invalid or has expired. Try again or request a new code.",
  ALREADY_VERIFIED: "This mailbox may already be verified. Refresh your verification status.",
  RATE_LIMITED: "Too many attempts. Please wait before trying again.",
  SEND_FAILED: "We couldn't confirm the code request. Please wait, then try again.",
  UNAVAILABLE: "Verification is temporarily unavailable. Please try again later.",
  UNAUTHENTICATED: "Please sign in again to manage mailbox verification.",
  FORBIDDEN: "We couldn't complete this request. Refresh the page and try again.",
  UNSUPPORTED_MEDIA_TYPE: "We couldn't complete this request. Refresh the page and try again.",
  PAYLOAD_TOO_LARGE: "The email address is too long. Check it and try again.",
};

class VerificationFailure extends Error {
  constructor(readonly code: string) { super(code); }
}

function feedback(error: unknown): Feedback {
  const code = error instanceof VerificationFailure ? error.code : "UNAVAILABLE";
  return { text: messages[code] ?? messages.UNAVAILABLE, signIn: code === "UNAUTHENTICATED" };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function request(path: string, options: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  if (response.status !== 200) {
    let code: unknown;
    try {
      const body: unknown = await response.json();
      if (record(body) && record(body.error)) code = body.error.code;
    } catch { /* An unreadable response still receives fixed, safe copy. */ }
    if (response.status === 401) code = "UNAUTHENTICATED";
    else if (response.status === 403) code = "FORBIDDEN";
    else if (response.status === 429) code = "RATE_LIMITED";
    throw new VerificationFailure(typeof code === "string" && Object.hasOwn(messages, code) ? code : "UNAVAILABLE");
  }
  return response.json();
}

function statusPage(value: unknown, offset: number): StatusPage {
  if (!record(value) || !Array.isArray(value.items) || value.items.length > 50 ||
      typeof value.hasMore !== "boolean" ||
      (value.hasMore ? !Number.isSafeInteger(value.nextOffset) || Number(value.nextOffset) <= offset || Number(value.nextOffset) > 10_000 : value.nextOffset !== null)) {
    throw new VerificationFailure("UNAVAILABLE");
  }
  const items = value.items.map((item: unknown): Verification => {
    if (!record(item) || !uuid(item.universityId) || typeof item.universityName !== "string" ||
        typeof item.verified !== "boolean" ||
        !(item.verifiedAt === null || (typeof item.verifiedAt === "string" && Number.isFinite(Date.parse(item.verifiedAt))))) {
      throw new VerificationFailure("UNAVAILABLE");
    }
    return { universityId: item.universityId, universityName: item.universityName, verified: item.verified, verifiedAt: item.verifiedAt };
  });
  return { items, hasMore: value.hasMore, nextOffset: value.nextOffset as number | null };
}

function FailureNotice({ failure }: { failure: Feedback }) {
  return <div role="alert" className="space-y-2 text-sm text-destructive">
    <p>{failure.text}</p>
    {failure.signIn && <Link className="text-primary underline underline-offset-4" href="/sign-in?next=%2Faccount">Sign in</Link>}
  </div>;
}

export function VerificationPanel() {
  const [items, setItems] = useState<Verification[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [retryOffset, setRetryOffset] = useState(0);
  const [listError, setListError] = useState<Feedback | null>(null);
  const [formError, setFormError] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<Operation | null>("list");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ email: string; universityId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  const readStatuses = useCallback((controller: AbortController, offset: number) =>
    request(`/api/affiliation?offset=${offset}`, { signal: controller.signal }).then(value => {
      const page = statusPage(value, offset);
      if (active.current !== controller || controller.signal.aborted) return;
      setItems(current => offset === 0 ? page.items : [...new Map([...current, ...page.items].map(item => [item.universityId, item])).values()]);
      setNextOffset(page.nextOffset);
      setLoaded(true);
      setListError(null);
    }).catch((error: unknown) => {
      if (active.current !== controller || controller.signal.aborted) return;
      const failure = feedback(error);
      setListError(failure);
      if (failure.signIn) { setItems([]); setLoaded(false); }
    }).finally(() => {
      if (active.current === controller) { active.current = null; setBusy(null); }
    }), []);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    void readStatuses(controller, 0);
    return () => { active.current?.abort(); active.current = null; };
  }, [readStatuses]);

  function loadStatuses(offset: number) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy("list");
    setRetryOffset(offset);
    setListError(null);
    void readStatuses(controller, offset);
  }

  async function submit(operation: "initiate" | "consume") {
    if (active.current) return;
    const address = pending?.email ?? email.trim();
    if (!address) { setFormError(feedback(new VerificationFailure("INVALID_EMAIL"))); return; }
    if (operation === "consume" && (!pending || !/^\d{6}$/.test(code))) {
      setFormError({ text: "Enter the six-digit code from your email.", signIn: false });
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(operation);
    setFormError(null);
    setNotice(null);
    try {
      const result = await request(`/api/affiliation/${operation}`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation === "consume" ? { email: address, code } : { email: address }),
      });
      if (active.current !== controller || controller.signal.aborted) return;
      if (!record(result) || result.ok !== true || !uuid(result.universityId) ||
          (pending && result.universityId !== pending.universityId)) throw new VerificationFailure("UNAVAILABLE");
      if (operation === "initiate") {
        setEmail(address);
        setPending({ email: address, universityId: result.universityId });
        setCode("");
        setNotice("Code requested. Check your email and enter the latest code below.");
      } else {
        setItems(current => current.map(item => item.universityId === result.universityId ? { ...item, verified: true } : item));
        setPending(null);
        setCode("");
        setEmail("");
        setNotice("Mailbox control verified. This does not prove enrollment or student status.");
        setRetryOffset(0);
        await readStatuses(controller, 0);
      }
    } catch (error) {
      if (active.current !== controller || controller.signal.aborted) return;
      const failure = feedback(error);
      setFormError(failure);
      if (failure.signIn) { setItems([]); setLoaded(false); }
    } finally {
      if (active.current === controller) { active.current = null; setBusy(null); }
    }
  }

  function editAddress() {
    if (active.current) return;
    setPending(null);
    setCode("");
    setNotice(null);
    setFormError(null);
  }

  return <Card className="mt-6 border border-border/70 shadow-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><MailCheck className="size-5 text-primary" aria-hidden="true" />University mailbox verification</CardTitle>
      <CardDescription>Confirm control of a university email address. This does not prove enrollment or student status.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="space-y-3" aria-label="Your mailbox verifications">
        {busy === "list" && <p role="status" className="text-sm text-muted-foreground">Loading verification status…</p>}
        {loaded && items.length === 0 && <p className="text-sm text-muted-foreground">No mailbox verifications yet.</p>}
        {items.length > 0 && <ul className="space-y-2">{items.map(item => <li key={item.universityId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <span>{item.universityName}</span><Badge variant={item.verified ? "default" : "secondary"}>{item.verified ? "Mailbox verified" : "Not verified"}</Badge>
        </li>)}</ul>}
        {listError && <FailureNotice failure={listError} />}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => loadStatuses(0)}>Refresh status</Button>
          {listError && <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => loadStatuses(retryOffset)}>Retry loading status</Button>}
          {nextOffset !== null && <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => loadStatuses(nextOffset)}>Load more verifications</Button>}
        </div>
      </div>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(pending ? "consume" : "initiate"); }}>
        <div className="space-y-2">
          <Label htmlFor="verification-email">University email</Label>
          <Input id="verification-email" type="email" required maxLength={254} autoComplete="off" value={email} readOnly={pending !== null} disabled={busy !== null} onChange={event => setEmail(event.target.value)} />
        </div>
        {pending && <div className="space-y-2">
          <Label htmlFor="verification-code">Verification code</Label>
          <Input id="verification-code" type="text" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={busy !== null} onChange={event => setCode(event.target.value)} />
          <p className="text-xs text-muted-foreground">Use the latest six-digit code for the address above.</p>
        </div>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        {formError && <FailureNotice failure={formError} />}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy !== null}>{busy === "initiate" ? "Requesting code…" : busy === "consume" ? "Verifying…" : pending ? "Verify code" : "Request code"}</Button>
          {pending && <>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void submit("initiate")}>Resend code</Button>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={editAddress}>Edit address</Button>
          </>}
        </div>
      </form>
    </CardContent>
  </Card>;
}

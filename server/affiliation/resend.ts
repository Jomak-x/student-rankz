import "server-only";

import type { EmailTransport } from "./email.js";

// Production email adapter using the Resend API.
//
// Requires RESEND_API_KEY and RESEND_FROM to be set.
// Fails closed: throws on any send error so the caller never marks verified.
// Never logs recipient addresses, codes, or tokens.

export class ResendTransport implements EmailTransport {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  static fromEnv(): ResendTransport {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      throw new Error(
        "RESEND_API_KEY and RESEND_FROM must be set to use the Resend email transport",
      );
    }
    return new ResendTransport(apiKey, from);
  }

  async sendVerificationCode(params: {
    to: string;
    code: string;
    universityName: string;
  }): Promise<void> {
    const { Resend } = await import("resend");
    const client = new Resend(this.apiKey);

    const body = [
      `Your Student Rankz verification code for ${params.universityName} is:`,
      ``,
      `  ${params.code}`,
      ``,
      `This code expires in 15 minutes.`,
      `If you did not request this code, you can safely ignore this email.`,
    ].join("\n");

    const { error } = await client.emails.send({
      from: this.from,
      to: params.to,
      subject: "Your Student Rankz university verification code",
      text: body,
    });

    if (error) {
      // Log only the error type/message — never the recipient or code.
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }
}

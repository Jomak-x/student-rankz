export interface EmailTransport {
  sendVerificationCode(params: {
    to: string;
    code: string;
    universityName: string;
  }): Promise<void>;
}

// In-memory transport for tests: captures sent messages, never delivers mail.
export class MockTransport implements EmailTransport {
  readonly sent: Array<{ to: string; code: string; universityName: string }> = [];

  async sendVerificationCode(params: {
    to: string;
    code: string;
    universityName: string;
  }): Promise<void> {
    this.sent.push({ ...params });
  }
}

// Always-failing transport for send-failure tests.
export class FailingTransport implements EmailTransport {
  async sendVerificationCode(): Promise<void> {
    throw new Error("Simulated transport failure");
  }
}

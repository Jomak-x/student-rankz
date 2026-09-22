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

/**
 * Transport that signals when the send phase is reached, then blocks until
 * the caller resolves or rejects it.  Used to exercise the window between
 * the challenge being written to the DB and the delivery confirmation.
 */
export class ControlledTransport implements EmailTransport {
  private _ready!: () => void;
  private _resolve!: () => void;
  private _reject!: (e: Error) => void;

  /** Resolves once sendVerificationCode() has been called (challenge is in DB). */
  readonly sending: Promise<void> = new Promise<void>((r) => {
    this._ready = r;
  });

  private readonly gate: Promise<void> = new Promise<void>((res, rej) => {
    this._resolve = res;
    this._reject = rej;
  });

  async sendVerificationCode(): Promise<void> {
    this._ready();   // signal that the challenge is now in the DB
    await this.gate; // block until succeed() or fail() is called
  }

  succeed(): void {
    this._resolve();
  }

  fail(message = "Controlled transport failure"): void {
    this._reject(new Error(message));
  }
}

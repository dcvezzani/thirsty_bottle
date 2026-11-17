import crypto from 'node:crypto';
import type { Rng } from '@vct/shared';

export const randomId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');

/** Secure RNG that records every draw so the action can be replayed deterministically. */
export class RecordingRng implements Rng {
  draws: number[] = [];
  int(max: number) {
    const v = max <= 1 ? 0 : crypto.randomInt(max);
    this.draws.push(v);
    return v;
  }
}

/** Replays recorded draws in order. */
export class ReplayRng implements Rng {
  private i = 0;
  constructor(private draws: number[]) {}
  int(max: number) {
    const v = this.draws[this.i++];
    if (v === undefined || v >= max) throw new Error('replay rng mismatch');
    return v;
  }
}

/** Simple token bucket. */
export class Bucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private rate: number,
    private burst: number,
  ) {
    this.tokens = burst;
  }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

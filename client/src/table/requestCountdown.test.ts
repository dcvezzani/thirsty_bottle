import { describe, expect, it } from 'vitest';
import { requestDeadline } from './requestCountdown';

describe('request countdown (3.1)', () => {
  it('fixes the deadline on first sight and ignores later server values', () => {
    const d = requestDeadline('r1', 5000, 1000);
    expect(d.at).toBe(6000);
    expect(requestDeadline('r1', 2000, 3000).at).toBe(6000);
  });
  it('a request already near its end starts with what is left', () => {
    expect(requestDeadline('r2', 1200, 0)).toMatchObject({ at: 1200, total: 1200 });
  });
});

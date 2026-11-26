import { describe, expect, it } from 'vitest';
import { GLIDE_STOP, PendingSecond, TwoFingerPan, cancelCardGestures, glideSteps, onCancelCardGestures, velocity } from './pan';

describe('two-finger pan (table-scrolling 2.1)', () => {
  it('starts only on the second finger and reports midpoint deltas', () => {
    const p = new TwoFingerPan();
    expect(p.down(1, 100, 100, 0)).toBe(false);
    expect(p.move(1, 100, 80, 10)).toEqual({ dx: 0, dy: 0 }); // one finger: not a pan
    expect(p.down(2, 200, 80, 20)).toBe(true);
    expect(p.active).toBe(true);
    // both fingers move up 30: midpoint moves 15 then 30
    expect(p.move(1, 100, 50, 30)).toEqual({ dx: 0, dy: -15 });
    expect(p.move(2, 200, 50, 30)).toEqual({ dx: 0, dy: -15 });
    // a pinch (fingers apart symmetrically) does not move the midpoint
    const a = p.move(1, 90, 50, 40);
    const b = p.move(2, 210, 50, 40);
    expect(a.dx + b.dx).toBe(0);
    expect(a.dy + b.dy).toBe(0);
  });

  it('a third finger does not restart the pan; lifting ends it once', () => {
    const p = new TwoFingerPan();
    p.down(1, 0, 0, 0);
    expect(p.down(2, 10, 0, 0)).toBe(true);
    expect(p.down(3, 20, 0, 0)).toBe(false);
    expect(p.up(1, 50)).not.toBeNull();
    expect(p.up(2, 50)).toBeNull();
    expect(p.active).toBe(false);
  });

  it('velocity uses the last 100 ms; a pause before lifting gives no glide', () => {
    const s = [
      { t: 0, x: 0, y: 0 },
      { t: 150, x: 0, y: -100 },
      { t: 200, x: 0, y: -150 },
      { t: 250, x: 0, y: -200 },
    ];
    expect(velocity(s, 250)).toEqual({ vx: 0, vy: -1 });
    expect(velocity(s, 600)).toEqual({ vx: 0, vy: 0 });
  });

  it('glide decays to a stop and moves in the fingers’ direction', () => {
    const steps = glideSteps({ vx: 0, vy: -1.5 });
    expect(steps.length).toBeGreaterThan(10);
    expect(steps.length).toBeLessThan(400);
    expect(steps.every((s) => s.dy < 0)).toBe(true);
    expect(Math.abs(steps[steps.length - 1].dy) / 16).toBeGreaterThanOrEqual(GLIDE_STOP);
    expect(Math.abs(steps[1].dy)).toBeLessThan(Math.abs(steps[0].dy));
    expect(glideSteps({ vx: 0, vy: 0 })).toEqual([]);
  });

  it('cancel signal reaches every subscribed zone until unsubscribed', () => {
    let a = 0;
    let b = 0;
    const offA = onCancelCardGestures(() => a++);
    const offB = onCancelCardGestures(() => b++);
    cancelCardGestures();
    offA();
    cancelCardGestures();
    offB();
    expect([a, b]).toEqual([1, 2]);
  });
});

describe('a second finger while a card is carried (card-rotation 5.1)', () => {
  it('lifted quickly without moving it is a tap', () => {
    const p = new PendingSecond();
    p.start(2, 100, 100, 1000);
    expect(p.active).toBe(true);
    expect(p.move(2, 103, 102)).toBe('wait');
    expect(p.up(2, 1120)).toBe('tap');
    expect(p.active).toBe(false);
  });
  it('moved past the slop it becomes the pan, and the wait ends', () => {
    const p = new PendingSecond();
    p.start(2, 100, 100, 1000);
    expect(p.move(2, 130, 100)).toBe('pan');
    expect(p.active).toBe(false);
    expect(p.up(2, 1100)).toBe('cancel');
  });
  it('held too long is not a tap', () => {
    const p = new PendingSecond();
    p.start(2, 100, 100, 1000);
    expect(p.up(2, 1400)).toBe('cancel');
  });
  it('other fingers are not its business, and clear() drops the wait', () => {
    const p = new PendingSecond();
    p.start(2, 100, 100, 1000);
    expect(p.isFor(1)).toBe(false);
    expect(p.move(1, 500, 500)).toBe('wait');
    expect(p.up(1, 1100)).toBe('cancel');
    p.start(3, 10, 10, 2000);
    p.clear();
    expect(p.active).toBe(false);
  });
});

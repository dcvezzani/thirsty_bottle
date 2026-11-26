import { useEffect, type RefObject } from 'react';
import { PendingSecond, TwoFingerPan, cancelCardGestures, glideSteps, setBoardPanning } from './pan';
import { useUI } from './ui';
import { rotateCarried } from './rotate';

/**
 * Two fingers anywhere on the board scroll it, even over cards (cards take over single touches).
 * When the first finger started on empty space the browser is already panning natively: that
 * pointer is cancelled by the browser, so it is not tracked and this hook stays out of the way.
 */
export function useBoardPan(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const board = ref.current;
    if (!board) return;
    const pan = new TwoFingerPan();
    // card-rotation: while a card is carried, a second finger waits to see whether it is a tap (rotate) or a pan
    const pending = new PendingSecond();
    let glide = 0;
    const stopGlide = () => {
      cancelAnimationFrame(glide);
      glide = 0;
    };
    const isTouch = (e: PointerEvent) => e.pointerType === 'touch';
    const onDown = (e: PointerEvent) => {
      if (!isTouch(e)) return;
      stopGlide();
      // (the carrying finger may have started on the hand, outside the board, so it is not always tracked here)
      if (useUI.getState().drag && pan.count <= 1 && !pan.active) {
        pending.start(e.pointerId, e.clientX, e.clientY, e.timeStamp);
        return;
      }
      if (pan.down(e.pointerId, e.clientX, e.clientY, e.timeStamp)) {
        setBoardPanning(true);
        cancelCardGestures();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!isTouch(e)) return;
      if (pending.isFor(e.pointerId)) {
        // moved past the slop: it is the two-finger pan after all (and cancels the drag, as it always did)
        if (pending.move(e.pointerId, e.clientX, e.clientY) === 'pan' && pan.down(e.pointerId, e.clientX, e.clientY, e.timeStamp)) {
          setBoardPanning(true);
          cancelCardGestures();
        }
        return;
      }
      const { dx, dy } = pan.move(e.pointerId, e.clientX, e.clientY, e.timeStamp);
      if (pan.active) {
        e.preventDefault();
        board.scrollTop -= dy;
        board.scrollLeft -= dx;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!isTouch(e)) return;
      if (pending.isFor(e.pointerId)) {
        if (pending.up(e.pointerId, e.timeStamp) === 'tap' && e.type === 'pointerup') void rotateCarried();
        return;
      }
      if (pending.active) pending.clear(); // the carrying finger lifted first
      const v = pan.up(e.pointerId, e.timeStamp);
      if (pan.count === 0) setBoardPanning(false);
      if (!v) return;
      const steps = glideSteps(v);
      let i = 0;
      const frame = () => {
        const s = steps[i++];
        if (!s) return stopGlide();
        board.scrollTop -= s.dy;
        board.scrollLeft -= s.dx;
        glide = requestAnimationFrame(frame);
      };
      if (steps.length) glide = requestAnimationFrame(frame);
    };
    const opts = { capture: true } as const;
    board.addEventListener('pointerdown', onDown, opts);
    board.addEventListener('pointermove', onMove, { capture: true, passive: false });
    board.addEventListener('pointerup', onUp, opts);
    board.addEventListener('pointercancel', onUp, opts);
    return () => {
      stopGlide();
      setBoardPanning(false);
      board.removeEventListener('pointerdown', onDown, opts);
      board.removeEventListener('pointermove', onMove, opts);
      board.removeEventListener('pointerup', onUp, opts);
      board.removeEventListener('pointercancel', onUp, opts);
    };
  }, [ref]);
}

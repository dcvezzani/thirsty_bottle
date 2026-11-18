import { useEffect, type RefObject } from 'react';
import { TwoFingerPan, cancelCardGestures, glideSteps, setBoardPanning } from './pan';

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
    let glide = 0;
    const stopGlide = () => {
      cancelAnimationFrame(glide);
      glide = 0;
    };
    const isTouch = (e: PointerEvent) => e.pointerType === 'touch';
    const onDown = (e: PointerEvent) => {
      if (!isTouch(e)) return;
      stopGlide();
      if (pan.down(e.pointerId, e.clientX, e.clientY, e.timeStamp)) {
        setBoardPanning(true);
        cancelCardGestures();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!isTouch(e)) return;
      const { dx, dy } = pan.move(e.pointerId, e.clientX, e.clientY, e.timeStamp);
      if (pan.active) {
        e.preventDefault();
        board.scrollTop -= dy;
        board.scrollLeft -= dx;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!isTouch(e)) return;
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

import { useLayoutEffect, useState, type RefObject } from 'react';

/** Board content width (inside its padding) and the table's base card width at the current zoom. */
export function useBoardSize(ref: RefObject<HTMLDivElement>, zoom: number) {
  const [size, setSize] = useState<{ w: number; cardW: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const base = parseFloat(cs.getPropertyValue('--base-card-w')) || 64;
      const next = { w: Math.floor(w), cardW: Math.round(base * zoom * 10) / 10 };
      setSize((cur) => (cur && cur.w === next.w && cur.cardW === next.cardW ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, zoom]);
  return size;
}

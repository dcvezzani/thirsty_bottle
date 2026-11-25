import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { HEADER_DEFAULTS, HeaderGesture, type HSample } from './headerGesture';
import { enterRegistry, HeaderStripRun } from './scrubStrip';
import { finishScrub, placeLoupe } from './CardRow';
import { isBoardPanning } from './pan';
import { useUI } from './ui';

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** How far below the header's bottom edge the finger must be before the zone's cards take over. */
const ENTER_MARGIN = 2;

/**
 * header-scrub: the gestures on a zone's header. A tap opens the zone's actions (the click), a still hold by the host starts
 * arrange mode, and a slide travels along the headers of the board (the header strip), showing each zone's focus card in the
 * loupe; sliding down into the zone's cards hands the finger to that zone's own scrub.
 */
export function useZoneHeader({
  zoneId,
  sectionRef,
  host,
  onTap,
}: {
  zoneId: string;
  sectionRef: RefObject<HTMLElement>;
  host: boolean;
  onTap: () => void;
}) {
  const run = useRef<HeaderStripRun | null>(null);
  const pointer = useRef<{ type: string; id: number; x: number; y: number }>({ type: 'touch', id: 0, x: 0, y: 0 });
  const suppress = useRef(false);
  const live = useRef({ zoneId, host, onTap });
  live.current = { zoneId, host, onTap };

  const g = useMemo(() => {
    const headerBottom = (id: string) => document.querySelector<HTMLElement>(`[data-header-zone="${CSS.escape(id)}"] .zone-label`)?.getBoundingClientRect().bottom ?? Infinity;
    const zoneRect = (id: string) => document.querySelector<HTMLElement>(`[data-header-zone="${CSS.escape(id)}"]`)?.getBoundingClientRect();
    const setRow = () => {
      const l = useUI.getState().loupe;
      const label = run.current?.label();
      if (l && label) useUI.setState({ loupe: { ...l, row: label, details: false } });
    };
    return new HeaderGesture(
      {
        onHold: () => {
          suppress.current = true;
          useUI.setState({ arranging: true, sheet: null });
          vibrate(15);
        },
        onSlideStart: (s: HSample) => {
          suppress.current = true;
          placeLoupe(sectionRef.current, pointer.current.type);
          run.current = new HeaderStripRun(live.current.zoneId, () => {
            vibrate(12);
            setRow();
          });
          run.current.update(s.x, s.t);
          setRow();
        },
        onSlide: (s: HSample) => {
          run.current?.update(s.x, s.t);
        },
        onDwell: () => {
          const l = useUI.getState().loupe;
          if (l) useUI.setState({ loupe: { ...l, details: true } });
        },
        onExit: (s: HSample) => {
          const r = run.current;
          run.current = null;
          useUI.setState({ preview: null, loupe: null });
          if (r?.cur) enterRegistry.get(r.cur)?.(s.x, s.y, pointer.current.id);
        },
        onEnd: () => {
          run.current = null;
          finishScrub(pointer.current.type);
        },
      },
      {
        ...HEADER_DEFAULTS,
        hold: false,
        // only touch and pen slide; a mouse press keeps its tap and (host) hold meanings
        isBelow: (s: HSample) => {
          const r = run.current;
          if (!r?.cur || !enterRegistry.has(r.cur)) return false;
          const z = zoneRect(r.cur);
          return !!z && s.y >= headerBottom(r.cur) + ENTER_MARGIN && s.x >= z.left && s.x <= z.right;
        },
      },
    );
  }, [sectionRef]);

  // the host's hold is a setting of the gesture; keep it in step with the role
  useEffect(() => {
    (g as unknown as { cfg: { hold: boolean } }).cfg.hold = host;
  }, [g, host]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      g.tick(now);
      run.current?.tick(now);
    }, 50);
    return () => clearInterval(t);
  }, [g]);

  const sample = (e: React.PointerEvent): HSample => ({ x: e.clientX, y: e.clientY, t: performance.now() });

  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button === 2 || isBoardPanning()) return;
        suppress.current = false;
        pointer.current = { type: e.pointerType, id: e.pointerId, x: e.clientX, y: e.clientY };
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        // a mouse press keeps tap and hold; sliding is for touch and pen
        (g as unknown as { cfg: { slop: number } }).cfg.slop = e.pointerType === 'mouse' ? Infinity : HEADER_DEFAULTS.slop;
        g.down(sample(e));
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (g.state === 'idle') return;
        const dy = e.clientY - pointer.current.y;
        pointer.current.y = e.clientY;
        g.move(sample(e));
        // a press on a label that moves up or down is the board's one-finger scroll: the label takes no browser panning
        // (touch-action: none, so that a slide down into the cards is not taken over), so scroll the board by hand
        if (g.state === 'vertical') document.querySelector<HTMLElement>('.board')?.scrollBy({ top: -dy });
      },
      onPointerUp: (e: React.PointerEvent) => g.up(sample(e)),
      onPointerCancel: () => g.cancel(),
      onContextMenu: (e: React.MouseEvent) => {
        if (live.current.host) e.preventDefault();
      },
      onClick: () => {
        if (suppress.current) {
          suppress.current = false;
          return;
        }
        live.current.onTap();
      },
    },
  };
}

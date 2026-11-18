import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** Committed value; null while the field is empty or invalid. */
  value: number | null;
  min: number;
  max: number;
  /** Called with a valid count as soon as there is one, or null while the draft is empty/invalid. */
  onChange: (n: number | null) => void;
  /** Accessible name, e.g. "How many". */
  label: string;
  /** id for the text field so an external <label htmlFor> can point at it. */
  id?: string;
  className?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A count picker the size of one input: a slider plus a compact number field in a single row
 * (card-handling: choosing a number of cards). Typing may leave the field empty; values are
 * clamped to [min, max] on blur/Enter, and valid drafts are reported immediately.
 */
export function CountField({ value, min, max, onChange, label, id, className = '' }: Props) {
  const hi = Math.max(min, max);
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const editing = useRef(false);
  const hintId = useId();

  // follow external value changes while the user is not typing
  useEffect(() => {
    if (!editing.current) setDraft(value === null ? '' : String(value));
  }, [value]);

  // bounds changed: keep the value inside them
  useEffect(() => {
    if (value !== null && (value > hi || value < min)) {
      const n = clamp(value, min, hi);
      setDraft(String(n));
      onChange(n);
    }
  }, [min, hi]);

  const parse = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

  const type = (s: string) => {
    editing.current = true;
    setDraft(s);
    const n = parse(s);
    onChange(Number.isInteger(n) && n >= min && n <= hi ? n : null);
  };

  const commit = () => {
    editing.current = false;
    const n = parse(draft);
    if (Number.isInteger(n)) {
      const c = clamp(n, min, hi);
      setDraft(String(c));
      onChange(c);
    } else {
      // empty or junk: return to the last valid value (or min)
      const back = value ?? min;
      setDraft(String(back));
      onChange(back);
    }
  };

  const sliderValue = (() => {
    const n = parse(draft);
    return Number.isInteger(n) ? clamp(n, min, hi) : (value ?? min);
  })();

  return (
    <div className={`count-field ${className}`}>
      <input
        type="range"
        aria-label={`${label} (slider)`}
        min={min}
        max={hi}
        step={1}
        value={sliderValue}
        disabled={hi <= min}
        onChange={(e) => {
          editing.current = false;
          setDraft(e.target.value);
          onChange(Number(e.target.value));
        }}
      />
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={id ? undefined : label}
        aria-describedby={hintId}
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => type(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <span id={hintId} className="sr-only">
        {min} to {hi}
      </span>
    </div>
  );
}

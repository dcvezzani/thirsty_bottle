import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { CountField } from './CountField';

afterEach(cleanup);

function Harness({ max = 40, initial = 1, spy }: { max?: number; initial?: number | null; spy: (n: number | null) => void }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <CountField value={v} min={1} max={max} label="How many" onChange={(n) => (spy(n), setV(n))} />
      <output data-testid="out">{v === null ? 'null' : v}</output>
    </>
  );
}

const field = (c: HTMLElement) => c.querySelector('input[type="text"]') as HTMLInputElement;
const slider = (c: HTMLElement) => c.querySelector('input[type="range"]') as HTMLInputElement;

describe('CountField (card-count-input 1.1)', () => {
  it('can be cleared and retyped: "12" stays 12 and is reported', () => {
    const spy = vi.fn();
    const { container, getByTestId } = render(<Harness spy={spy} />);
    fireEvent.change(field(container), { target: { value: '' } });
    expect(field(container).value).toBe('');
    expect(getByTestId('out').textContent).toBe('null');
    fireEvent.change(field(container), { target: { value: '1' } });
    fireEvent.change(field(container), { target: { value: '12' } });
    expect(field(container).value).toBe('12');
    expect(getByTestId('out').textContent).toBe('12');
    expect(slider(container).value).toBe('12');
  });

  it('reports null while empty or out of range, and clamps on blur', () => {
    const spy = vi.fn();
    const { container, getByTestId } = render(<Harness spy={spy} />);
    fireEvent.change(field(container), { target: { value: '99' } });
    expect(getByTestId('out').textContent).toBe('null');
    fireEvent.blur(field(container));
    expect(field(container).value).toBe('40');
    expect(getByTestId('out').textContent).toBe('40');
    fireEvent.change(field(container), { target: { value: '0' } });
    fireEvent.keyDown(field(container), { key: 'Enter' });
    expect(field(container).value).toBe('1');
  });

  it('an empty field reverts to the last valid value on blur; non-digits are ignored', () => {
    const spy = vi.fn();
    const { container, getByTestId } = render(<Harness spy={spy} initial={7} />);
    fireEvent.change(field(container), { target: { value: '' } });
    fireEvent.blur(field(container));
    expect(field(container).value).toBe('1'); // last committed value became null, so min
    fireEvent.change(field(container), { target: { value: '5a' } });
    expect(field(container).value).toBe('5');
    expect(getByTestId('out').textContent).toBe('5');
  });

  it('slider changes update the number', () => {
    const spy = vi.fn();
    const { container, getByTestId } = render(<Harness spy={spy} />);
    fireEvent.change(slider(container), { target: { value: '23' } });
    expect(field(container).value).toBe('23');
    expect(getByTestId('out').textContent).toBe('23');
  });

  it('lowering max below the value clamps it', () => {
    const spy = vi.fn();
    function Bounds() {
      const [max, setMax] = useState(52);
      const [v, setV] = useState<number | null>(30);
      return (
        <>
          <CountField value={v} min={1} max={max} label="Cards" onChange={(n) => (spy(n), setV(n))} />
          <button onClick={() => setMax(17)}>shrink</button>
          <output data-testid="out">{String(v)}</output>
        </>
      );
    }
    const { container, getByText, getByTestId } = render(<Bounds />);
    fireEvent.click(getByText('shrink'));
    expect(getByTestId('out').textContent).toBe('17');
    expect(field(container).value).toBe('17');
    expect(slider(container).max).toBe('17');
  });

  it('disables the slider when only one value is possible', () => {
    const { container } = render(<Harness spy={vi.fn()} max={1} />);
    expect(slider(container).disabled).toBe(true);
    expect(field(container).value).toBe('1');
  });
});

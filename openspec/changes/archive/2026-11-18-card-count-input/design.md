# Design

## Context

See proposal.md. Today `DrawSheet` and `DealSheet` hold `count` as a number and clamp in `onChange`, which makes the field impossible to clear. `ZoneSheet` keeps `peekN` as a number (empty becomes 0) and `cutDepth` as an unbounded string. Inputs follow the base control styles: 44px minimum height, `--control-line` borders and ink text (`ui-readability` spec).

## Goals / Non-Goals

**Goals:**
- Type or slide any valid count, in the same space as one input, consistently across Draw, Deal, Peek and Cut.

**Non-Goals:**
- Changing deck-editor count fields, server limits or the actions themselves.

## Decisions

### D1. `CountField` component
`<CountField value min max onChange label id? />` in `client/src/components/CountField.tsx`:
- **Draft state.** Internal `draft: string` mirrors `value` until the user types. Typing updates `draft` freely, so the field can be empty or temporarily out of range. Whenever `draft` parses to an integer within `[min, max]`, `onChange(n)` fires immediately (keeping the action label live). On blur or Enter, the draft is clamped and committed. An empty or invalid draft reverts to the last valid value on blur.
- **Validity.** The parent learns of validity through `onValidity?(ok)`, or simpler, the component calls `onChange(null)` while the draft is empty or invalid. The parent disables its action when the value is `null`. **Chosen: `onChange(number | null)`.**
- **Slider.** A native `<input type="range" min max step=1>`. It sets `draft` and calls `onChange` on input. When `max <= min`, it's disabled.
- **Number field.** `<input type="text" inputMode="numeric" pattern="[0-9]*">`, about 64px wide (avoiding `type=number` spinners and their browser quirks). It selects all on focus.
- **Bounds changes.** When `max` drops below the value, the component clamps and calls `onChange`.

### D2. Layout: one input-sized row
`.count-field` is a flex row with `min-height: var(--tap)`, full width, the same border and radius as inputs, and `background: var(--panel)`. The range takes `flex: 1` with horizontal padding. The number input is borderless inside the row, with a left divider in `--control-line`. The range thumb is 28px, the track 6px, and `accent-color: var(--accent)`. The whole row is the touch target, so it stays at 44px tall. No extra rows or labels are added: the existing label above is reused.

### D3. Bounds per use
- **Draw:** max = the pile's card count.
- **Deal:** max = `floor(pile / max(1, selectedSeats))`, at least 1. The default stays `floor(pile / occupied)`.
- **Peek:** max = the pile size.
- **Cut depth:** min 1, max = the pile size minus 1. The Cut and Split buttons use the committed value.

### D4. Accessibility
The range has `aria-label="<label> (slider)"`. The text input is labelled by the existing `<label for>` (or `aria-label`). Both expose min and max through `aria-valuemin`/`aria-valuemax`, which the range does natively. The text field uses `aria-describedby` pointing to visually hidden text such as "1 to 40". Keyboard arrows work on the range natively.

## Risks / Trade-offs

- **[A slider in a narrow row is imprecise for large piles]** → Typing is always available, and arrow keys give single steps on desktop.
- **[Mobile numeric keypads lack an Enter key on some devices]** → The value also commits on blur, and valid drafts update the action live.

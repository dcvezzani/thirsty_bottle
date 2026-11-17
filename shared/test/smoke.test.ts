import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION } from '@vct/shared';
describe('shared', () => it('exports protocol version', () => expect(PROTOCOL_VERSION).toBe(1)));

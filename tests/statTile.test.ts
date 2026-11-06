import { describe, expect, it } from 'vitest';
import { valueFitChars } from '../src/components/StatTile';

describe('valueFitChars', () => {
  it('keeps short figures at full size', () => {
    expect(valueFitChars(0)).toBeNull();
    expect(valueFitChars(1234)).toBeNull();
    expect(valueFitChars('99%')).toBeNull();
  });

  it('returns the character count for long values', () => {
    expect(valueFitChars('$12,345')).toBe(7);
    expect(valueFitChars(123456)).toBe(6);
  });
});

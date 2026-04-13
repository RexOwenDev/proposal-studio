import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime } from './format-time';

const NOW = new Date('2026-04-13T12:00:00.000Z').getTime();

describe('formatRelativeTime', () => {
  beforeEach(() => { vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns "just now" for dates within 5 seconds', () => {
    expect(formatRelativeTime(new Date(NOW - 3000))).toBe('just now');
    expect(formatRelativeTime(new Date(NOW - 0))).toBe('just now');
  });

  it('returns seconds for dates between 5s and 60s ago', () => {
    expect(formatRelativeTime(new Date(NOW - 5000))).toBe('5s ago');
    expect(formatRelativeTime(new Date(NOW - 59000))).toBe('59s ago');
  });

  it('returns minutes for dates between 60s and 60m ago', () => {
    expect(formatRelativeTime(new Date(NOW - 60 * 1000))).toBe('1m ago');
    expect(formatRelativeTime(new Date(NOW - 59 * 60 * 1000))).toBe('59m ago');
  });

  it('returns hours for dates between 1h and 24h ago', () => {
    expect(formatRelativeTime(new Date(NOW - 60 * 60 * 1000))).toBe('1h ago');
    expect(formatRelativeTime(new Date(NOW - 23 * 60 * 60 * 1000))).toBe('23h ago');
  });

  it('returns days for dates more than 24h ago', () => {
    expect(formatRelativeTime(new Date(NOW - 24 * 60 * 60 * 1000))).toBe('1d ago');
    expect(formatRelativeTime(new Date(NOW - 7 * 24 * 60 * 60 * 1000))).toBe('7d ago');
  });

  it('returns "just now" for future dates (defensive)', () => {
    expect(formatRelativeTime(new Date(NOW + 5000))).toBe('just now');
  });

  it('returns "just now" for invalid Date (defensive)', () => {
    expect(formatRelativeTime(new Date('not-a-date'))).toBe('just now');
  });
});

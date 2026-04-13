import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slugify, formatDate, debounce } from './utils';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugify('Proposal #1: Client & Agency!')).toBe('proposal-1-client-agency');
  });

  it('collapses multiple hyphens into one', () => {
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  it('handles already-slugified strings idempotently', () => {
    expect(slugify('hello-world')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(slugify('!@#$%')).toBe('');
  });

  it('handles unicode characters by stripping them', () => {
    expect(slugify('Café Proposal')).toBe('caf-proposal');
  });
});

describe('formatDate', () => {
  it('formats ISO date string as Month Day, Year in UTC', () => {
    // Use a fixed UTC date to avoid timezone flakiness
    expect(formatDate('2026-04-13T00:00:00.000Z')).toBe('Apr 13, 2026');
  });

  it('formats beginning of year correctly', () => {
    expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
  });

  it('formats end of year correctly', () => {
    expect(formatDate('2025-12-31T23:59:59.000Z')).toBe('Dec 31, 2025');
  });
});

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('only calls fn once after delay when called multiple times', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on each call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // resets
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled(); // not called yet — 50ms left
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the latest arguments to fn', () => {
    const fn = vi.fn();
    const debounced = debounce(fn as (...args: unknown[]) => void, 100);

    debounced('first');
    debounced('second');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('second');
  });
});

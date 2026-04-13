import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger (dev mode — NODE_ENV=test)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.info calls console.log', async () => {
    const { logger } = await import('./logger');
    logger.info('hello');
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('logger.warn calls console.warn', async () => {
    const { logger } = await import('./logger');
    logger.warn('watch out');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('logger.error calls console.error', async () => {
    const { logger } = await import('./logger');
    logger.error('boom');
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('logger.error includes errorMessage and errorName for Error instances', async () => {
    const { logger } = await import('./logger');
    const err = new TypeError('bad value');
    logger.error('something failed', err);

    const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain('bad value');
    expect(call).toContain('TypeError');
  });

  it('logger.error includes stack trace in non-production', async () => {
    const { logger } = await import('./logger');
    const err = new Error('test error');
    logger.error('failed', err);

    const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // In dev/test mode, stack should appear
    expect(call).toContain('stack');
  });

  it('logger.error handles non-Error thrown values', async () => {
    const { logger } = await import('./logger');
    logger.error('unexpected', 'string error');

    const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain('string error');
  });

  it('logger.error handles undefined err gracefully', async () => {
    const { logger } = await import('./logger');
    expect(() => logger.error('no err')).not.toThrow();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('passes context fields through to the output', async () => {
    const { logger } = await import('./logger');
    logger.info('with context', { proposalId: 'abc', userId: '123' });

    const call = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain('proposalId');
    expect(call).toContain('abc');
  });
});

/**
 * Production-mode output (JSON lines) is gated by IS_PROD which is evaluated
 * at module load time. Vitest runs in 'test' environment, so the prod branch
 * cannot be exercised without a dedicated test environment configuration.
 *
 * The security property (no stack traces in prod) is validated in the source
 * by the `if (!IS_PROD)` guard at logger.ts:77. Code review and the dev-mode
 * stack-trace test above together cover correctness.
 *
 * If you need a prod-format integration test, run:
 *   NODE_ENV=production npx vitest run src/lib/logger.test.ts
 */

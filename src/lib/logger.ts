/**
 * Structured logger for server-side use only.
 *
 * - Development: pretty-prints to console for readability
 * - Production: emits JSON lines compatible with Vercel log drains,
 *   Datadog, and Better Stack ingestion
 *
 * Never call from client components — this module imports nothing browser-unsafe,
 * but the intent is server-only (API routes, server actions, lib utilities).
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === 'production';

function emit(level: LogLevel, msg: string, context?: Record<string, unknown>) {
  const payload: LogPayload = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...context,
  };

  if (IS_PROD) {
    // JSON line — parseable by log aggregators
    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  } else {
    // Dev: readable format
    const prefix = `[${level.toUpperCase()}] ${payload.ts}`;
    const extra = context && Object.keys(context).length > 0
      ? `\n  ${JSON.stringify(context, null, 2).replace(/\n/g, '\n  ')}`
      : '';
    if (level === 'error') {
      console.error(`${prefix} ${msg}${extra}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${msg}${extra}`);
    } else {
      console.log(`${prefix} ${msg}${extra}`);
    }
  }
}

export const logger = {
  info(msg: string, context?: Record<string, unknown>) {
    emit('info', msg, context);
  },

  warn(msg: string, context?: Record<string, unknown>) {
    emit('warn', msg, context);
  },

  /**
   * Logs an error. Pass the raw Error object as `err` — stack traces are
   * stripped in production to avoid leaking implementation details.
   */
  error(msg: string, err?: unknown, context?: Record<string, unknown>) {
    const errContext: Record<string, unknown> = { ...context };

    if (err instanceof Error) {
      errContext.errorMessage = err.message;
      errContext.errorName = err.name;
      // Stack traces only in development — never leak in production
      if (!IS_PROD) {
        errContext.stack = err.stack;
      }
    } else if (err !== undefined) {
      errContext.error = String(err);
    }

    emit('error', msg, errContext);
  },
};

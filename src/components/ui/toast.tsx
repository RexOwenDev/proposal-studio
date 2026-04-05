'use client';

import { useState, useCallback } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-emerald-950 border-emerald-700 text-emerald-100',
  error:   'bg-red-950 border-red-700 text-red-100',
  warning: 'bg-amber-950 border-amber-700 text-amber-100',
  info:    'bg-zinc-800 border-zinc-700 text-zinc-100',
};

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

/** Render a stack of toast notifications in the bottom-right corner */
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[200] flex flex-col gap-2 w-auto sm:w-full sm:max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-2 duration-200 ${variantStyles[t.variant]}`}
        >
          <span className="text-sm font-bold shrink-0 mt-px opacity-70">{variantIcon[t.variant]}</span>
          <p className="flex-1 text-sm leading-snug">{t.message}</p>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); onDismiss(t.id); }}
              className="text-xs font-semibold underline underline-offset-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => onDismiss(t.id)}
            className="text-current opacity-40 hover:opacity-80 transition-opacity shrink-0 text-base leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Hook: manages a list of toasts. Auto-dismisses after 5s unless an action is present. */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = 'info',
      action?: ToastItem['action'],
    ) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant, action }]);
      // Auto-dismiss only when there's no action button (action toasts need manual dismiss)
      if (!action) {
        setTimeout(() => dismiss(id), 5000);
      }
    },
    [dismiss],
  );

  return { toasts, showToast, dismissToast: dismiss };
}

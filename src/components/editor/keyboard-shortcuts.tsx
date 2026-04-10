// src/components/editor/keyboard-shortcuts.tsx
'use client';

import { useEffect } from 'react';

interface Props {
  onForceSave: () => void;
  onToggleSections: () => void;
  onToggleShortcuts: () => void;
  showOverlay: boolean;
}

const SHORTCUTS = [
  { keys: 'Ctrl+S', mac: '⌘S',   label: 'Force save immediately' },
  { keys: 'Ctrl+/', mac: '⌘/',   label: 'Toggle sections panel' },
  { keys: 'Escape', mac: 'Esc',  label: 'Exit edit mode / close panel' },
  { keys: '?',      mac: '?',    label: 'Show/hide this shortcuts overlay' },
];

export default function KeyboardShortcuts({
  onForceSave,
  onToggleSections,
  onToggleShortcuts,
  showOverlay,
}: Props) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+S — force save
      if (mod && e.key === 's') {
        e.preventDefault();
        onForceSave();
        return;
      }

      // Ctrl/Cmd+/ — toggle sections
      if (mod && e.key === '/') {
        e.preventDefault();
        onToggleSections();
        return;
      }

      // ? — toggle shortcut overlay (only when not typing in an input/textarea)
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (document.activeElement as HTMLElement)?.tagName ?? ''
        )
      ) {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      // Escape — close overlay if open; otherwise blur active contentEditable
      if (e.key === 'Escape') {
        if (showOverlay) {
          onToggleShortcuts();
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        if (active?.contentEditable === 'true') {
          active.blur();
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onForceSave, onToggleSections, onToggleShortcuts, showOverlay]);

  if (!showOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60"
      onClick={onToggleShortcuts}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white font-semibold text-base mb-4">Keyboard Shortcuts</h2>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(({ keys, mac, label }) => (
              <tr key={keys} className="border-b border-zinc-800 last:border-0">
                <td className="py-2.5 pr-4">
                  <div className="flex gap-1">
                    {(navigator.platform.toUpperCase().includes('MAC') ? mac : keys)
                      .split('+')
                      .map((k) => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 font-mono"
                        >
                          {k}
                        </kbd>
                      ))}
                  </div>
                </td>
                <td className="py-2.5 text-zinc-400">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-600 mt-4 text-center">Press ? or Esc to close</p>
      </div>
    </div>
  );
}

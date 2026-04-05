'use client';

import { useState } from 'react';
import type { ContentBlock } from '@/lib/types';

interface SectionSidebarProps {
  open: boolean;
  blocks: ContentBlock[];
  onClose: () => void;
  onToggleVisibility: (blockId: string, visible: boolean) => void;
  onRevertBlock: (blockId: string) => void;
  /** R1: map of email → blockId for teammates actively editing a section */
  editingUsers?: Map<string, string>;
}

export default function SectionSidebar({
  open,
  blocks,
  onClose,
  onToggleVisibility,
  onRevertBlock,
  editingUsers,
}: SectionSidebarProps) {
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);

  if (!open) return null;

  function handleRevert(blockId: string) {
    setConfirmRevertId(blockId);
  }

  async function confirmRevert() {
    if (!confirmRevertId) return;
    setRevertingId(confirmRevertId);
    await onRevertBlock(confirmRevertId);
    setRevertingId(null);
    setConfirmRevertId(null);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 animate-in" onClick={onClose} />

      <div className="fixed top-14 left-0 bottom-0 z-50 w-80 max-w-[90vw] bg-zinc-900 border-r border-zinc-800 overflow-y-auto animate-slide-in">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-white text-sm font-medium">Sections</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm">
            &times;
          </button>
        </div>

        <div className="p-2">
          {blocks.map((block) => {
            const isModified = block.current_html !== block.original_html;
            // R1: find any teammate currently editing this block
            const editorEmail = editingUsers
              ? Array.from(editingUsers.entries()).find(([, bid]) => bid === block.id)?.[0]
              : undefined;
            const editorName = editorEmail ? editorEmail.split('@')[0] : null;

            return (
              <div
                key={block.id}
                className="px-3 py-2.5 rounded-md hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-zinc-500 font-mono text-xs w-5 shrink-0">
                      {block.block_order + 1}
                    </span>
                    <div className="min-w-0">
                      <span
                        className={`text-sm truncate block ${
                          block.visible ? 'text-zinc-200' : 'text-zinc-500'
                        }`}
                      >
                        {block.label || `Block ${block.block_order + 1}`}
                      </span>
                      {isModified && !editorName && (
                        <span className="text-xs text-amber-500">edited</span>
                      )}
                      {editorName && (
                        <span className="text-xs text-blue-400 animate-pulse">
                          ✏ {editorName} is editing…
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isModified && (
                      <button
                        onClick={() => handleRevert(block.id)}
                        disabled={revertingId === block.id}
                        className="text-xs px-2 py-0.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-950/30 rounded transition-colors"
                        title="Revert to original"
                      >
                        {revertingId === block.id ? '...' : 'Revert'}
                      </button>
                    )}
                    <button
                      onClick={() => onToggleVisibility(block.id, !block.visible)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        block.visible ? 'bg-blue-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          block.visible ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revert confirmation */}
      {confirmRevertId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setConfirmRevertId(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-medium mb-2">Revert this section?</h3>
            <p className="text-zinc-400 text-sm mb-4">
              This will discard all edits and restore the original imported content for this section.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRevertId(null)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRevert}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-md transition-colors"
              >
                Revert
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

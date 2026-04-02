'use client';

import type { ContentBlock } from '@/lib/types';

interface SectionSidebarProps {
  open: boolean;
  blocks: ContentBlock[];
  onClose: () => void;
  onToggleVisibility: (blockId: string, visible: boolean) => void;
}

export default function SectionSidebar({
  open,
  blocks,
  onClose,
  onToggleVisibility,
}: SectionSidebarProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed top-14 left-0 bottom-0 z-50 w-80 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-white text-sm font-medium">Sections</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-sm"
          >
            &times;
          </button>
        </div>

        <div className="p-2">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-zinc-500 font-mono text-xs w-5 shrink-0">
                  {block.block_order + 1}
                </span>
                <span
                  className={`text-sm truncate ${
                    block.visible ? 'text-zinc-200' : 'text-zinc-500'
                  }`}
                >
                  {block.label || `Block ${block.block_order + 1}`}
                </span>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => onToggleVisibility(block.id, !block.visible)}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
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
          ))}
        </div>
      </div>
    </>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, ContentBlock, Comment } from '@/lib/types';
import EditorToolbar from '@/components/editor/editor-toolbar';
import SectionSidebar from '@/components/editor/section-sidebar';
import CommentPanel from '@/components/editor/comment-panel';

interface EditPageProps {
  params: Promise<{ slug: string }>;
}

export default function EditPage({ params }: EditPageProps) {
  const [slug, setSlug] = useState<string>('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSections, setShowSections] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const supabase = createClient();

  // Resolve async params
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Fetch proposal data
  useEffect(() => {
    if (!slug) return;

    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch proposal by slug
      const { data: proposalData } = await supabase
        .from('proposals')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!proposalData) {
        router.push('/');
        return;
      }

      const { data: blocksData } = await supabase
        .from('content_blocks')
        .select('*')
        .eq('proposal_id', proposalData.id)
        .order('block_order', { ascending: true });

      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .eq('proposal_id', proposalData.id)
        .order('created_at', { ascending: true });

      setProposal(proposalData);
      setBlocks(blocksData || []);
      setComments(commentsData || []);
      setLoading(false);
    }

    fetchData();
  }, [slug, supabase, router]);

  // Render proposal in iframe
  useEffect(() => {
    if (!proposal || blocks.length === 0) return;
    renderIframe();
  }, [proposal, blocks]);

  function buildEditorHTML(): string {
    if (!proposal) return '';

    // Parse stylesheet: extract head links and CSS
    const raw = proposal.stylesheet || '';
    let headLinks = '';
    let css = '';

    const newMatch = raw.match(/<!--HEAD_LINKS-->\n([\s\S]*?)\n<!--\/HEAD_LINKS-->/);
    if (newMatch) {
      headLinks = newMatch[1].trim();
      css = raw.replace(/<!--HEAD_LINKS-->[\s\S]*?<!--\/HEAD_LINKS-->\n?/, '').trim();
    } else if (raw.includes('<!-- Font preconnects -->')) {
      const parts = raw.split('\n\n');
      headLinks = parts.filter((p) => p.includes('<link')).map((p) => p.replace('<!-- Font preconnects -->', '').trim()).join('\n');
      css = parts.filter((p) => !p.includes('<link') && !p.includes('<!-- Font')).join('\n\n');
    } else {
      css = raw;
    }

    // Group consecutive blocks by wrapper_class
    const bodyParts: string[] = [];
    let currentWrapper: string | null = null;
    let wrapperBuffer: string[] = [];

    function flushWrapper() {
      if (wrapperBuffer.length > 0 && currentWrapper) {
        bodyParts.push(`<div class="${currentWrapper}">\n${wrapperBuffer.join('\n')}\n</div>`);
        wrapperBuffer = [];
      }
      currentWrapper = null;
    }

    for (const block of blocks) {
      const blockHTML = `<div data-block-id="${block.id}" data-hidden="${!block.visible}" style="${!block.visible ? 'opacity: 0.35; position: relative;' : ''}">${block.current_html}</div>`;
      const wrapper = block.wrapper_class || null;

      if (wrapper !== currentWrapper) {
        flushWrapper();
        if (wrapper) {
          currentWrapper = wrapper;
          wrapperBuffer.push(blockHTML);
        } else {
          bodyParts.push(blockHTML);
        }
      } else if (wrapper) {
        wrapperBuffer.push(blockHTML);
      } else {
        bodyParts.push(blockHTML);
      }
    }
    flushWrapper();

    // Split scripts: function declarations stay global, execution wraps in DOMContentLoaded
    const wrappedScripts = proposal.scripts ? wrapScripts(proposal.scripts) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headLinks}
  <style>
    ${css}

    /* Force all content visible in editor */
    .reveal, [class*="reveal"], [class*="animate"], [class*="fade"] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
    }

    /* Editor affordances */
    [data-editable]:hover {
      outline: 2px solid rgba(59, 130, 246, 0.3);
      outline-offset: 2px;
      cursor: text;
    }
    [data-editable].editing {
      outline: 2px solid rgba(59, 130, 246, 0.8);
      outline-offset: 2px;
    }
    [data-block-id][data-hidden="true"]::after {
      content: 'HIDDEN';
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: system-ui;
      letter-spacing: 1px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  ${bodyParts.join('\n')}
  ${wrappedScripts}
</body>
</html>`;
  }

  function renderIframe() {
    const iframe = iframeRef.current;
    if (!iframe || !proposal) return;

    const html = buildEditorHTML();
    iframe.srcdoc = html;

    // Set up editable elements after iframe loads
    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      // Auto-resize
      iframe.style.height = `${Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) + 50}px`;

      // Watch for height changes
      const resizeObserver = new ResizeObserver(() => {
        iframe.style.height = `${Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) + 50}px`;
      });
      resizeObserver.observe(doc.body);

      // Set up editable elements
      setupEditableElements(doc);

      iframe.removeEventListener('load', onLoad);
    };

    iframe.addEventListener('load', onLoad);
  }

  function setupEditableElements(doc: Document) {
    // Tags that should never be editable
    const skipTags = new Set([
      'script', 'style', 'link', 'meta', 'svg', 'path', 'line', 'circle',
      'rect', 'polygon', 'polyline', 'g', 'defs', 'clippath', 'use',
      'input', 'select', 'textarea', 'button', 'iframe', 'img', 'video',
      'audio', 'canvas', 'br', 'hr',
    ]);

    // Tags that are structural containers (walk into, don't make editable themselves)
    const containerTags = new Set([
      'div', 'section', 'article', 'main', 'header', 'footer', 'nav',
      'aside', 'figure', 'fieldset', 'form', 'details', 'summary',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'ul', 'ol', 'dl',
    ]);

    doc.querySelectorAll('[data-block-id]').forEach((blockEl) => {
      const blockId = blockEl.getAttribute('data-block-id')!;
      markEditableLeaves(blockEl as HTMLElement, blockId, skipTags, containerTags, doc);
    });
  }

  /** Walk the DOM tree and mark leaf text elements as editable */
  function markEditableLeaves(
    el: HTMLElement,
    blockId: string,
    skipTags: Set<string>,
    containerTags: Set<string>,
    doc: Document,
  ) {
    for (const child of Array.from(el.children)) {
      const htmlChild = child as HTMLElement;
      const tag = child.tagName.toLowerCase();

      if (skipTags.has(tag)) continue;
      if (htmlChild.getAttribute('data-editable')) continue;

      // Check if this element has direct text content (not just child elements)
      const hasDirectText = Array.from(child.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
      );
      const hasChildElements = child.querySelector('*') !== null;

      if (hasDirectText && !containerTags.has(tag)) {
        // This is a leaf text element — make it editable
        htmlChild.setAttribute('data-editable', 'true');
        htmlChild.setAttribute('data-block-id-ref', blockId);
        htmlChild.addEventListener('click', (e) => {
          e.stopPropagation();
          startEditing(htmlChild, blockId, doc);
        });
      } else if (hasDirectText && containerTags.has(tag) && !hasChildElements) {
        // Container with only text (no child elements) — make editable
        htmlChild.setAttribute('data-editable', 'true');
        htmlChild.setAttribute('data-block-id-ref', blockId);
        htmlChild.addEventListener('click', (e) => {
          e.stopPropagation();
          startEditing(htmlChild, blockId, doc);
        });
      } else {
        // Walk deeper into containers
        markEditableLeaves(htmlChild, blockId, skipTags, containerTags, doc);
      }
    }
  }

  function startEditing(el: HTMLElement, blockId: string, doc: Document) {
    // Remove editing from previous element
    doc.querySelectorAll('.editing').forEach((prev) => {
      (prev as HTMLElement).contentEditable = 'false';
      prev.classList.remove('editing');
    });

    el.contentEditable = 'true';
    el.classList.add('editing');
    el.focus();
    setEditingBlockId(blockId);

    // Save on blur
    const handleBlur = () => {
      el.contentEditable = 'false';
      el.classList.remove('editing');
      el.removeEventListener('blur', handleBlur);
      el.removeEventListener('keydown', handleKeydown);
      saveBlockContent(blockId, doc);
      setEditingBlockId(null);
    };

    // Cancel on Escape
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        el.contentEditable = 'false';
        el.classList.remove('editing');
        el.removeEventListener('blur', handleBlur);
        el.removeEventListener('keydown', handleKeydown);
        setEditingBlockId(null);
        // Revert by re-rendering
        renderIframe();
      }
    };

    el.addEventListener('blur', handleBlur);
    el.addEventListener('keydown', handleKeydown);
  }

  const saveBlockContent = useCallback(
    (blockId: string, doc: Document) => {
      // Clear any pending save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving');

        // Get the updated HTML from the block wrapper
        const blockEl = doc.querySelector(`[data-block-id="${blockId}"]`);
        if (!blockEl) return;

        // Get inner HTML (the actual proposal content, minus our wrapper)
        const updatedHtml = blockEl.innerHTML;

        try {
          const res = await fetch(`/api/blocks/${blockId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_html: updatedHtml }),
          });

          if (!res.ok) throw new Error('Save failed');

          // Update local state
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === blockId ? { ...b, current_html: updatedHtml } : b
            )
          );

          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          setSaveStatus('error');
        }
      }, 500); // 500ms debounce
    },
    []
  );

  async function handleToggleVisibility(blockId: string, visible: boolean) {
    try {
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      });

      if (!res.ok) throw new Error('Failed to toggle visibility');

      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, visible } : b))
      );
    } catch {
      // Revert on error
    }
  }

  async function handlePublish(publish: boolean) {
    if (!proposal) return;

    const status = publish ? 'published' : 'draft';
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      const updated = await res.json();
      setProposal({ ...proposal, status: updated.status });
    } catch {
      // Handle error
    }
  }

  async function handleAddComment(blockId: string | null, text: string) {
    if (!proposal) return;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id, block_id: blockId, text }),
      });

      if (!res.ok) throw new Error('Failed to add comment');

      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
    } catch {
      // Handle error
    }
  }

  async function handleResolveComment(commentId: string, resolved: boolean) {
    try {
      const res = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId, resolved }),
      });

      if (!res.ok) throw new Error('Failed to resolve comment');

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved } : c))
      );
    } catch {
      // Handle error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading proposal...</div>
      </div>
    );
  }

  if (!proposal) return null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <EditorToolbar
        title={proposal.title}
        status={proposal.status}
        saveStatus={saveStatus}
        onToggleSections={() => setShowSections(!showSections)}
        onToggleComments={() => setShowComments(!showComments)}
        onPublish={handlePublish}
        onBack={() => router.push('/')}
        slug={proposal.slug}
      />

      {/* Sidebar panels */}
      <SectionSidebar
        open={showSections}
        blocks={blocks}
        onClose={() => setShowSections(false)}
        onToggleVisibility={handleToggleVisibility}
      />

      <CommentPanel
        open={showComments}
        comments={comments}
        blocks={blocks}
        onClose={() => setShowComments(false)}
        onAddComment={handleAddComment}
        onResolveComment={handleResolveComment}
      />

      {/* Proposal content in iframe */}
      <div className="pt-14">
        <iframe
          ref={iframeRef}
          className="w-full border-0"
          style={{ minHeight: '100vh' }}
          title="Proposal Editor"
        />
      </div>
    </div>
  );
}

/**
 * Split script content into global function declarations and execution code.
 * Function declarations stay global so inline handlers (oninput, onclick) can find them.
 * Execution code wraps in DOMContentLoaded.
 */
function wrapScripts(scripts: string): string {
  const lines = scripts.split('\n');
  const globalLines: string[] = [];
  const deferLines: string[] = [];

  let inFunction = false;
  let braceDepth = 0;

  for (const line of lines) {
    if (!inFunction && /^\s*function\s+\w+/.test(line)) {
      inFunction = true;
      braceDepth = 0;
    }

    if (inFunction) {
      globalLines.push(line);
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        inFunction = false;
      }
    } else {
      deferLines.push(line);
    }
  }

  const globalCode = globalLines.join('\n').trim();
  const deferCode = deferLines.join('\n').trim();

  let result = '';
  if (globalCode) {
    result += `<script>\n${globalCode}\n<\/script>\n`;
  }
  if (deferCode) {
    result += `<script>\ndocument.addEventListener('DOMContentLoaded', function() {\n${deferCode}\n});\n<\/script>`;
  }

  return result;
}

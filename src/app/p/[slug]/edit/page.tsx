'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, ContentBlock, Comment } from '@/lib/types';
import EditorToolbar from '@/components/editor/editor-toolbar';
import SectionSidebar from '@/components/editor/section-sidebar';
import CommentPanel from '@/components/editor/comment-panel';
import { useRealtimeComments, usePresence } from '@/lib/hooks/use-realtime';
import CommentTrigger from '@/components/editor/comment-trigger';

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
  const [isOwner, setIsOwner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectionData, setSelectionData] = useState<{
    text: string;
    blockId: string;
    rect: { top: number; right: number; bottom: number; left: number };
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const iframeRenderedRef = useRef(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Realtime: live comments + presence
  const { mergeComments } = useRealtimeComments(proposal?.id || null);
  const onlineUsers = usePresence(proposal?.id || null, userEmail);

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
      setUserEmail(user.email || null);
      setUserId(user.id);

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
      setIsOwner(proposalData.created_by === user.id);
      setLoading(false);
    }

    fetchData();
  }, [slug, supabase, router]);

  // Render proposal in iframe — ONCE on initial load only.
  // Block edits update the iframe DOM directly via contentEditable,
  // so re-rendering the iframe would destroy the user's cursor/selection and flash.
  useEffect(() => {
    if (!proposal || blocks.length === 0 || iframeRenderedRef.current) return;
    iframeRenderedRef.current = true;
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

    /* Force all content visible in editor — no animations, no flashing */
    .reveal, [class*="reveal"], [class*="animate"], [class*="fade"] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
    }
    /* Kill SVG declarative animations in edit mode */
    animate, animateTransform, animateMotion, set {
      display: none !important;
    }
    /* Force all SVG elements to full opacity (override <animate> from="0") */
    svg path, svg rect, svg circle, svg text, svg g {
      opacity: 1 !important;
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

      // Auto-resize with debounce to prevent flash from rapid height changes
      let resizeTimer: ReturnType<typeof setTimeout>;
      function syncHeight() {
        if (!iframe || !doc?.body) return;
        iframe.style.height = `${Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) + 50}px`;
      }
      syncHeight();

      const resizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncHeight, 100);
      });
      resizeObserver.observe(doc.body);

      // Set up editable elements — ONLY if user is the owner
      if (isOwner) {
        setupEditableElements(doc);
      }

      // Text selection listener — ALL users can highlight text for comments
      doc.addEventListener('mouseup', () => {
        const sel = doc.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectionData(null);
          return;
        }

        const text = sel.toString().trim().slice(0, 500);
        const range = sel.getRangeAt(0);

        // Find which block this selection is in
        const startEl = range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : range.startContainer as HTMLElement;
        const blockEl = startEl?.closest('[data-block-id]');
        if (!blockEl) return;

        const blockId = blockEl.getAttribute('data-block-id')!;
        const rect = range.getBoundingClientRect();

        // Offset by iframe position
        const iframeRect = iframe.getBoundingClientRect();
        setSelectionData({
          text,
          blockId,
          rect: {
            top: rect.top + iframeRect.top,
            right: rect.right + iframeRect.left,
            bottom: rect.bottom + iframeRect.top,
            left: rect.left + iframeRect.left,
          },
        });
      });

      // Render existing highlights
      renderHighlights(doc, mergeComments(comments));

      iframe.removeEventListener('load', onLoad);
    };

    iframe.addEventListener('load', onLoad);
  }

  function setupEditableElements(doc: Document) {
    // Tags that should never be editable
    const skipTags = new Set([
      'script', 'style', 'link', 'meta', 'path', 'line', 'circle',
      'rect', 'polygon', 'polyline', 'defs', 'clippath', 'use',
      'animate', 'animatetransform', 'animatemotion', 'set',
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

  // SVG containers to walk into (looking for <text> elements)
  const svgContainerTags = new Set(['svg', 'g']);

  /** Walk the DOM tree and mark text elements as editable */
  function markEditableLeaves(
    el: HTMLElement,
    blockId: string,
    skipTags: Set<string>,
    containerTags: Set<string>,
    doc: Document,
  ) {
    // Inline tags that DON'T indicate the parent should be walked into
    const inlineTags = new Set([
      'strong', 'em', 'b', 'i', 'u', 'mark', 'small', 'sub', 'sup',
      'span', 'a', 'abbr', 'cite', 'code', 'kbd', 'samp', 'var', 'time',
    ]);

    for (const child of Array.from(el.children)) {
      const htmlChild = child as HTMLElement;
      const tag = child.tagName.toLowerCase();

      if (skipTags.has(tag)) continue;
      if (htmlChild.getAttribute('data-editable')) continue;

      // SVG containers: walk into them looking for <text> elements
      if (svgContainerTags.has(tag)) {
        markEditableLeaves(htmlChild, blockId, skipTags, containerTags, doc);
        continue;
      }

      // SVG <text> elements: make editable directly
      if (tag === 'text' && htmlChild.textContent?.trim()) {
        makeEditable(htmlChild, blockId, doc);
        continue;
      }

      const hasDirectText = Array.from(child.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
      );

      // Check what kinds of children this element has
      const childEls = Array.from(child.children);
      const hasBlockChildren = childEls.some(
        (c) => !inlineTags.has(c.tagName.toLowerCase()) && !skipTags.has(c.tagName.toLowerCase())
      );
      const hasOnlyInlineChildren = childEls.length > 0 && !hasBlockChildren;

      // Case 1: Element with only text (no children) — always editable
      // Case 2: Element with text + only inline children (strong, em, span, a) — editable as unit
      // Case 3: Non-container with any content — editable
      if (
        (hasDirectText && childEls.length === 0) ||
        (hasDirectText && hasOnlyInlineChildren) ||
        (!containerTags.has(tag) && htmlChild.textContent?.trim())
      ) {
        makeEditable(htmlChild, blockId, doc);
      } else if (containerTags.has(tag) && !hasBlockChildren && htmlChild.textContent?.trim()) {
        // Container with only text or inline children — editable as unit
        makeEditable(htmlChild, blockId, doc);
      } else {
        // Walk deeper into structural containers
        markEditableLeaves(htmlChild, blockId, skipTags, containerTags, doc);
      }
    }
  }

  function makeEditable(el: HTMLElement, blockId: string, doc: Document) {
    el.setAttribute('data-editable', 'true');
    el.setAttribute('data-block-id-ref', blockId);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditing(el, blockId, doc);
    });
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
          // Include expected_updated_at for conflict detection
          const block = blocks.find((b) => b.id === blockId);
          const res = await fetch(`/api/blocks/${blockId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current_html: updatedHtml,
              expected_updated_at: block?.updated_at,
            }),
          });

          if (res.status === 409) {
            // Conflict — someone else edited this block
            setSaveStatus('error');
            const data = await res.json();
            alert(data.message || 'This section was edited by someone else. Reload to see their changes.');
            return;
          }

          if (!res.ok) throw new Error('Save failed');

          const updated = await res.json();

          // Update local state with server's updated_at for next save
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === blockId ? { ...b, current_html: updatedHtml, updated_at: updated.updated_at } : b
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

  async function handleRevertBlock(blockId: string) {
    try {
      const res = await fetch(`/api/blocks/${blockId}/revert`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to revert');
      const reverted = await res.json();
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, current_html: reverted.current_html } : b))
      );
    } catch {
      // Silently fail — block stays as-is
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

  async function handleAddComment(blockId: string | null, text: string, selectedText?: string) {
    if (!proposal) return;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposal.id,
          block_id: blockId,
          text,
          selected_text: selectedText || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to add comment');

      const comment = await res.json();
      setComments((prev) => [...prev, comment]);

      // Render the new highlight in the iframe
      const iframe = iframeRef.current;
      if (iframe?.contentDocument && selectedText) {
        renderHighlights(iframe.contentDocument, [comment]);
      }

      // Clear selection
      setSelectionData(null);
    } catch {
      // Handle error
    }
  }

  /** Render yellow highlights in the iframe for comments with selected_text */
  function renderHighlights(doc: Document, commentsToHighlight: Comment[]) {
    commentsToHighlight.forEach((comment) => {
      if (!comment.selected_text || comment.resolved || !comment.block_id) return;

      // Don't duplicate highlights
      if (doc.querySelector(`[data-comment-id="${comment.id}"]`)) return;

      const blockEl = doc.querySelector(`[data-block-id="${comment.block_id}"]`);
      if (!blockEl) return;

      highlightTextInElement(blockEl as HTMLElement, comment.selected_text, comment.id, doc);
    });
  }

  /** Find and wrap matching text in a DOM element with a <mark> tag */
  function highlightTextInElement(root: HTMLElement, searchText: string, commentId: string, doc: Document) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // Build full text and find the match
    let fullText = '';
    const nodeMap: { node: Text; start: number; end: number }[] = [];
    for (const tn of textNodes) {
      const start = fullText.length;
      fullText += tn.textContent || '';
      nodeMap.push({ node: tn, start, end: fullText.length });
    }

    const matchIndex = fullText.indexOf(searchText);
    if (matchIndex === -1) return;

    const matchEnd = matchIndex + searchText.length;

    // Find which text nodes the match spans
    for (const { node: tn, start, end } of nodeMap) {
      if (end <= matchIndex || start >= matchEnd) continue;

      const localStart = Math.max(0, matchIndex - start);
      const localEnd = Math.min(tn.textContent!.length, matchEnd - start);

      const range = doc.createRange();
      range.setStart(tn, localStart);
      range.setEnd(tn, localEnd);

      const mark = doc.createElement('mark');
      mark.setAttribute('data-comment-id', commentId);
      mark.style.background = 'rgba(255, 213, 79, 0.35)';
      mark.style.borderBottom = '2px solid rgba(245, 166, 35, 0.6)';
      mark.style.cursor = 'pointer';
      mark.style.borderRadius = '2px';
      mark.style.padding = '1px 0';

      mark.addEventListener('click', () => {
        // Scroll comment panel to this comment
        setShowComments(true);
        setTimeout(() => {
          const commentEl = document.querySelector(`[data-comment-thread="${commentId}"]`);
          commentEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });

      range.surroundContents(mark);
      break; // Only highlight first occurrence
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
      <div className="min-h-screen bg-zinc-950">
        {/* Skeleton toolbar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-zinc-900/95 border-b border-zinc-800 px-4 flex items-center gap-4">
          <div className="w-12 h-6 bg-zinc-800 rounded animate-pulse" />
          <div className="w-40 h-5 bg-zinc-800 rounded animate-pulse" />
          <div className="flex-1" />
          <div className="w-20 h-7 bg-zinc-800 rounded animate-pulse" />
        </div>
        {/* Skeleton content */}
        <div className="pt-14 max-w-4xl mx-auto px-6 py-12 space-y-6">
          <div className="h-8 bg-zinc-900 rounded-lg w-3/4 animate-pulse" />
          <div className="h-4 bg-zinc-900 rounded w-1/2 animate-pulse" />
          <div className="h-64 bg-zinc-900 rounded-lg animate-pulse" />
          <div className="h-32 bg-zinc-900 rounded-lg animate-pulse" />
          <div className="h-48 bg-zinc-900 rounded-lg animate-pulse" />
        </div>
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
        onlineUsers={onlineUsers}
        currentUserEmail={userEmail}
      />

      {/* Sidebar panels */}
      <SectionSidebar
        open={showSections}
        blocks={blocks}
        onClose={() => setShowSections(false)}
        onToggleVisibility={handleToggleVisibility}
        onRevertBlock={handleRevertBlock}
      />

      <CommentPanel
        open={showComments}
        comments={mergeComments(comments)}
        blocks={blocks}
        onClose={() => setShowComments(false)}
        onAddComment={handleAddComment}
        onResolveComment={handleResolveComment}
      />

      {/* Floating comment trigger — appears when text is selected */}
      {selectionData && (
        <CommentTrigger
          selectionData={selectionData}
          onSubmit={(blockId, commentText, selectedText) => {
            handleAddComment(blockId, commentText, selectedText);
          }}
          onDismiss={() => setSelectionData(null)}
        />
      )}

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

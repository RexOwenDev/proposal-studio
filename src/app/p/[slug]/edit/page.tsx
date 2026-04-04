'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, ContentBlock, Comment } from '@/lib/types';
import EditorToolbar from '@/components/editor/editor-toolbar';
import SectionSidebar from '@/components/editor/section-sidebar';
import CommentPanel from '@/components/editor/comment-panel';
import { useRealtimeComments, useRealtimeBlocks, usePresence } from '@/lib/hooks/use-realtime';
import { getUserColor } from '@/lib/user-colors';
import CommentTrigger from '@/components/editor/comment-trigger';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { wrapScripts } from '@/lib/utils/wrap-scripts';

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null); // H4
  const { toasts, showToast, dismissToast } = useToast();
  const [selectionData, setSelectionData] = useState<{
    text: string;
    blockId: string;
    rect: { top: number; right: number; bottom: number; left: number };
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const iframeRenderedRef = useRef(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();

  // R3: comment notification callback — stable ref so it doesn't re-trigger the subscription
  const onNewCommentFromOther = useCallback((comment: Comment) => {
    const sectionName = comment.block_id
      ? blocks.find((b) => b.id === comment.block_id)?.label || 'a section'
      : 'the proposal';
    showToast(
      `${comment.author_name} commented on ${sectionName}`,
      'info',
      { label: 'View', onClick: () => setShowComments(true) },
    );
  }, [blocks, showToast]);

  // Realtime: live comments + presence
  const { liveComments, mergeComments } = useRealtimeComments(proposal?.id || null, {
    currentUserId: userId,
    onNewCommentFromOther,
  });
  const { liveBlockUpdates } = useRealtimeBlocks(proposal?.id || null);
  const { onlineUsers, typingUsers, editingUsers, setTyping, setEditingBlock } = usePresence(proposal?.id || null, userEmail);

  // Re-render highlights when new realtime comments arrive
  useEffect(() => {
    if (liveComments.length === 0) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    renderHighlights(iframe.contentDocument, liveComments);
  }, [liveComments]);

  // Surgically apply live block changes (visibility, html) from any user.
  // We patch the iframe DOM directly — no full re-render — to avoid losing
  // scroll position, contentEditable cursor state, and running scripts again.
  useEffect(() => {
    if (liveBlockUpdates.length === 0) return;
    const latest = liveBlockUpdates[liveBlockUpdates.length - 1];

    // Keep local blocks state in sync
    setBlocks((prev) => prev.map((b) => (b.id === latest.id ? { ...b, ...latest } : b)));

    // Patch the iframe DOM in place
    const iframe = iframeRef.current;
    if (iframe?.contentDocument) {
      const el = iframe.contentDocument.querySelector(
        `[data-block-id="${latest.id}"]`
      ) as HTMLElement | null;
      if (el) {
        el.setAttribute('data-hidden', String(!latest.visible));
        el.style.opacity = latest.visible ? '' : '0.35';
        el.style.position = latest.visible ? '' : 'relative';
      }
    }
  }, [liveBlockUpdates]);

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

      // Fetch team members for @mentions
      fetch('/api/team').then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setTeamMembers(data);
      });

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

  // R2: Refs initialised without saveBlockContent (which is declared later via useCallback).
  // The effect that keeps saveBlockRef.current in sync is placed after saveBlockContent below.
  const saveBlockRef = useRef<((blockId: string, doc: Document) => void) | null>(null);
  const editingBlockIdRef = useRef<string | null>(null);
  // Keep a ref to the latest blocks so saveBlockContent always reads current updated_at
  // (useCallback with [] would capture a stale snapshot causing false 409 conflicts)
  const blocksRef = useRef<ContentBlock[]>([]);
  useEffect(() => { editingBlockIdRef.current = editingBlockId; }, [editingBlockId]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // H4: Detect media elements in proposal blocks and show a one-time warning
  useEffect(() => {
    if (blocks.length === 0) return;
    const allHtml = blocks.map((b) => b.original_html).join(' ');
    const hasMedia =
      /<canvas[\s>]/i.test(allHtml) ||
      /<video[\s>]/i.test(allHtml) ||
      /<audio[\s>]/i.test(allHtml) ||
      /<iframe[\s>]/i.test(allHtml);
    if (hasMedia) {
      setMediaWarning('This proposal contains media elements (video, audio, canvas, or nested iframes) that may not render fully in the editor.');
    }
  }, [blocks]);

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

    /* ── EDITOR: Snap all animations to their final frame instantly ─────────
       Dark-theme and animation-heavy HTML files start elements at opacity:0
       and rely on CSS @keyframes to reveal them. Killing animations (none)
       leaves them invisible. Instead we snap every animation to completion
       in 0.001ms — fill-mode:forwards then holds the final (visible) state.
       animation-iteration-count:1 prevents infinite spinners from looping. */
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0ms !important;
    }
    /* Belt-and-suspenders for class-named reveal elements */
    .reveal, [class*="reveal"], [class*="animate"], [class*="fade"] {
      opacity: 1 !important;
      transform: none !important;
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
  <script>
  /* Editor reveal safety net — mops up any element still at opacity:0
     after the animation-snap approach above (e.g. inline style opacity:0
     without a forwards fill-mode animation). Runs after DOMContentLoaded. */
  (function () {
    function forceRevealHidden() {
      document.querySelectorAll('body *').forEach(function (el) {
        var tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return;
        var cs = window.getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.05) {
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('transform', 'none', 'important');
        }
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', forceRevealHidden);
    } else {
      forceRevealHidden();
    }
  })();
  </script>
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

      // Text selection listener — works on desktop (mouseup) AND touch devices (touchend)
      function handleTextSelection() {
        // Small delay for touch devices — selection isn't ready immediately on touchend
        setTimeout(() => {
          if (!doc) return;
          const sel = doc.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim()) {
            setSelectionData(null);
            return;
          }

          const text = sel.toString().trim().slice(0, 500);
          const range = sel.getRangeAt(0);

          const startEl = range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : range.startContainer as HTMLElement;
          const blockEl = startEl?.closest('[data-block-id]');
          if (!blockEl) return;

          const blockId = blockEl.getAttribute('data-block-id')!;
          const rect = range.getBoundingClientRect();
          if (!iframe) return;
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
        }, 10);
      }

      doc.addEventListener('mouseup', handleTextSelection);
      doc.addEventListener('touchend', handleTextSelection);

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
    setEditingBlock(blockId); // R1: broadcast to teammates

    // Save on blur
    const handleBlur = () => {
      el.contentEditable = 'false';
      el.classList.remove('editing');
      el.removeEventListener('blur', handleBlur);
      el.removeEventListener('keydown', handleKeydown);
      saveBlockContent(blockId, doc);
      setEditingBlockId(null);
      setEditingBlock(null); // R1: clear editing lock
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

        // Clone to avoid mutating the live DOM, then strip ALL editor-only
        // artifacts before persisting. Three categories:
        //   (a) <mark data-comment-id> — comment highlight wrappers
        //   (b) data-editable / data-block-id-ref — editor targeting attributes
        //   (c) contenteditable / class="editing" — active-edit state attributes
        const blockClone = blockEl.cloneNode(true) as HTMLElement;

        // (a) Unwrap comment highlight marks — move children out, delete the mark
        blockClone.querySelectorAll('mark[data-comment-id]').forEach((mark) => {
          const parent = mark.parentNode!;
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
          parent.removeChild(mark);
          parent.normalize();
        });

        // (b) + (c) Strip all editor-only attributes from every element in the clone
        blockClone.querySelectorAll('*').forEach((el) => {
          el.removeAttribute('data-editable');
          el.removeAttribute('data-block-id-ref');
          el.removeAttribute('contenteditable');
          el.classList.remove('editing');
          // Remove class attr entirely if it's now empty
          if (el.getAttribute('class') === '') el.removeAttribute('class');
        });

        const updatedHtml = blockClone.innerHTML;

        try {
          // Include expected_updated_at for conflict detection
          // Use blocksRef (not the closed-over 'blocks') so we always read the
          // latest updated_at after previous saves — avoids false 409 conflicts.
          const block = blocksRef.current.find((b) => b.id === blockId);
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
            showToast(
              data.message || 'This section was edited by someone else.',
              'warning',
              { label: 'Reload', onClick: () => window.location.reload() },
            );
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
          showToast('Failed to save changes. Please try again.', 'error');
        }
      }, 500); // 500ms debounce
    },
    []
  );

  // R2: Keep ref in sync with the latest saveBlockContent closure (declared above)
  useEffect(() => { saveBlockRef.current = saveBlockContent; }, [saveBlockContent]);

  // R2: Periodic auto-save every 30s — one stable interval for the whole session
  useEffect(() => {
    const id = setInterval(() => {
      const blockId = editingBlockIdRef.current;
      const doc = iframeRef.current?.contentDocument;
      if (blockId && doc) saveBlockRef.current?.(blockId, doc);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // R2: Save on tab hide + before-unload (best-effort)
  useEffect(() => {
    function saveIfEditing() {
      const blockId = editingBlockIdRef.current;
      const doc = iframeRef.current?.contentDocument;
      if (blockId && doc) saveBlockRef.current?.(blockId, doc);
    }
    document.addEventListener('visibilitychange', saveIfEditing);
    window.addEventListener('beforeunload', saveIfEditing);
    return () => {
      document.removeEventListener('visibilitychange', saveIfEditing);
      window.removeEventListener('beforeunload', saveIfEditing);
    };
  }, []);

  async function handleToggleVisibility(blockId: string, visible: boolean) {
    try {
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      });

      if (!res.ok) throw new Error('Failed to toggle visibility');

      // Update sidebar state
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, visible } : b)));

      // Immediately reflect in the owner's own iframe (no re-render needed)
      const iframe = iframeRef.current;
      if (iframe?.contentDocument) {
        const el = iframe.contentDocument.querySelector(
          `[data-block-id="${blockId}"]`
        ) as HTMLElement | null;
        if (el) {
          el.setAttribute('data-hidden', String(!visible));
          el.style.opacity = visible ? '' : '0.35';
          el.style.position = visible ? '' : 'relative';
        }
      }
    } catch {
      showToast('Failed to toggle section visibility.', 'error');
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
      showToast('Section reverted to original.', 'success');
    } catch {
      showToast('Failed to revert section. Please try again.', 'error');
    }
  }

  async function handleSetStatus(newStatus: string) {
    if (!proposal) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      setProposal({ ...proposal, status: updated.status });
      const labels: Record<string, string> = {
        review: 'Submitted for review.',
        approved: 'Proposal approved.',
        published: 'Proposal published.',
        draft: 'Proposal moved back to draft.',
      };
      showToast(labels[newStatus] || 'Status updated.', 'success');
    } catch {
      showToast('Failed to update status. Please try again.', 'error');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePublish(publish: boolean) {
    if (!proposal) return;
    await handleSetStatus(publish ? 'published' : 'draft');
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
      showToast('Failed to post comment. Please try again.', 'error');
    }
  }

  async function handleAddReply(parentId: string, text: string) {
    if (!proposal) return;

    // Find the parent comment to get its proposal_id and block_id
    const parent = comments.find((c) => c.id === parentId);
    if (!parent) return;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposal.id,
          block_id: parent.block_id,
          parent_id: parentId,
          text,
        }),
      });

      if (!res.ok) throw new Error('Failed to add reply');

      const reply = await res.json();
      setComments((prev) => [...prev, reply]);
    } catch {
      showToast('Failed to post reply. Please try again.', 'error');
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/comments?id=${commentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      // Remove from local state (also removes replies whose parent is deleted)
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));

      // Remove any iframe highlight marks for this comment
      const iframe = iframeRef.current;
      const iframeDoc = iframe?.contentDocument;
      if (iframeDoc) {
        iframeDoc
          .querySelectorAll(`[data-comment-id="${commentId}"]`)
          .forEach((el) => {
            const parent = el.parentNode;
            if (parent) {
              parent.replaceChild(iframeDoc.createTextNode(el.textContent || ''), el);
              parent.normalize();
            }
          });
      }
    } catch {
      showToast('Failed to delete comment. Please try again.', 'error');
    }
  }

  async function handleEditComment(commentId: string, text: string) {
    try {
      const res = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId, text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          showToast('You can only edit your own comments.', 'error');
        } else {
          showToast(data.error || 'Failed to save edit. Please try again.', 'error');
        }
        return;
      }
      const updated = await res.json();
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, text: updated.text, edited_at: updated.edited_at } : c));
    } catch {
      showToast('Failed to save edit. Please try again.', 'error');
    }
  }

  /** Render highlights in the iframe for comments with selected_text */
  function renderHighlights(doc: Document, commentsToHighlight: Comment[]) {
    commentsToHighlight.forEach((comment) => {
      if (!comment.selected_text || comment.resolved || !comment.block_id) return;
      if (!comment.parent_id) {
        // Only render highlights for top-level comments (not replies)
        if (doc.querySelector(`[data-comment-id="${comment.id}"]`)) return;

        const blockEl = doc.querySelector(`[data-block-id="${comment.block_id}"]`);
        if (!blockEl) return;

        const color = getUserColor(comment.author_name || 'unknown');
        highlightTextInElement(blockEl as HTMLElement, comment.selected_text, comment.id, color, doc);
      }
    });
  }

  /** Find and wrap matching text with a colored <mark> tag.
   *
   * Uses splitText() + replaceChild() per text node instead of
   * Range.surroundContents() — works correctly across element boundaries
   * (e.g. selections spanning <strong>, <em>, <span> siblings).
   */
  function highlightTextInElement(
    root: HTMLElement,
    searchText: string,
    commentId: string,
    color: { bg: string; border: string },
    doc: Document,
  ) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // Build full text from all text nodes
    let fullText = '';
    const nodeMap: { node: Text; start: number; end: number }[] = [];
    for (const tn of textNodes) {
      const start = fullText.length;
      fullText += tn.textContent || '';
      nodeMap.push({ node: tn, start, end: fullText.length });
    }

    // Normalize whitespace for matching: collapse multiple spaces/newlines
    const normalizedFull = fullText.replace(/\s+/g, ' ');
    const normalizedSearch = searchText.replace(/\s+/g, ' ').trim();

    // Try exact match first, then normalized, then case-insensitive
    let matchIndex = fullText.indexOf(searchText);
    let matchLength = searchText.length;

    if (matchIndex === -1) {
      matchIndex = normalizedFull.indexOf(normalizedSearch);
      matchLength = normalizedSearch.length;
    }
    if (matchIndex === -1) {
      matchIndex = normalizedFull.toLowerCase().indexOf(normalizedSearch.toLowerCase());
      matchLength = normalizedSearch.length;
    }
    if (matchIndex === -1) return;

    const matchEnd = matchIndex + matchLength;

    // Find ALL text nodes that overlap with [matchIndex, matchEnd]
    const overlapping = nodeMap.filter(({ start, end }) => !(end <= matchIndex || start >= matchEnd));

    // Wrap each overlapping text node using splitText() — no surroundContents().
    // This correctly handles selections that span multiple inline elements.
    for (const { node: tn, start } of overlapping) {
      try {
        const localStart = Math.max(0, matchIndex - start);
        const localEnd = Math.min((tn.textContent || '').length, matchEnd - start);

        // Isolate the portion to highlight by splitting the text node
        let nodeToWrap: Text = tn;
        if (localStart > 0) nodeToWrap = tn.splitText(localStart);
        const wrapLength = localEnd - localStart;
        if (wrapLength < (nodeToWrap.textContent || '').length) nodeToWrap.splitText(wrapLength);

        if (!nodeToWrap.parentNode) continue;

        const mark = doc.createElement('mark');
        mark.setAttribute('data-comment-id', commentId);
        mark.className = 'ps-highlight';
        mark.style.background = color.bg;
        mark.style.borderBottom = `2px solid ${color.border}`;
        mark.style.cursor = 'pointer';
        mark.style.borderRadius = '2px';
        mark.style.padding = '1px 0';
        mark.style.transition = 'background 0.2s ease';

        // Highlight click → open comment panel + scroll to comment thread
        mark.addEventListener('click', () => {
          setShowComments(true);
          // Wait for panel animation before scrolling
          setTimeout(() => {
            const commentEl = document.querySelector(`[data-comment-thread="${commentId}"]`);
            if (commentEl) {
              commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Brief flash on the comment card so it's obvious which one
              (commentEl as HTMLElement).style.transition = 'box-shadow 0.2s ease';
              (commentEl as HTMLElement).style.boxShadow = '0 0 0 2px rgba(251,191,36,0.8)';
              setTimeout(() => { (commentEl as HTMLElement).style.boxShadow = ''; }, 1200);
            }
          }, 180);
        });

        nodeToWrap.parentNode.replaceChild(mark, nodeToWrap);
        mark.appendChild(nodeToWrap);
      } catch {
        // Skip on any DOM manipulation error
      }
    }
  }

  /** Scroll the iframe to a specific highlight by comment ID */
  function scrollToHighlight(commentId: string) {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    const mark = iframe.contentDocument.querySelector(`[data-comment-id="${commentId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash effect
      const el = mark as HTMLElement;
      const originalBg = el.style.background;
      el.style.background = 'rgba(255, 255, 0, 0.6)';
      setTimeout(() => { el.style.background = originalBg; }, 1500);
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
      showToast('Failed to update comment. Please try again.', 'error');
    }
  }

  async function handleReaction(commentId: string, emoji: string) {
    if (!userEmail) return;
    const reactor = userEmail.split('@')[0];

    // Optimistic update
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const reactions = { ...(c.reactions || {}) };
        const users = reactions[emoji] || [];
        if (users.includes(reactor)) {
          reactions[emoji] = users.filter((u) => u !== reactor);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...users, reactor];
        }
        return { ...c, reactions };
      })
    );

    // Persist
    await fetch('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId, reaction: emoji, reactor }),
    });
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
        onSetStatus={handleSetStatus}
        onExportPDF={() => iframeRef.current?.contentWindow?.print()}
        onBack={() => router.push('/')}
        slug={proposal.slug}
        proposalId={proposal.id}
        onlineUsers={onlineUsers}
        currentUserEmail={userEmail}
        isPublishing={isPublishing}
      />

      {/* Sidebar panels */}
      <SectionSidebar
        open={showSections}
        blocks={blocks}
        onClose={() => setShowSections(false)}
        onToggleVisibility={handleToggleVisibility}
        onRevertBlock={handleRevertBlock}
        editingUsers={editingUsers}
      />

      <CommentPanel
        open={showComments}
        comments={mergeComments(comments)}
        blocks={blocks}
        teamMembers={teamMembers}
        onClose={() => setShowComments(false)}
        onAddComment={handleAddComment}
        onAddReply={handleAddReply}
        onResolveComment={handleResolveComment}
        onReaction={handleReaction}
        onScrollToHighlight={scrollToHighlight}
        onDeleteComment={handleDeleteComment}
        onEditComment={handleEditComment}
        typingUsers={typingUsers}
        onTypingChange={setTyping}
        currentUser={userEmail?.split('@')[0] || ''}
        currentUserId={userId || ''}
        isOwner={isOwner}
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

      {/* H4: Media element compatibility warning */}
      {mediaWarning && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-amber-950/90 border-b border-amber-800 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-amber-300 text-xs">{mediaWarning}</p>
          <button
            onClick={() => setMediaWarning(null)}
            className="text-amber-500 hover:text-amber-300 text-sm shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Proposal content in iframe */}
      <div className="pt-14">
        <iframe
          ref={iframeRef}
          className="w-full border-0"
          style={{ minHeight: '100vh' }}
          title="Proposal Editor"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}


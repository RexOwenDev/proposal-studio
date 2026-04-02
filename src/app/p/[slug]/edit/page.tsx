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

  function renderIframe() {
    const iframe = iframeRef.current;
    if (!iframe || !proposal) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Extract preconnect links from stylesheet
    let preconnectLinks = '';
    let cssContent = proposal.stylesheet || '';

    if (cssContent.includes('<!-- Font preconnects -->')) {
      const parts = cssContent.split('\n\n');
      const preconnectPart = parts.find((p) => p.includes('<link'));
      if (preconnectPart) {
        preconnectLinks = preconnectPart.replace('<!-- Font preconnects -->', '').trim();
        cssContent = parts.filter((p) => !p.includes('<link')).join('\n\n');
      }
    }

    const blocksHTML = blocks
      .map((block) =>
        `<div data-block-id="${block.id}" data-hidden="${!block.visible}" style="${!block.visible ? 'opacity: 0.35; position: relative;' : ''}">${block.current_html}</div>`
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${preconnectLinks}
  <style>
    ${cssContent}

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
  ${blocksHTML}
  ${proposal.scripts ? `<script>${proposal.scripts}<\/script>` : ''}
</body>
</html>`;

    doc.open();
    doc.write(html);
    doc.close();

    // Auto-resize
    setTimeout(() => {
      if (doc.body) {
        iframe.style.height = `${doc.body.scrollHeight + 50}px`;
      }
    }, 200);

    // Set up editable elements
    setTimeout(() => setupEditableElements(doc), 300);
  }

  function setupEditableElements(doc: Document) {
    const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'span', 'a'];
    const editableSelector = editableTags.join(', ');

    doc.querySelectorAll('[data-block-id]').forEach((blockEl) => {
      const blockId = blockEl.getAttribute('data-block-id')!;

      blockEl.querySelectorAll(editableSelector).forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Skip elements that only contain other editable elements (no direct text)
        if (!htmlEl.textContent?.trim()) return;
        // Skip elements that are purely structural
        if (htmlEl.children.length > 0 && !htmlEl.childNodes[0]?.textContent?.trim()) return;

        htmlEl.setAttribute('data-editable', 'true');
        htmlEl.setAttribute('data-block-id-ref', blockId);

        htmlEl.addEventListener('click', (e) => {
          e.stopPropagation();
          startEditing(htmlEl, blockId, doc);
        });
      });
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
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}

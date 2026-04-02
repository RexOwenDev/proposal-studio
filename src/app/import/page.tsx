'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedBlock } from '@/lib/types';

interface ParsePreview {
  title: string;
  blocks: ParsedBlock[];
  stylesheet: string;
}

export default function ImportPage() {
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'parsed' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setHtml(content);

      // Auto-detect title from HTML
      const match = content.match(/<title[^>]*>(.*?)<\/title>/i);
      if (match) {
        setTitle(match[1].trim());
      }
    };
    reader.readAsText(file);
  }

  async function handleParse() {
    if (!html.trim()) return;
    setStatus('parsing');
    setErrorMsg('');

    try {
      // Client-side parse preview using DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract title
      const detectedTitle = doc.querySelector('title')?.textContent?.trim()
        || doc.querySelector('h1')?.textContent?.trim()
        || 'Untitled Proposal';

      if (!title) setTitle(detectedTitle);

      // Extract styles
      const styles: string[] = [];
      doc.querySelectorAll('style').forEach((el) => {
        if (el.textContent?.trim()) styles.push(el.textContent);
      });

      // Split body into blocks (simplified client-side version)
      const blocks: ParsedBlock[] = [];
      let order = 0;

      function processChildren(parent: Element) {
        Array.from(parent.children).forEach((child) => {
          const tag = child.tagName.toLowerCase();
          if (!child.innerHTML?.trim()) return;

          // Detect wrapper divs
          const className = child.className || '';
          const isWrapper = tag === 'div' && /wrap|container|content/i.test(className);

          if (isWrapper) {
            processChildren(child);
          } else {
            const label = detectLabel(child, tag, order);
            blocks.push({
              order: order++,
              label,
              html: child.outerHTML,
            });
          }
        });
      }

      processChildren(doc.body);

      setPreview({ title: title || detectedTitle, blocks, stylesheet: styles.join('\n') });
      setStatus('parsed');
    } catch {
      setStatus('error');
      setErrorMsg('Failed to parse HTML. Make sure it includes valid HTML tags.');
    }
  }

  async function handleCreate() {
    setStatus('creating');
    setErrorMsg('');

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, title }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create proposal');
      }

      const { proposal } = await res.json();
      router.push(`/p/${proposal.slug}/edit`);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create proposal');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/')}
          className="text-zinc-400 hover:text-white text-sm transition-colors"
        >
          &larr; Dashboard
        </button>
        <h1 className="text-lg font-semibold text-white">Import Proposal</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Step 1: Input */}
        {status !== 'parsed' && status !== 'creating' && (
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm text-zinc-300 mb-1.5">
                Proposal Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-detected from HTML, or type one"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="html-input" className="block text-sm text-zinc-300 mb-1.5">
                HTML Content
              </label>
              <textarea
                id="html-input"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="Paste your complete HTML here (including <html>, <head>, <style>, and <body> tags)"
                rows={16}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white placeholder:text-zinc-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleParse}
                disabled={!html.trim() || status === 'parsing'}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
              >
                {status === 'parsing' ? 'Parsing...' : 'Parse HTML'}
              </button>

              <span className="text-zinc-500 text-sm">or</span>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors border border-zinc-700"
              >
                Upload .html file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm">{errorMsg}</p>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {(status === 'parsed' || status === 'creating' || status === 'error') && preview && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white text-lg font-medium">{title || preview.title}</h2>
                <p className="text-zinc-400 text-sm mt-1">
                  {preview.blocks.length} sections detected
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStatus('idle'); setPreview(null); }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors border border-zinc-700"
                >
                  Back to Edit
                </button>
                <button
                  onClick={handleCreate}
                  disabled={status === 'creating'}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {status === 'creating' ? 'Creating...' : 'Create Proposal'}
                </button>
              </div>
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm">{errorMsg}</p>
            )}

            {/* Section list */}
            <div className="space-y-2">
              {preview.blocks.map((block) => (
                <details
                  key={block.order}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg group"
                >
                  <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm hover:bg-zinc-800/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 font-mono text-xs w-6">
                        {block.order + 1}
                      </span>
                      <span className="text-white font-medium">{block.label}</span>
                    </div>
                    <span className="text-zinc-500 text-xs">
                      {block.html.length > 100
                        ? `${(block.html.length / 1024).toFixed(1)} KB`
                        : `${block.html.length} chars`}
                    </span>
                  </summary>
                  <div className="px-4 pb-3 border-t border-zinc-800">
                    <pre className="text-xs text-zinc-400 font-mono overflow-x-auto mt-2 max-h-40 overflow-y-auto">
                      {block.html.substring(0, 500)}
                      {block.html.length > 500 && '...'}
                    </pre>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function detectLabel(el: Element, tagName: string, order: number): string {
  const id = el.id;
  if (id) {
    return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const heading = el.querySelector('h1, h2, h3');
  if (heading?.textContent) {
    const text = heading.textContent.trim();
    if (text.length < 80) return text;
  }

  const className = el.className || '';
  if (/hero/i.test(className)) return 'Hero';
  if (/header|site-header/i.test(className)) return 'Header';
  if (/footer|site-footer/i.test(className)) return 'Footer';
  if (/rule|divider|separator/i.test(className)) return 'Divider';
  if (/divider-label/i.test(className)) return el.textContent?.trim() || 'Label';

  if (tagName === 'header') return 'Header';
  if (tagName === 'footer') return 'Footer';
  if (tagName === 'nav') return 'Navigation';

  if (tagName === 'div' && (!el.textContent?.trim() || el.textContent.trim().length < 3)) {
    return 'Divider';
  }

  const sectionLabel = el.querySelector('.section-label');
  if (sectionLabel?.textContent) return sectionLabel.textContent.trim();

  return `Block ${order + 1}`;
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type TemplateType = 'client' | 'internal';
type Status = 'idle' | 'generating' | 'error';

const GENERATING_MESSAGES = [
  'Analyzing your notes…',
  'Identifying key sections…',
  'Structuring the proposal…',
  'Generating content…',
  'Building the layout…',
  'Almost there…',
];

interface Props {
  onClose: () => void;
}

export default function CreateProposalModal({ onClose }: Props) {
  const [templateType, setTemplateType] = useState<TemplateType>('client');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [draftText, setDraftText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState(GENERATING_MESSAGES[0]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Cycle through status messages while generating
  useEffect(() => {
    if (status === 'generating') {
      let i = 0;
      progressIntervalRef.current = setInterval(() => {
        i = (i + 1) % GENERATING_MESSAGES.length;
        setProgressMsg(GENERATING_MESSAGES[i]);
      }, 2200);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgressMsg(GENERATING_MESSAGES[0]);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [status]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && status !== 'generating') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status, onClose]);

  async function handleGenerate() {
    if (!draftText.trim() || draftText.trim().length < 20) return;
    setStatus('generating');
    setErrorMsg('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: draftText,
          templateType,
          title: title.trim() || undefined,
          clientName: clientName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      // Success — redirect to editor
      router.push(`/p/${data.proposal.slug}/edit`);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const canGenerate = draftText.trim().length >= 20 && status !== 'generating';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'generating') onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[92vw] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100">
          <div>
            <h2 id="modal-title" className="text-gray-900 font-semibold text-base">New Proposal</h2>
            <p className="text-gray-400 text-xs mt-0.5">Paste your notes — AI builds the proposal from them</p>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'generating'}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Generating overlay */}
        {status === 'generating' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 rounded-2xl gap-5">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-900 font-medium text-sm">{progressMsg}</p>
              <p className="text-gray-400 text-xs mt-1">This usually takes 10–20 seconds</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5">

          {/* Template type selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Template</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTemplateType('client')}
                className={`flex-1 flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3.5 rounded-xl border-2 text-left transition-all ${
                  templateType === 'client'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-lg sm:text-xl mt-0.5 shrink-0">📄</span>
                <div>
                  <div className={`text-xs sm:text-sm font-semibold ${templateType === 'client' ? 'text-blue-700' : 'text-gray-800'}`}>Client Proposal</div>
                  <div className="text-xs text-gray-400 mt-0.5 hidden sm:block">Branded, visual, sent to clients</div>
                </div>
              </button>
              <button
                onClick={() => setTemplateType('internal')}
                className={`flex-1 flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3.5 rounded-xl border-2 text-left transition-all ${
                  templateType === 'internal'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-lg sm:text-xl mt-0.5 shrink-0">🗂️</span>
                <div>
                  <div className={`text-xs sm:text-sm font-semibold ${templateType === 'internal' ? 'text-blue-700' : 'text-gray-800'}`}>Internal Doc</div>
                  <div className="text-xs text-gray-400 mt-0.5 hidden sm:block">Technical reference for the team</div>
                </div>
              </button>
            </div>
          </div>

          {/* Title + Client name */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <div className="flex-1">
              <label htmlFor="ps-title" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Project Title <span className="text-gray-300 font-normal normal-case">(optional)</span>
              </label>
              <input
                id="ps-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sales Automation Buildout"
                disabled={status === 'generating'}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
              />
            </div>
            {templateType === 'client' && (
              <div className="flex-1">
                <label htmlFor="ps-client" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Client Name <span className="text-gray-300 font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="ps-client"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  disabled={status === 'generating'}
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
                />
              </div>
            )}
          </div>

          {/* Draft text */}
          <div>
            <label htmlFor="ps-draft" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Paste Your Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              id="ps-draft"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={templateType === 'client'
                ? "Paste anything — emails, meeting notes, Slack threads, bullet points. Just include what you know about the client and the project.\n\nExample: Client is ACME Corp, losing leads because follow-up is manual. Building a 3-step automation: lead capture → AI qualification email → CRM entry. 4 weeks, around $8k. They liked the demo."
                : "Paste anything — Slack threads, meeting notes, bullet points. Include the client, goal, tools involved, and current status.\n\nExample: Client is ACME. Goal is automated lead qualification. Using n8n + Claude + HubSpot. Phase 1 done, Phase 2 in progress. Key decision: webhook trigger not email polling."
              }
              rows={9}
              maxLength={20000}
              disabled={status === 'generating'}
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y disabled:opacity-50 leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-gray-400">The more detail you give, the better the output. No need for perfect formatting.</p>
              <span className={`text-xs tabular-nums ${draftText.length > 18000 ? 'text-red-400' : 'text-gray-400'}`}>
                {draftText.length.toLocaleString()} / 20,000
              </span>
            </div>
          </div>

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
              </svg>
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-100 bg-gray-50/60">
          <button
            onClick={onClose}
            disabled={status === 'generating'}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:shadow-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

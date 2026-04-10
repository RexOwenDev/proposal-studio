// src/components/proposal/accept-proposal-button.tsx
'use client';

import { useState } from 'react';
import type { ProposalAcceptance } from '@/lib/types';

type AcceptState = 'idle' | 'confirming' | 'submitting' | 'accepted' | 'already_accepted';

interface Props {
  proposalId: string;
  existingAcceptance?: ProposalAcceptance | null;
}

export default function AcceptProposalButton({ proposalId, existingAcceptance }: Props) {
  const [state, setState] = useState<AcceptState>(
    existingAcceptance ? 'already_accepted' : 'idle'
  );
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedInfo, setAcceptedInfo] = useState<{ name: string; at: string } | null>(
    existingAcceptance
      ? { name: existingAcceptance.client_name, at: existingAcceptance.accepted_at }
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
        }),
      });

      if (res.status === 201) {
        const { accepted_at } = await res.json() as { accepted_at: string };
        setAcceptedInfo({ name: clientName.trim(), at: accepted_at });
        setState('accepted');
        return;
      }

      if (res.status === 409) {
        setState('already_accepted');
        return;
      }

      const { error } = await res.json() as { error?: string };
      setErrorMsg(error ?? 'Something went wrong. Please try again.');
      setState('confirming');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('confirming');
    }
  }

  // Accepted / Already accepted state
  if (state === 'accepted' || state === 'already_accepted') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 border-t border-emerald-800 px-4 py-3 flex items-center justify-center gap-3">
        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <p className="text-emerald-300 text-sm font-medium">
          {acceptedInfo
            ? `Accepted by ${acceptedInfo.name} on ${new Date(acceptedInfo.at).toLocaleDateString()}`
            : 'This proposal has been accepted.'}
        </p>
      </div>
    );
  }

  // Confirming / submitting state
  if (state === 'confirming' || state === 'submitting') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-4 shadow-2xl">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-800">Confirm your acceptance</p>
          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</p>
          )}
          <input
            type="text"
            placeholder="Your full name *"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            maxLength={120}
            required
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <input
            type="email"
            placeholder="Email address (optional)"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            disabled={state === 'submitting'}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === 'submitting'}
              className="flex-1 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirming…
                </span>
              ) : (
                'Confirm acceptance'
              )}
            </button>
            <button
              type="button"
              onClick={() => setState('idle')}
              disabled={state === 'submitting'}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Idle state — CTA bar
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-center shadow-2xl">
      <button
        onClick={() => setState('confirming')}
        className="w-full max-w-md py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
      >
        Accept this Proposal →
      </button>
    </div>
  );
}

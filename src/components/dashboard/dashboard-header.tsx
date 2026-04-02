'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function DashboardHeader({ userEmail }: { userEmail: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header className="border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-white">Proposal Studio</h1>

      <div className="flex items-center gap-3">
        <Link
          href="/import"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
        >
          Import New
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {userEmail[0].toUpperCase()}
            </span>
            <span className="hidden sm:inline truncate max-w-[140px]">{userEmail}</span>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg py-1 min-w-[180px]">
                <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 truncate">
                  {userEmail}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

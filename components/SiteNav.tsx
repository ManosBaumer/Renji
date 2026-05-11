'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface SiteNavProps {
  activePage: 'analyze' | 'dashboard';
  userEmail?: string | null;
  /** Use the oversized brand mark (used in the landing hero). */
  large?: boolean;
  /**
   * If supplied, clicking the brand or the "Analyze" pill calls this
   * instead of navigating. Used by the home page to reset internal state
   * (e.g. coming back from results). Omit on the dashboard.
   */
  onReset?: () => void;
}

export function SiteNav({ activePage, userEmail, large, onReset }: SiteNavProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSignout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  };

  const brandImg = (
    <Image
      src="/typeface-logo.png"
      alt="Renji"
      width={large ? 320 : 152}
      height={large ? 80 : 38}
      priority
    />
  );

  const brandClass = `r-brand ${large ? 'r-brand--lg' : 'r-brand--md'}`;

  const authed = Boolean(userEmail);

  return (
    <header className="r-nav">
      {onReset ? (
        <button
          type="button"
          className={brandClass}
          onClick={onReset}
          style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
          aria-label="Renji home"
        >
          {brandImg}
        </button>
      ) : (
        <Link href="/" className={brandClass} aria-label="Renji home">
          {brandImg}
        </Link>
      )}

      <nav className="r-nav-pill" aria-label="Primary">
        {onReset ? (
          <button
            type="button"
            className={activePage === 'analyze' ? 'active' : ''}
            onClick={onReset}
          >
            Analyze
          </button>
        ) : (
          <Link href="/" className={activePage === 'analyze' ? 'active' : ''}>
            Analyze
          </Link>
        )}
        <Link href="/dashboard" className={activePage === 'dashboard' ? 'active' : ''}>
          Dashboard
        </Link>
      </nav>

      {authed && userEmail ? (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="r-user-pill"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="r-avatar">{userEmail.charAt(0)}</span>
            <span
              style={{
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userEmail}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <div className="r-user-menu" role="menu">
              <Link href="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)}>
                My dashboard
              </Link>
              <div className="r-divider" />
              <button type="button" role="menuitem" onClick={handleSignout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href="/auth/login" className="r-login-btn">
          Log in
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      )}
    </header>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BrandLockup } from '@/components/BrandLockup';

const PRIMARY = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/', label: 'New Challenge' },
  { href: '/payouts', label: 'Rewards' },
  { href: '/competitions', label: 'Competitions' },
] as const;

const SECONDARY = [
  { href: '/leaderboards', label: 'Leaderboards' },
  { href: '/certificates', label: 'Certificates' },
  { href: '/economic-calendar', label: 'Economic Calendar' },
  { href: '/tools', label: 'Tools' },
  { href: '/trade-copier', label: 'Trade Copier' },
  { href: '/affiliate', label: 'Affiliate' },
  { href: '/settings/profile', label: 'Settings' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/accounts') {
    return (
      pathname === '/accounts' ||
      pathname.startsWith('/accounts/') ||
      pathname.startsWith('/challenges/')
    );
  }
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/settings/profile') return pathname.startsWith('/settings');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconBell() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="mm-icon-md">
      <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" />
    </svg>
  );
}

function IconBasket() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="mm-icon-md">
      <path d="M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="mm-icon-lg">
      <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="mm-icon-lg" aria-hidden>
      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="mm-icon-sm">
      <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
      <path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z" />
    </svg>
  );
}

type Props = {
  basketCount: number;
  onOpenBasket: () => void;
  onLogout: () => void;
  hasSession: boolean;
};

export function MobileNavigation({ basketCount, onOpenBasket, onLogout, hasSession }: Props) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const titleId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pf-theme') : null;
    const isDark = stored === 'dark';
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('pf-theme', next ? 'dark' : 'light');
  }

  function NavLink({
    href,
    label,
    index,
    large,
  }: {
    href: string;
    label: string;
    index: number;
    large?: boolean;
  }) {
    const active = isActive(pathname, href);
    return (
      <li className="mobile-menu-item" style={{ ['--mobile-menu-index' as string]: index }}>
        <Link href={href} onClick={close}>
          <span className={`mobile-menu-link${large ? ' large' : ''}${active ? ' active' : ''}`}>
            <span>{label}</span>
            {active ? <span aria-hidden className="mobile-menu-dot" /> : null}
          </span>
        </Link>
      </li>
    );
  }

  return (
    <>
      <header className="mobile-nav-bar">
        <div className="mobile-nav-bar-inner">
          <Link href="/dashboard" className="mobile-nav-brand" aria-label="Go to Dashboard">
            <BrandLockup className="mobile-nav-lockup" />
          </Link>
          <div className="mobile-nav-actions">
            <button type="button" className="mobile-nav-icon-btn" aria-label="View notifications" title="View notifications">
              <IconBell />
            </button>
            <button
              type="button"
              className="mobile-nav-icon-btn"
              aria-label={basketCount ? `Basket, ${basketCount}` : 'Basket'}
              title="Basket"
              onClick={onOpenBasket}
            >
              <IconBasket />
              {basketCount > 0 ? <span className="mobile-nav-badge">{basketCount}</span> : null}
            </button>
            <button
              type="button"
              className="mobile-nav-icon-btn"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <IconMenu />
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="mobile-menu-surface"
        >
          <div className="mobile-menu-header">
            <h2 id={titleId} className="sr-only">
              Main Navigation
            </h2>
            <Link href="/dashboard" className="mobile-nav-brand" aria-label="Go to Dashboard" onClick={close}>
              <BrandLockup className="mobile-nav-lockup" />
            </Link>
            <button type="button" className="mobile-menu-close" aria-label="Close menu" onClick={close}>
              <span className="sr-only">Close menu</span>
              <IconClose />
            </button>
          </div>

          <nav aria-label="Main Navigation" className="mobile-menu-nav">
            <ul className="mobile-menu-list">
              {PRIMARY.map((item, i) => (
                <NavLink key={item.href} href={item.href} label={item.label} index={i} large />
              ))}
            </ul>

            <div className="mobile-menu-item mobile-menu-divider" style={{ ['--mobile-menu-index' as string]: 5 }} />

            <ul className="mobile-menu-list">
              {SECONDARY.map((item, i) => (
                <NavLink key={item.href} href={item.href} label={item.label} index={6 + i} />
              ))}
              <li className="mobile-menu-item" style={{ ['--mobile-menu-index' as string]: 13 }}>
                <button type="button" className="mobile-menu-support" onClick={() => window.open('mailto:support@propfirm.local')}>
                  <span className="mobile-menu-link">
                    <span>Support</span>
                  </span>
                </button>
              </li>
            </ul>
          </nav>

          <div className="mobile-menu-item mobile-menu-footer" style={{ ['--mobile-menu-index' as string]: 16 }}>
            <button type="button" className="mobile-menu-footer-btn" onClick={toggleTheme}>
              <IconMoon />
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button
              type="button"
              className="mobile-menu-footer-btn"
              aria-label={hasSession ? 'Log out' : 'Log in'}
              onClick={() => {
                close();
                if (hasSession) onLogout();
                else window.location.assign('/login');
              }}
            >
              <IconLogout />
              <span>{hasSession ? 'Log out' : 'Log in'}</span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

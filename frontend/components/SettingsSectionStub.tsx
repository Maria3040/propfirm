'use client';

import { usePathname } from 'next/navigation';
import { SETTINGS_NAV } from '@/lib/settings-data';

export default function SettingsSectionStub() {
  const pathname = usePathname() || '';
  const item = SETTINGS_NAV.find((n) => n.href === pathname);

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">{item?.label || 'Settings'}</h1>
      <div className="settings-card">
        <div className="settings-card-body settings-stub-body">
          <p>
            This <strong>{item?.label || 'settings'}</strong> section is a demo placeholder matching the FundingPips
            Configuration navigation.
          </p>
          <p className="settings-muted">Wire it to real APIs when you extend the PropFirm backend.</p>
        </div>
      </div>
    </div>
  );
}

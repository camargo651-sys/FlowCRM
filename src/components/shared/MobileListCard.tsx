'use client';

import { ReactNode } from 'react';

interface MobileListCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}

export function MobileListCard({ title, subtitle, meta, badge, onClick, children }: MobileListCardProps) {
  return (
    <div
      onClick={onClick}
      className="card p-4 flex flex-col gap-2 active:scale-[0.98] transition-transform"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-surface-900 truncate">{title}</div>
          {subtitle && <div className="text-xs text-surface-500 mt-0.5 truncate">{subtitle}</div>}
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </div>
      {children && <div className="text-sm text-surface-700">{children}</div>}
      {meta && <div className="text-xs text-surface-400 flex items-center gap-2 flex-wrap">{meta}</div>}
    </div>
  );
}

export function MobileList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 md:hidden">{children}</div>;
}

export function DesktopOnly({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}

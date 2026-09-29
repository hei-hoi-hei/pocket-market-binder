import type { ReactNode } from 'react';

interface Props {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/** Consistent page shell with a title, optional icon, and optional header action. */
export function ScreenHeader({ title, icon, action, children }: Props) {
  return (
    <header className="mb-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h1 className="min-w-0 break-words font-display text-2xl tracking-wide text-leather-800">{title}</h1>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </header>
  );
}

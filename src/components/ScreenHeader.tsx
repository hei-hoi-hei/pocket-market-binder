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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="font-display text-2xl text-leather-800 tracking-wide">{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}

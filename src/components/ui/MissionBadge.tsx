import React from 'react';

type MissionBadgeTone = 'default' | 'main' | 'success' | 'danger';

export default function MissionBadge({
  tone = 'default',
  icon,
  className = '',
  children,
}: {
  tone?: MissionBadgeTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`mission-badge ${className}`} data-tone={tone}>
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

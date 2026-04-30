import React from 'react';

export default function ParchmentPanel({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`parchment-panel vl-surface ${className}`} {...props}>
      {children}
    </div>
  );
}

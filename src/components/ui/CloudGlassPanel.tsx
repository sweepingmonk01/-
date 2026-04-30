import React from 'react';

export default function CloudGlassPanel({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`cloud-glass vl-surface ${className}`} {...props}>
      {children}
    </div>
  );
}

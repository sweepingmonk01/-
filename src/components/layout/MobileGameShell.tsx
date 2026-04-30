import React from 'react';

export default function MobileGameShell({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mx-auto h-full w-full max-w-lg ${className}`} {...props}>
      {children}
    </div>
  );
}

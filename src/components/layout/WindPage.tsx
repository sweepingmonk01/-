import React from 'react';

export default function WindPage({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`vl-page ${className}`} {...props}>
      {children}
    </div>
  );
}

import React from 'react';

export interface SubjectIslandNodeProps {
  selected?: boolean;
  locked?: boolean;
  className?: string;
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
}

export default function SubjectIslandNode({
  selected = false,
  locked = false,
  className = '',
  children,
  ...props
}: SubjectIslandNodeProps) {
  return (
    <button
      className={`subject-island-node ${selected ? 'subject-island-selected' : ''} ${locked ? 'subject-island-locked' : ''} ${className}`}
      type={props.type ?? 'button'}
      {...props}
    >
      {children}
    </button>
  );
}

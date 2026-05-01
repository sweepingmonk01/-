import React from 'react';

type GameButtonVariant = 'primary' | 'parchment' | 'success' | 'danger' | 'dark';

const variantClass: Record<GameButtonVariant, string> = {
  primary: 'bg-[linear-gradient(180deg,#58b7ff_0%,#2f7ee8_100%)] text-white',
  parchment: 'bg-[linear-gradient(180deg,#fffdf7_0%,#fff1c6_100%)] text-[var(--vl-ink)]',
  success: 'bg-[linear-gradient(180deg,#9df0be_0%,#49c987_100%)] text-[var(--vl-ink)]',
  danger: 'bg-[linear-gradient(180deg,#ff8b7f_0%,#ff5d5d_100%)] text-white',
  dark: 'bg-[linear-gradient(180deg,#223b67_0%,#122344_100%)] text-white',
};

export interface GameButtonProps {
  variant?: GameButtonVariant;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  key?: React.Key;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
  title?: string;
}

export default function GameButton({
  variant = 'primary',
  icon,
  className = '',
  children,
  ...props
}: GameButtonProps) {
  return (
    <button className={`game-button-vl ${variantClass[variant]} ${className}`} type={props.type ?? 'button'} {...props}>
      {icon ? <span className="mr-1.5 inline-flex shrink-0">{icon}</span> : null}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

import { ReactNode } from 'react';

export function GradientText({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <span className={`bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent animate-gradient ${className}`}>
      {children}
    </span>
  );
}

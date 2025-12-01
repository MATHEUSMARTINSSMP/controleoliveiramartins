import { ReactNode } from 'react';

export function GlassCard({ 
  children, 
  className = '', 
  onClick 
}: { 
  children: ReactNode; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`backdrop-blur-2xl bg-white/10 border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 hover:border-white/40 cursor-pointer group ${className}`}
      data-testid="glass-card"
    >
      {children}
    </div>
  );
}

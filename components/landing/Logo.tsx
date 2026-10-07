import React from 'react';
import { Layers } from 'lucide-react';

interface LogoProps {
  className?: string;
  showBadge?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', showBadge = false }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm ring-1 ring-primary/20">
        <Layers className="h-4.5 w-4.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-foreground leading-none">
          Sketch<span className="text-primary">ItUp</span>
        </span>
        {showBadge && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">
            ERP Task Suite
          </span>
        )}
      </div>
    </div>
  );
};

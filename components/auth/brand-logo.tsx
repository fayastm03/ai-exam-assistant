'use client';

import React from 'react';
import Image from 'next/image';

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/logo.png"
        alt="AI Exam Assistant"
        width={48}
        height={48}
        priority
        className="w-11 h-11 rounded-xl shadow-md shadow-primary/25 shrink-0 object-cover"
      />
      <div className="flex flex-col text-left">
        <span className="font-bold text-lg tracking-tight text-foreground leading-tight">
          AI Exam Assistant
        </span>
        <span className="text-[11px] text-muted-foreground font-medium">
          Smart Examination & Grading
        </span>
      </div>
    </div>
  );
}

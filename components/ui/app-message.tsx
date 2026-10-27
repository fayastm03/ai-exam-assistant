'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageType, UserMessage } from '@/lib/messages';

interface AppMessageProps {
  message: UserMessage | string | null | undefined;
  type?: MessageType;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function AppMessage({
  message,
  type: propType,
  title: propTitle,
  actionLabel: propActionLabel,
  onAction,
  onDismiss,
  className,
}: AppMessageProps) {
  if (!message) return null;

  const isObj = typeof message === 'object';
  const type: MessageType = propType || (isObj ? message.type : 'error');
  const text = isObj ? message.message : message;
  const title = propTitle || (isObj ? message.title : undefined);
  const actionLabel = propActionLabel || (isObj ? message.actionLabel : undefined);

  const styleConfig = {
    error: {
      container:
        'bg-red-50/90 text-red-900 border-red-200 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-200',
      icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
      actionButton:
        'text-red-800 bg-red-100 hover:bg-red-200 dark:text-red-200 dark:bg-red-900/60 dark:hover:bg-red-800',
      role: 'alert',
    },
    warning: {
      container:
        'bg-amber-50/90 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      actionButton:
        'text-amber-800 bg-amber-100 hover:bg-amber-200 dark:text-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800',
      role: 'alert',
    },
    info: {
      container:
        'bg-slate-50 text-slate-800 border-slate-200/90 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-200',
      icon: <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />,
      actionButton:
        'text-slate-800 bg-slate-200 hover:bg-slate-300 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
      role: 'status',
    },
    success: {
      container:
        'bg-emerald-50/90 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      actionButton:
        'text-emerald-800 bg-emerald-100 hover:bg-emerald-200 dark:text-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-800',
      role: 'status',
    },
  }[type];

  return (
    <div
      role={styleConfig.role}
      className={cn(
        'rounded-xl border p-3.5 text-xs sm:text-sm flex items-start gap-3 shadow-xs transition-all',
        styleConfig.container,
        className
      )}
    >
      {styleConfig.icon}

      <div className="flex-1 space-y-1">
        {title && <p className="font-semibold tracking-tight">{title}</p>}
        <p className="leading-relaxed">{text}</p>

        {actionLabel && onAction && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onAction}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors',
                styleConfig.actionButton
              )}
            >
              {actionLabel}
            </button>
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-current opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss message"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}


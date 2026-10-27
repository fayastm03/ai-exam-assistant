'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageType } from '@/lib/messages';

interface ToastItem {
  id: string;
  type: MessageType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

let globalToastHandler: ToastContextType['toast'] | null = null;

export const toast = {
  success: (msg: string) => globalToastHandler?.success(msg),
  error: (msg: string) => globalToastHandler?.error(msg),
  warning: (msg: string) => globalToastHandler?.warning(msg),
  info: (msg: string) => globalToastHandler?.info(msg),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: MessageType, message: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev.slice(-4), { id, type, message }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const toastMethods = React.useMemo(
    () => ({
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      warning: (msg: string) => addToast('warning', msg),
      info: (msg: string) => addToast('info', msg),
    }),
    [addToast]
  );

  React.useEffect(() => {
    globalToastHandler = toastMethods;
    return () => {
      globalToastHandler = null;
    };
  }, [toastMethods]);

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => {
          const config = {
            success: {
              border: 'border-emerald-200 dark:border-emerald-800',
              bg: 'bg-white dark:bg-neutral-900',
              text: 'text-neutral-900 dark:text-neutral-100',
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
            },
            error: {
              border: 'border-red-200 dark:border-red-800',
              bg: 'bg-white dark:bg-neutral-900',
              text: 'text-neutral-900 dark:text-neutral-100',
              icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />,
            },
            warning: {
              border: 'border-amber-200 dark:border-amber-800',
              bg: 'bg-white dark:bg-neutral-900',
              text: 'text-neutral-900 dark:text-neutral-100',
              icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
            },
            info: {
              border: 'border-blue-200 dark:border-blue-800',
              bg: 'bg-white dark:bg-neutral-900',
              text: 'text-neutral-900 dark:text-neutral-100',
              icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />,
            },
          }[t.type];

          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-200',
                config.bg,
                config.border,
                config.text
              )}
            >
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
                {config.icon}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { toast };
  }
  return context;
}


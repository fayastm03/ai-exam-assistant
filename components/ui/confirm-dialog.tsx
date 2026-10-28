'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'info';
  icon?: React.ReactNode;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onConfirm();
  };

  const handleCancel = () => {
    if (isLoading) return;
    onCancel?.();
    onOpenChange(false);
  };

  const renderIcon = () => {
    if (icon !== undefined) return icon;
    if (variant === 'destructive') {
      return (
        <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
      );
    }
    if (variant === 'warning') {
      return (
        <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    if (variant === 'info') {
      return (
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Info className="w-5 h-5" />
        </div>
      );
    }
    return null;
  };

  const confirmButtonClass = () => {
    if (variant === 'destructive') {
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium';
    }
    if (variant === 'warning') {
      return 'bg-amber-600 text-white hover:bg-amber-700 font-medium';
    }
    return 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium';
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (isLoading) return;
      if (!val) {
        onCancel?.();
      }
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md rounded-lg p-5">
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            {renderIcon()}
            <div className="space-y-1 text-left flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-4 pt-3 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-transparent p-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
            className="rounded-lg h-9 text-xs"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn('rounded-lg h-9 text-xs gap-1.5 cursor-pointer', confirmButtonClass())}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


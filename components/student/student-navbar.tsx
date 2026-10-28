'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, LogOut, BookOpen, Users, PlusCircle, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface StudentNavbarProps {
  userName: string;
  userEmail: string;
}

export function StudentNavbar({ userName }: StudentNavbarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // When taking an exam, hide navbar completely for full-screen distraction-free exam mode
  if (pathname.includes('/take')) {
    return null;
  }

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
    } catch {
      // Ignore network errors and continue navigation
    }
    window.location.href = '/login';
  };

  const isExamsActive = pathname.startsWith('/exams');
  const isClassesActive = pathname.startsWith('/classes');
  const isJoinActive = pathname.startsWith('/join');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/exams" className="flex items-center gap-2 text-foreground font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span>AI Exam Assistant</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/exams"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isExamsActive
                  ? 'bg-secondary text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Exams
            </Link>
            <Link
              href="/classes"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isClassesActive
                  ? 'bg-secondary text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Users className="w-4 h-4" />
              My Classes
            </Link>
            <Link
              href="/join"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isJoinActive
                  ? 'bg-secondary text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Join Class
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{userName}</span>
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 h-5 text-muted-foreground border-border rounded-lg"
            >
              Student
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSignOutConfirm(true)}
            disabled={signingOut}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg cursor-pointer"
          >
            {signingOut ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
            )}
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign out of your account?"
        description="Are you sure you want to sign out? You will need to sign in again to access your student portal."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="default"
        isLoading={signingOut}
        onConfirm={handleSignOut}
      />
    </header>
  );
}

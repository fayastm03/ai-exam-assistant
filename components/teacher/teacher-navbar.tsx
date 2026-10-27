'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, LogOut, BookOpen, Users } from 'lucide-react';

interface TeacherNavbarProps {
  userName: string;
  userEmail: string;
}

export function TeacherNavbar({ userName }: TeacherNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isExamsActive = pathname.startsWith('/teacher/exams');
  const isClassesActive = pathname.startsWith('/teacher/classes');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/teacher/exams" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-foreground leading-tight">
                AI Exam Assistant
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Teacher
              </span>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/teacher/exams"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isExamsActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Exams
            </Link>
            <Link
              href="/teacher/classes"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isClassesActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Classes
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-medium text-foreground">
              {userName}
            </span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground border-border bg-secondary">
              Teacher
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg h-8 text-xs"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="sm:hidden flex items-center border-t border-border px-4 py-2 gap-2 bg-secondary/40">
        <Link
          href="/teacher/exams"
          className={`flex-1 py-2 text-xs font-medium rounded-lg text-center transition-colors flex items-center justify-center gap-1.5 ${
            isExamsActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground bg-card border border-border'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Exams
        </Link>
        <Link
          href="/teacher/classes"
          className={`flex-1 py-2 text-xs font-medium rounded-lg text-center transition-colors flex items-center justify-center gap-1.5 ${
            isClassesActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground bg-card border border-border'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Classes
        </Link>
      </div>
    </header>
  );
}

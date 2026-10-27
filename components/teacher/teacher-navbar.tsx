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
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/teacher/exams" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-tight">
                AI Exam Assistant
              </span>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
                Teacher Console
              </span>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/teacher/exams"
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                isExamsActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Exams
            </Link>
            <Link
              href="/teacher/classes"
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                isClassesActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Users className="w-4 h-4" />
              Classes
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {userName}
            </span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-blue-600 border-blue-200 dark:border-blue-800 bg-blue-50/50">
              Teacher
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-neutral-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="sm:hidden flex items-center border-t border-neutral-200 dark:border-neutral-800 px-4 py-2 gap-2 bg-neutral-50/50 dark:bg-neutral-900/50">
        <Link
          href="/teacher/exams"
          className={`flex-1 py-1.5 text-xs font-medium rounded-md text-center transition-colors flex items-center justify-center gap-1.5 ${
            isExamsActive
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Exams
        </Link>
        <Link
          href="/teacher/classes"
          className={`flex-1 py-1.5 text-xs font-medium rounded-md text-center transition-colors flex items-center justify-center gap-1.5 ${
            isClassesActive
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Classes
        </Link>
      </div>
    </header>
  );
}

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { GraduationCap, ArrowLeft, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
          <GraduationCap className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Page Not Found
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
            The page or resource you are looking for could not be found. Check the link or return to your dashboard.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/exams"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'w-full sm:w-auto h-9 bg-blue-600 hover:bg-blue-700'
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'w-full sm:w-auto h-9'
            )}
          >
            <Home className="w-4 h-4 mr-1.5" />
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}


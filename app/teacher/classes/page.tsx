'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { mapApiError, MESSAGES } from '@/lib/messages';

interface ClassItem {
  id: string;
  name: string;
  join_code: string;
  join_enabled: boolean;
  approved_count: number;
  pending_count: number;
  created_at: string;
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Create class dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reloadClasses = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch('/api/teacher/classes');
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) {
            throw new Error(data.message || 'Failed to fetch classes');
          }
          setClasses(data.classes || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(mapApiError(err, 'Failed to load classes. Please try again.').message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      setCreateError('Please enter a class name.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create class');
      }

      setNewClassName('');
      setCreateOpen(false);
      toast.success(MESSAGES.success.saved);
      reloadClasses();
    } catch (err: unknown) {
      setCreateError(mapApiError(err, 'Could not create class. Please try again.').message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.join_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            My Classes
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your classroom rosters, approve student requests, and share join codes.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Class
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>
                Provide a name for your class. A unique 6-character join code will be generated automatically.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateClass} className="space-y-4 py-2">
              {createError && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <AlertDescription className="text-xs ml-2">{createError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="class-name">Class Name</Label>
                <Input
                  id="class-name"
                  placeholder="e.g. Physics Section A, Grade 10 Math"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  disabled={creating}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !newClassName.trim()}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Class'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      {classes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search classes or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      )}

      {/* Main Content Areas */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm text-neutral-500">Loading your classes...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="py-4">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div className="ml-3">
            <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadClasses}
              className="mt-3 text-xs border-red-300 dark:border-red-800"
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : classes.length === 0 ? (
        <Card className="border-dashed border-2 py-12 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                No classes created yet
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Classes allow you to organize students, manage join requests, and assign specific exams to student cohorts.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="mt-2">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Your First Class
            </Button>
          </CardContent>
        </Card>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12 text-sm text-neutral-500">
          No classes match &quot;{searchQuery}&quot;. Try a different search term.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const hasPending = cls.pending_count > 0;

            return (
              <Card
                key={cls.id}
                className="group relative flex flex-col justify-between hover:shadow-md transition-all border-neutral-200/80 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-700"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <Link href={`/teacher/classes/${cls.id}`} className="hover:underline">
                        {cls.name}
                      </Link>
                    </CardTitle>

                    {hasPending ? (
                      <Badge
                        variant="destructive"
                        className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-[11px] px-2 py-0.5 shrink-0 flex items-center gap-1 shadow-xs"
                      >
                        <Clock className="w-3 h-3" />
                        {cls.pending_count} pending
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[11px] px-1.5 py-0 text-neutral-500 border-neutral-200 dark:border-neutral-700 shrink-0"
                      >
                        {cls.join_enabled ? 'Active' : 'Locked'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    Created {new Date(cls.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3.5 pb-3">
                  {/* Join code display with quick copy */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                        Join Code
                      </span>
                      <span className="font-mono font-bold text-base tracking-widest text-neutral-900 dark:text-neutral-100">
                        {cls.join_code}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleCopyCode(cls.join_code, e)}
                      className="h-8 px-2.5 text-xs text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Copy join code"
                    >
                      {copiedCode === cls.join_code ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Members count metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-md bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {cls.approved_count}
                        </div>
                        <div className="text-[10px] text-neutral-500">Approved</div>
                      </div>
                    </div>

                    <div
                      className={`p-2 rounded-md border flex items-center gap-2 transition-colors ${
                        hasPending
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                          : 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200/50 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <Clock
                        className={`w-4 h-4 shrink-0 ${
                          hasPending ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'
                        }`}
                      />
                      <div>
                        <div className="font-semibold">
                          {cls.pending_count}
                        </div>
                        <div className="text-[10px] opacity-80">Pending</div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full justify-between text-xs font-medium' })}
                  >
                    <span>Manage Class & Members</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

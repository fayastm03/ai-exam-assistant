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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Classes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your classes, approve student enrollments, and share join codes.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto rounded-lg h-9 bg-primary text-primary-foreground font-medium text-xs">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Class
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Create New Class</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter a class name. A unique 6-character join code will be generated.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateClass} className="space-y-4 py-2">
              {createError && (
                <Alert variant="destructive" className="py-2.5 rounded-lg text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <AlertDescription className="ml-2">{createError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="class-name" className="text-xs font-medium">Class Name</Label>
                <Input
                  id="class-name"
                  placeholder="e.g. Grade 10 Mathematics"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  disabled={creating}
                  className="rounded-lg h-10 text-base sm:text-sm"
                />
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                  className="rounded-lg h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !newClassName.trim()} className="rounded-lg h-9 bg-primary text-primary-foreground text-xs font-medium">
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
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search classes or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm rounded-lg h-9"
          />
        </div>
      )}

      {/* Main Content Areas */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading classes...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="py-4 rounded-lg">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div className="ml-3">
            <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadClasses}
              className="mt-3 text-xs rounded-lg h-8"
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : classes.length === 0 ? (
        <Card className="rounded-lg border border-dashed border-border py-12 text-center bg-card shadow-sm">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                No classes yet
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Create a class to organize students and assign exams.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="rounded-lg h-9 px-4 bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-4 h-4 mr-1.5" />
              Create a Class
            </Button>
          </CardContent>
        </Card>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground">
          No classes match &quot;{searchQuery}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const hasPending = cls.pending_count > 0;

            return (
              <Card
                key={cls.id}
                className="group relative flex flex-col justify-between rounded-lg border border-border shadow-sm hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-foreground line-clamp-1">
                      <Link href={`/teacher/classes/${cls.id}`} className="hover:underline">
                        {cls.name}
                      </Link>
                    </CardTitle>

                    {hasPending ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 border-amber-400 text-amber-700 dark:text-amber-400 font-medium text-xs px-2 py-0.5 shrink-0 flex items-center gap-1 rounded"
                      >
                        <Clock className="w-3 h-3" />
                        {cls.pending_count} pending
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs px-2 py-0 font-normal text-muted-foreground border-border bg-secondary shrink-0 rounded"
                      >
                        {cls.join_enabled ? 'Active' : 'Locked'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Created {new Date(cls.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-3">
                  {/* Join code display with quick copy */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary border border-border">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                        Join Code
                      </span>
                      <span className="font-mono font-bold text-base tracking-widest text-foreground">
                        {cls.join_code}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleCopyCode(cls.join_code, e)}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
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
                    <div className="p-2.5 rounded-lg bg-secondary border border-border flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-foreground">
                          {cls.approved_count}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Enrolled</div>
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                        hasPending
                          ? 'bg-amber-500/10 border-amber-300 text-amber-800 dark:text-amber-300'
                          : 'bg-secondary border-border text-muted-foreground'
                      }`}
                    >
                      <Clock
                        className={`w-4 h-4 shrink-0 ${
                          hasPending ? 'text-amber-600' : 'text-muted-foreground'
                        }`}
                      />
                      <div>
                        <div className="font-semibold text-foreground">
                          {cls.pending_count}
                        </div>
                        <div className="text-[11px] opacity-80">Pending</div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-border">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full justify-between text-xs font-medium rounded-lg h-9' })}
                  >
                    <span>Manage Roster</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
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

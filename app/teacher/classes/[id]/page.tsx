'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Clock,
  UserCheck,
  UserX,
  UserMinus,
  BookOpen,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  Mail,
  Calendar,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { mapApiError, MESSAGES } from '@/lib/messages';

interface ClassData {
  id: string;
  name: string;
  join_code: string;
  join_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface MemberItem {
  id: string;
  class_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  requested_at: string;
  decided_at: string | null;
  created_at: string;
}

interface AssignedExam {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'closed';
  duration_min: number;
  open_at: string | null;
  close_at: string | null;
}

export default function TeacherClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: classId } = use(params);

  const [cls, setCls] = useState<ClassData | null>(null);
  const [assignedExams, setAssignedExams] = useState<AssignedExam[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Copy feedback states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Regenerate code dialog
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Remove member confirmation dialog
  const [memberToRemove, setMemberToRemove] = useState<MemberItem | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Action in-flight tracking
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Members tab status filter
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>('all');

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/members`);
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch class members:', err);
    }
  }, [classId]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [clsRes, memRes] = await Promise.all([
          fetch(`/api/teacher/classes/${classId}`),
          fetch(`/api/teacher/classes/${classId}/members`),
        ]);

        const clsData = await clsRes.json();
        const memData = await memRes.json();

        if (!ignore) {
          if (!clsRes.ok) {
            throw new Error(clsData.message || 'Failed to fetch class');
          }
          setCls(clsData.class);
          setEditNameValue(clsData.class.name);
          setAssignedExams(clsData.exams || []);
          if (memRes.ok) {
            setMembers(memData.members || []);
          }
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error loading class');
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
  }, [classId, refreshKey]);

  // Copy join code
  const handleCopyCode = () => {
    if (!cls) return;
    navigator.clipboard.writeText(cls.join_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy invite link
  const handleCopyInviteLink = () => {
    if (!cls) return;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const inviteUrl = `${siteUrl}/join?code=${cls.join_code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Toggle join enabled
  const handleToggleJoinEnabled = async (checked: boolean) => {
    if (!cls) return;
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_enabled: checked }),
      });
      const data = await res.json();
      if (res.ok && data.class) {
        setCls(data.class);
      }
    } catch (err) {
      console.error('Failed to update join status:', err);
    }
  };

  // Save edited name
  const handleSaveName = async () => {
    if (!cls || !editNameValue.trim() || editNameValue.trim() === cls.name) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update name');
      }
      setCls(data.class);
      setIsEditingName(false);
      toast.success(MESSAGES.success.saved);
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Could not update class name.').message);
    } finally {
      setSavingName(false);
    }
  };

  // Regenerate join code
  const handleRegenerateCode = async () => {
    if (!cls) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/regenerate-code`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to regenerate code');
      }
      setCls(data.class);
      setRegenOpen(false);
      setRefreshKey((k) => k + 1);
      toast.success(MESSAGES.success.codeRegenerated);
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Could not generate a new code.').message);
    } finally {
      setRegenerating(false);
    }
  };

  // Member status updates (Approve, Reject, Remove)
  const handleUpdateMemberStatus = async (
    memberId: string,
    status: 'approved' | 'rejected' | 'removed'
  ) => {
    setActionInProgress(memberId);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update member status');
      }
      // Refresh roster
      await fetchMembers();
      if (status === 'approved') {
        toast.success(MESSAGES.success.approved);
      } else if (status === 'rejected') {
        toast.success(MESSAGES.success.declined);
      } else if (status === 'removed') {
        toast.success(MESSAGES.success.removed);
      }
    } catch (err: unknown) {
      toast.error(mapApiError(err, 'Could not update membership status.').message);
    } finally {
      setActionInProgress(null);
    }
  };

  // Confirm remove member
  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      await handleUpdateMemberStatus(memberToRemove.id, 'removed');
      setMemberToRemove(null);
    } finally {
      setRemovingMember(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm text-neutral-500">Loading class details...</span>
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="space-y-4">
        <Link
          href="/teacher/classes"
          className="inline-flex items-center text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to My Classes
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error || 'Class not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const pendingMembers = members.filter((m) => m.status === 'pending');
  const filteredMembers =
    memberStatusFilter === 'all'
      ? members
      : members.filter((m) => m.status === memberStatusFilter);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/teacher/classes"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Classes
        </Link>
      </div>

      {/* Class Overview & Code Card */}
      <Card className="rounded-lg border border-border shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Header row: Editable Class Name */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            {isEditingName ? (
              <div className="flex items-center gap-2 w-full max-w-md">
                <Input
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  maxLength={100}
                  className="font-bold text-lg rounded-lg"
                  autoFocus
                  disabled={savingName}
                />
                <Button size="sm" onClick={handleSaveName} disabled={savingName || !editNameValue.trim()} className="rounded-lg h-9 bg-primary text-primary-foreground text-xs">
                  {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditNameValue(cls.name);
                    setIsEditingName(false);
                  }}
                  disabled={savingName}
                  className="rounded-lg h-9 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {cls.name}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingName(true)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                  title="Edit class name"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Created {new Date(cls.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Join Code & Join Toggle Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Join Code Highlight Box */}
            <div className="lg:col-span-2 p-5 rounded-lg bg-secondary border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Class Join Code
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-foreground">
                  {cls.join_code}
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this 6-character code with students to let them request access.
                </p>
              </div>

              {/* Code action buttons */}
              <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="text-xs rounded-lg h-9"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copy Code
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyInviteLink}
                  className="text-xs rounded-lg h-9"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Copy Link
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRegenOpen(true)}
                  className="text-xs text-muted-foreground hover:text-destructive rounded-lg h-9"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate Code
                </Button>
              </div>
            </div>

            {/* Joining Status Switch Box */}
            <div className="p-5 rounded-lg border border-border bg-secondary flex flex-col justify-between gap-3 h-full">
              <div className="flex items-center justify-between">
                <Label htmlFor="join-toggle" className="text-sm font-semibold text-foreground">
                  Allow Join Requests
                </Label>
                <Switch
                  id="join-toggle"
                  checked={cls.join_enabled}
                  onCheckedChange={handleToggleJoinEnabled}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {cls.join_enabled ? (
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Joining is active. Students can enter the code to join.
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Joining is locked. Code is inactive.
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Sections: Pending Requests & Member Roster Tabs */}
      <Tabs defaultValue="pending" className="w-full space-y-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="pending" className="relative text-xs sm:text-sm">
            Pending Requests
            {pendingMembers.length > 0 && (
              <span className="ml-2 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {pendingMembers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs sm:text-sm">
            All Members ({members.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Requests */}
        <TabsContent value="pending" className="space-y-3">
          {pendingMembers.length === 0 ? (
            <Card className="py-10 text-center border-dashed">
              <CardContent className="space-y-2">
                <UserCheck className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  No pending requests
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  When students enter your class join code, their requests will appear here for you to approve or reject.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                        {member.student_name}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                        Pending
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                      {member.student_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {member.student_email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Requested {new Date(member.requested_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                      onClick={() => handleUpdateMemberStatus(member.id, 'approved')}
                      disabled={actionInProgress === member.id}
                    >
                      {actionInProgress === member.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 h-8 text-xs border-red-200"
                      onClick={() => handleUpdateMemberStatus(member.id, 'rejected')}
                      disabled={actionInProgress === member.id}
                    >
                      <UserX className="w-3.5 h-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: All Members with Status Filter */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {['all', 'approved', 'pending', 'rejected', 'removed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setMemberStatusFilter(st)}
                  className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors font-medium ${
                    memberStatusFilter === st
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs text-neutral-500">
              Showing {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
            </span>
          </div>

          {filteredMembers.length === 0 ? (
            <Card className="py-10 text-center border-dashed">
              <CardContent className="space-y-2">
                <Users className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  No {memberStatusFilter !== 'all' ? memberStatusFilter : ''} members found
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {memberStatusFilter === 'all'
                    ? 'No students have joined this class yet.'
                    : `No members currently hold the '${memberStatusFilter}' status.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800 border border-neutral-200/70 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
              {filteredMembers.map((member) => {
                const badgeColor =
                  member.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : member.status === 'pending'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    : member.status === 'rejected'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400';

                return (
                  <div
                    key={member.id}
                    className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {member.student_name}
                        </span>
                        <Badge variant="outline" className={`text-[10px] capitalize px-1.5 py-0 ${badgeColor}`}>
                          {member.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                        {member.student_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {member.student_email}
                          </span>
                        )}
                        <span>
                          Requested: {new Date(member.requested_at).toLocaleDateString()}
                        </span>
                        {member.decided_at && (
                          <span>
                            Decided: {new Date(member.decided_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {member.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMemberToRemove(member)}
                          className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 h-7 px-2.5"
                        >
                          <UserMinus className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      )}

                      {member.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => handleUpdateMemberStatus(member.id, 'approved')}
                            disabled={actionInProgress === member.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 px-2.5 text-red-600 hover:bg-red-50"
                            onClick={() => handleUpdateMemberStatus(member.id, 'rejected')}
                            disabled={actionInProgress === member.id}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Section: Assigned Exams */}
      <Card className="border-neutral-200/80 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Exams Assigned to this Class
              </CardTitle>
              <CardDescription className="text-xs">
                Students approved in this class have access to take these exams once published.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {assignedExams.length} Assigned
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {assignedExams.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 space-y-2">
              <p className="text-xs">No exams have been assigned to this class yet.</p>
              <Link
                href="/teacher/exams"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs' })}
              >
                Go to Exams to Assign
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {assignedExams.map((exam) => {
                const statusColor =
                  exam.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : exam.status === 'draft'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400';

                return (
                  <div
                    key={exam.id}
                    className="p-3.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <Link
                          href={`/teacher/exams/${exam.id}`}
                          className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 hover:text-blue-600 line-clamp-1"
                        >
                          {exam.title}
                        </Link>
                        <Badge variant="outline" className={`text-[10px] capitalize px-1.5 py-0 shrink-0 ${statusColor}`}>
                          {exam.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {exam.duration_min}m
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/teacher/exams/${exam.id}`}
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'sm',
                        className: 'h-7 text-xs justify-between w-full pt-1 border-t border-neutral-100 dark:border-neutral-800',
                      })}
                    >
                      <span>Edit Exam</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog: Regenerate Code */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <RefreshCw className="w-5 h-5" />
              Regenerate Join Code?
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-xs">
              <p>
                Generating a new join code will <strong>immediately invalidate the existing code ({cls.join_code})</strong>.
              </p>
              <p>
                Students who haven&apos;t joined the class yet will no longer be able to use the old code or previous invite links. Existing members will remain in the class.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRegenOpen(false)}
              disabled={regenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRegenerateCode}
              disabled={regenerating}
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Regenerating...
                </>
              ) : (
                'Yes, Regenerate Code'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Remove Member */}
      <Dialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <UserMinus className="w-5 h-5" />
              Remove Member from Class
            </DialogTitle>
            <DialogDescription className="text-xs pt-2">
              Are you sure you want to remove <strong>{memberToRemove?.student_name}</strong> from &quot;{cls.name}&quot;?
              They will lose access to any exams assigned exclusively to this class.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMemberToRemove(null)}
              disabled={removingMember}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemove}
              disabled={removingMember}
            >
              {removingMember ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

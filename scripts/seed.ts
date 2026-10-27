import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local if present and not already loaded in environment
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedPassword = process.env.SEED_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!seedPassword) {
  console.error('❌ Error: Missing SEED_PASSWORD environment variable.');
  console.error('Please configure SEED_PASSWORD in your .env.local or pass it via CLI:');
  console.error('  SEED_PASSWORD="YourSecurePassword123" npm run seed\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const FIXED_JOIN_CODE = 'DEMO26';

const DEMO_QUESTIONS = [
  {
    number: 1,
    text: 'What is the primary function of the CPU in a computer system?',
    options: [
      { id: 'A', text: 'To execute stored program instructions and process data' },
      { id: 'B', text: 'To permanently store files and operating system data' },
      { id: 'C', text: 'To render 3D graphics and video frames' },
      { id: 'D', text: 'To regulate power distribution across components' },
    ],
    correct_option: 'A',
    explanation: 'The Central Processing Unit (CPU) executes instructions and coordinates hardware activities.',
    topic: 'Computer Architecture',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 2,
    text: 'Which data structure follows the Last-In, First-Out (LIFO) principle?',
    options: [
      { id: 'A', text: 'Queue' },
      { id: 'B', text: 'Stack' },
      { id: 'C', text: 'Binary Search Tree' },
      { id: 'D', text: 'Linked List' },
    ],
    correct_option: 'B',
    explanation: 'A Stack operates strictly under LIFO semantics using push and pop operations.',
    topic: 'Data Structures',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 3,
    text: 'What is the worst-case time complexity of QuickSort?',
    options: [
      { id: 'A', text: 'O(n log n)' },
      { id: 'B', text: 'O(n)' },
      { id: 'C', text: 'O(n²)' },
      { id: 'D', text: 'O(log n)' },
    ],
    correct_option: 'C',
    explanation: 'When unbalanced partitions occur (e.g., repeatedly picking smallest/largest element), QuickSort degrades to O(n²).',
    topic: 'Algorithms',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 4,
    text: 'In relational databases, which SQL clause is used to filter aggregated group results?',
    options: [
      { id: 'A', text: 'WHERE' },
      { id: 'B', text: 'HAVING' },
      { id: 'C', text: 'GROUP BY' },
      { id: 'D', text: 'ORDER BY' },
    ],
    correct_option: 'B',
    explanation: 'HAVING filters results after the GROUP BY aggregation, whereas WHERE filters rows before aggregation.',
    topic: 'Databases',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 5,
    text: 'Which HTTP status code signifies that a client must authenticate before gaining access?',
    options: [
      { id: 'A', text: '401 Unauthorized' },
      { id: 'B', text: '403 Forbidden' },
      { id: 'C', text: '404 Not Found' },
      { id: 'D', text: '429 Too Many Requests' },
    ],
    correct_option: 'A',
    explanation: 'HTTP 401 indicates missing or invalid authentication credentials.',
    topic: 'Networking & Web',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 6,
    text: 'What is the purpose of Row-Level Security (RLS) in PostgreSQL?',
    options: [
      { id: 'A', text: 'To automatically encrypt all database tables on disk' },
      { id: 'B', text: 'To restrict which table rows can be selected or modified by specific users' },
      { id: 'C', text: 'To increase query execution performance by caching rows in memory' },
      { id: 'D', text: 'To prevent SQL syntax errors during transactions' },
    ],
    correct_option: 'B',
    explanation: 'RLS policies evaluate boolean expressions per row for authenticated database roles.',
    topic: 'Security & Databases',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 7,
    text: 'Which layer of the OSI model is responsible for end-to-end reliable data delivery (e.g., TCP)?',
    options: [
      { id: 'A', text: 'Network Layer' },
      { id: 'B', text: 'Data Link Layer' },
      { id: 'C', text: 'Transport Layer' },
      { id: 'D', text: 'Session Layer' },
    ],
    correct_option: 'C',
    explanation: 'The Transport layer (Layer 4) provides host-to-host communication services including TCP and UDP.',
    topic: 'Networking',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 8,
    text: 'In JavaScript and TypeScript, what is a closure?',
    options: [
      { id: 'A', text: 'A syntax construct that terminates a running loop' },
      { id: 'B', text: 'The combination of a function bundled with references to its surrounding lexical state' },
      { id: 'C', text: 'A method that closes network connections when garbage collection runs' },
      { id: 'D', text: 'A strict compiler mode that disallows global variables' },
    ],
    correct_option: 'B',
    explanation: 'A closure gives a function access to its outer scope even after the outer function has executed.',
    topic: 'Programming Languages',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 9,
    text: 'What does the ACID acronym stand for in database transaction management?',
    options: [
      { id: 'A', text: 'Atomicity, Consistency, Isolation, Durability' },
      { id: 'B', text: 'Accuracy, Concurrency, Integrity, Dependability' },
      { id: 'C', text: 'Authentication, Confidentiality, Integrity, Delivery' },
      { id: 'D', text: 'Availability, Consistency, Invariance, Durability' },
    ],
    correct_option: 'A',
    explanation: 'ACID guarantees that database transactions are processed reliably.',
    topic: 'Databases',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
  {
    number: 10,
    text: 'Which algorithmic paradigm does Dijkstra’s shortest-path algorithm employ?',
    options: [
      { id: 'A', text: 'Divide and Conquer' },
      { id: 'B', text: 'Greedy' },
      { id: 'C', text: 'Backtracking' },
      { id: 'D', text: 'Brute Force' },
    ],
    correct_option: 'B',
    explanation: 'Dijkstra greedily chooses the unvisited vertex with the minimum distance at each step.',
    topic: 'Algorithms',
    marks: 1,
    source: 'manual' as const,
    review_status: 'approved' as const,
  },
];

async function getOrCreateUser(email: string, name: string, role: 'teacher' | 'student') {
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listError) throw listError;

  let user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (user) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: seedPassword,
      email_confirm: true,
      user_metadata: { name, full_name: name },
    });
    if (updateError) throw updateError;
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: seedPassword,
      email_confirm: true,
      user_metadata: { name, full_name: name },
    });
    if (createError) throw createError;
    user = created.user;
  }

  // Authoritative role assignment in public.profiles
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      name,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (profileError) throw profileError;

  return user;
}

async function seed() {
  console.log('\n🚀 Starting Idempotent Database Seed...');

  // 1. Provision / Update Users
  console.log('→ Provisioning demo accounts with confirmed emails...');
  const teacher = await getOrCreateUser('teacher@demo.com', 'Demo Teacher', 'teacher');
  const approvedStudent = await getOrCreateUser('student.approved@demo.com', 'Approved Student', 'student');
  const pendingStudent = await getOrCreateUser('student.pending@demo.com', 'Pending Student', 'student');
  const newStudent = await getOrCreateUser('student.new@demo.com', 'New Student', 'student');

  // 2. Provision / Update Demo Class
  console.log(`→ Setting up "Demo Class" with fixed join code "${FIXED_JOIN_CODE}"...`);
  const { data: existingClass } = await supabase
    .from('classes')
    .select('id')
    .eq('join_code', FIXED_JOIN_CODE)
    .maybeSingle();

  let classId: string;
  if (existingClass) {
    classId = existingClass.id;
    const { error: classUpdateErr } = await supabase
      .from('classes')
      .update({
        name: 'Demo Class',
        teacher_id: teacher.id,
        join_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', classId);
    if (classUpdateErr) throw classUpdateErr;
  } else {
    const { data: newClass, error: classInsertErr } = await supabase
      .from('classes')
      .insert({
        name: 'Demo Class',
        teacher_id: teacher.id,
        join_code: FIXED_JOIN_CODE,
        join_enabled: true,
      })
      .select('id')
      .single();
    if (classInsertErr) throw classInsertErr;
    classId = newClass.id;
  }

  // 3. Configure Membership States
  console.log('→ Configuring membership states in Demo Class...');
  const now = new Date().toISOString();

  // 3a. Approved Student
  const { error: approvedErr } = await supabase.from('class_members').upsert(
    {
      class_id: classId,
      student_id: approvedStudent.id,
      status: 'approved',
      requested_at: now,
      decided_at: now,
      updated_at: now,
    },
    { onConflict: 'class_id,student_id' }
  );
  if (approvedErr) throw approvedErr;

  // 3b. Pending Student
  const { error: pendingErr } = await supabase.from('class_members').upsert(
    {
      class_id: classId,
      student_id: pendingStudent.id,
      status: 'pending',
      requested_at: now,
      decided_at: null,
      updated_at: now,
    },
    { onConflict: 'class_id,student_id' }
  );
  if (pendingErr) throw pendingErr;

  // 3c. No Request Student (guarantee absence of membership row)
  await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', newStudent.id);

  // 4. Provision / Update Published Demo Exam
  console.log('→ Provisioning published demo examination...');
  const { data: existingExam } = await supabase
    .from('exams')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('title', 'Demo Examination')
    .maybeSingle();

  let examId: string;
  if (existingExam) {
    examId = existingExam.id;
    const { error: examUpdateErr } = await supabase
      .from('exams')
      .update({
        instructions: 'Welcome to the Demo Examination. Answer all 10 multiple-choice questions.',
        duration_min: 30,
        status: 'published',
        negative_marking: 0.25,
        shuffle: false,
        updated_at: now,
      })
      .eq('id', examId);
    if (examUpdateErr) throw examUpdateErr;
  } else {
    const { data: newExam, error: examInsertErr } = await supabase
      .from('exams')
      .insert({
        teacher_id: teacher.id,
        title: 'Demo Examination',
        instructions: 'Welcome to the Demo Examination. Answer all 10 multiple-choice questions.',
        duration_min: 30,
        status: 'published',
        negative_marking: 0.25,
        shuffle: false,
      })
      .select('id')
      .single();
    if (examInsertErr) throw examInsertErr;
    examId = newExam.id;
  }

  // 5. Assign Exam to Demo Class
  const { error: assignErr } = await supabase.from('exam_classes').upsert(
    {
      exam_id: examId,
      class_id: classId,
    },
    { onConflict: 'exam_id,class_id' }
  );
  if (assignErr) throw assignErr;

  // 6. Ensure Exactly 10 Questions
  console.log('→ Inserting 10 demo questions...');
  await supabase.from('questions').delete().eq('exam_id', examId);

  const questionsPayload = DEMO_QUESTIONS.map((q) => ({
    ...q,
    exam_id: examId,
  }));

  const { error: questionsErr } = await supabase.from('questions').insert(questionsPayload);
  if (questionsErr) throw questionsErr;

  // 7. Output Final Credentials & Details
  console.log('\n==============================================================================');
  console.log('🎉 Seed Completed Successfully (Idempotent)');
  console.log('==============================================================================');
  console.log(`Class Name:  Demo Class`);
  console.log(`Join Code:   ${FIXED_JOIN_CODE}`);
  console.log(`Invite Link: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/join?code=${FIXED_JOIN_CODE}`);
  console.log(`Exam Title:  Demo Examination (10 questions, Published)`);
  console.log('\nDemo User Accounts:');
  console.log('Password for all demo accounts: configured in SEED_PASSWORD');
  console.log('------------------------------------------------------------------------------');
  console.log('Role     | Email                      | Status in Demo Class');
  console.log('------------------------------------------------------------------------------');
  console.log('Teacher  | teacher@demo.com           | Classroom Instructor');
  console.log('Student  | student.approved@demo.com  | Approved (Has access to Demo Exam)');
  console.log('Student  | student.pending@demo.com   | Pending approval (Waiting on teacher)');
  console.log('Student  | student.new@demo.com       | No request (Ready to test /join)');
  console.log('==============================================================================\n');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});

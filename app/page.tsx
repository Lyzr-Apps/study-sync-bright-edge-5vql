'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import {
  listSchedules,
  getScheduleLogs,
  pauseSchedule,
  resumeSchedule,
  cronToHuman,
  triggerScheduleNow,
} from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  RiDashboardLine,
  RiCalendarLine,
  RiTargetLine,
  RiSettings3Line,
  RiBookOpenLine,
  RiAddLine,
  RiDeleteBinLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiLoader4Line,
  RiTimeLine,
  RiFireLine,
  RiAlertLine,
  RiCheckLine,
  RiPlayLine,
  RiPauseLine,
  RiRefreshLine,
  RiSunLine,
  RiMoonLine,
  RiLightbulbLine,
  RiBarChartLine,
  RiInformationLine,
  RiCloseLine,
  RiHistoryLine,
  RiFlashlightLine,
  RiCalendarCheckLine,
  RiNotification3Line,
  RiGlobalLine,
  RiMenuLine,
} from 'react-icons/ri'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STUDY_PLAN_COORDINATOR_ID = '6999627e72a2e3b0eaab97be'
const DEADLINE_GOALS_TRACKER_ID = '6999627f2361782dde9da339'
const SCHEDULE_ID = '69996287399dfadeac37e2c6'

const SUBJECT_COLORS = [
  'hsl(160, 75%, 50%)',
  'hsl(142, 65%, 45%)',
  'hsl(180, 55%, 50%)',
  'hsl(120, 50%, 50%)',
  'hsl(200, 50%, 55%)',
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Subject {
  id: string
  name: string
  difficulty: number
  deadline: string
}

interface Commitment {
  id: string
  name: string
  recurring: boolean
  timeBlock: 'Morning' | 'Afternoon' | 'Evening'
}

interface StudyBlock {
  id: string
  subject: string
  day: string
  start_time: string
  end_time: string
  duration_minutes: number
  difficulty: number
  energy_match: string
  focus_tips: string
  calendar_event_created: boolean
}

interface SubjectCoverage {
  subject: string
  hours_allocated: number
  sessions_count: number
}

interface StudyPlanData {
  week_start: string
  week_end: string
  study_blocks: StudyBlock[]
  total_study_hours: number
  subjects_covered: SubjectCoverage[]
  balance_score: number
  plan_summary: string
  recommendations: string[]
}

interface DeadlineItem {
  subject: string
  deadline: string
  days_remaining: number
  urgency: string
  action_needed: string
  completion_percentage: number
}

interface GoalProgress {
  overall_academic_progress: number
  weekly_completion_rate: number
  balance_score: number
  subjects_at_risk: string[]
}

interface Reminder {
  title: string
  message: string
  urgency: string
  due_date: string
}

interface Insight {
  type: string
  message: string
}

interface GoalsData {
  upcoming_deadlines: DeadlineItem[]
  goal_progress: GoalProgress
  reminders: Reminder[]
  insights: Insight[]
  balance_analysis: string
  recommendations: string[]
}

type ScreenType = 'dashboard' | 'weekly' | 'goals' | 'settings'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function getSubjectColor(subject: string, allSubjects: string[]): string {
  const idx = allSubjects.indexOf(subject)
  return SUBJECT_COLORS[idx >= 0 ? idx % SUBJECT_COLORS.length : 0]
}

function parseAgentResponse(result: any): any {
  try {
    let data = result?.response?.result
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        const jsonMatch = data.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try { data = JSON.parse(jsonMatch[0]) } catch { /* keep string */ }
        }
      }
    }
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      data = result?.response
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch { /* keep */ }
      }
    }
    if (!data && result?.raw_response) {
      try { data = JSON.parse(result.raw_response) } catch { /* keep */ }
    }
    return data
  } catch {
    return null
  }
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------
const SAMPLE_SUBJECTS: Subject[] = [
  { id: 's1', name: 'Machine Learning', difficulty: 4, deadline: '2026-03-15' },
  { id: 's2', name: 'Data Structures', difficulty: 3, deadline: '2026-03-22' },
  { id: 's3', name: 'Linear Algebra', difficulty: 5, deadline: '2026-03-10' },
  { id: 's4', name: 'Business Strategy', difficulty: 2, deadline: '2026-04-01' },
]

const SAMPLE_COMMITMENTS: Commitment[] = [
  { id: 'c1', name: 'Team Standup', recurring: true, timeBlock: 'Morning' },
  { id: 'c2', name: 'Client Meeting', recurring: false, timeBlock: 'Afternoon' },
]

const SAMPLE_STUDY_PLAN: StudyPlanData = {
  week_start: '2026-02-23',
  week_end: '2026-03-01',
  study_blocks: [
    { id: 'b1', subject: 'Linear Algebra', day: 'Monday', start_time: '09:00', end_time: '10:30', duration_minutes: 90, difficulty: 5, energy_match: 'Peak', focus_tips: 'Start with eigenvalue problems while energy is highest. Use the Pomodoro technique.', calendar_event_created: true },
    { id: 'b2', subject: 'Machine Learning', day: 'Monday', start_time: '14:00', end_time: '15:30', duration_minutes: 90, difficulty: 4, energy_match: 'High', focus_tips: 'Review gradient descent concepts. Practice with small datasets first.', calendar_event_created: true },
    { id: 'b3', subject: 'Data Structures', day: 'Tuesday', start_time: '09:00', end_time: '10:00', duration_minutes: 60, difficulty: 3, energy_match: 'Peak', focus_tips: 'Implement a balanced BST from scratch. Draw out the rotations.', calendar_event_created: true },
    { id: 'b4', subject: 'Business Strategy', day: 'Tuesday', start_time: '15:00', end_time: '16:00', duration_minutes: 60, difficulty: 2, energy_match: 'Moderate', focus_tips: 'Review Porter\'s Five Forces case studies. Take notes on competitive dynamics.', calendar_event_created: true },
    { id: 'b5', subject: 'Linear Algebra', day: 'Wednesday', start_time: '08:30', end_time: '10:00', duration_minutes: 90, difficulty: 5, energy_match: 'Peak', focus_tips: 'Focus on SVD decomposition. Work through proofs step by step.', calendar_event_created: true },
    { id: 'b6', subject: 'Machine Learning', day: 'Wednesday', start_time: '13:00', end_time: '14:30', duration_minutes: 90, difficulty: 4, energy_match: 'High', focus_tips: 'Neural network backpropagation practice. Use visual diagrams.', calendar_event_created: true },
    { id: 'b7', subject: 'Data Structures', day: 'Thursday', start_time: '09:00', end_time: '10:30', duration_minutes: 90, difficulty: 3, energy_match: 'Peak', focus_tips: 'Graph algorithms - BFS/DFS implementations. Trace through examples.', calendar_event_created: true },
    { id: 'b8', subject: 'Business Strategy', day: 'Thursday', start_time: '16:00', end_time: '17:00', duration_minutes: 60, difficulty: 2, energy_match: 'Low', focus_tips: 'Light reading on market analysis frameworks. Summarize key takeaways.', calendar_event_created: false },
    { id: 'b9', subject: 'Linear Algebra', day: 'Friday', start_time: '09:00', end_time: '10:00', duration_minutes: 60, difficulty: 5, energy_match: 'Peak', focus_tips: 'Practice problems for upcoming exam. Time yourself.', calendar_event_created: true },
    { id: 'b10', subject: 'Machine Learning', day: 'Friday', start_time: '14:00', end_time: '15:00', duration_minutes: 60, difficulty: 4, energy_match: 'Moderate', focus_tips: 'Review week\'s ML concepts. Create summary cheat sheet.', calendar_event_created: true },
  ],
  total_study_hours: 12.5,
  subjects_covered: [
    { subject: 'Linear Algebra', hours_allocated: 4.0, sessions_count: 3 },
    { subject: 'Machine Learning', hours_allocated: 4.0, sessions_count: 3 },
    { subject: 'Data Structures', hours_allocated: 2.5, sessions_count: 2 },
    { subject: 'Business Strategy', hours_allocated: 2.0, sessions_count: 2 },
  ],
  balance_score: 78,
  plan_summary: 'This week\'s plan allocates 12.5 hours across 4 subjects. High-difficulty subjects (Linear Algebra, Machine Learning) are scheduled during peak energy periods. Business Strategy sessions are placed in lower-energy slots. The plan avoids conflicts with your team standup and client meeting.',
  recommendations: [
    'Consider adding a Saturday review session for Linear Algebra given the approaching deadline.',
    'Your balance score of 78 is good but could improve with a short evening study block on Wednesday.',
    'Machine Learning sessions could benefit from hands-on coding practice between formal study blocks.',
    'Take 10-minute breaks between consecutive study blocks for optimal retention.',
  ],
}

const SAMPLE_GOALS: GoalsData = {
  upcoming_deadlines: [
    { subject: 'Linear Algebra', deadline: '2026-03-10', days_remaining: 17, urgency: 'URGENT', action_needed: 'Complete chapters 7-9 and practice problems. Schedule extra review sessions.', completion_percentage: 62 },
    { subject: 'Machine Learning', deadline: '2026-03-15', days_remaining: 22, urgency: 'MODERATE', action_needed: 'Finish project proposal and review neural network architectures.', completion_percentage: 45 },
    { subject: 'Data Structures', deadline: '2026-03-22', days_remaining: 29, urgency: 'RELAXED', action_needed: 'Continue with graph algorithms module. Start exam prep next week.', completion_percentage: 70 },
    { subject: 'Business Strategy', deadline: '2026-04-01', days_remaining: 39, urgency: 'RELAXED', action_needed: 'Read case studies 5-8. Prepare presentation outline.', completion_percentage: 30 },
  ],
  goal_progress: {
    overall_academic_progress: 52,
    weekly_completion_rate: 85,
    balance_score: 78,
    subjects_at_risk: ['Linear Algebra'],
  },
  reminders: [
    { title: 'Linear Algebra Exam Prep', message: 'Your Linear Algebra exam is in 17 days. Increase study frequency to 4 sessions per week.', urgency: 'URGENT', due_date: '2026-03-10' },
    { title: 'ML Project Proposal', message: 'Submit your Machine Learning project proposal by end of next week.', urgency: 'MODERATE', due_date: '2026-02-28' },
    { title: 'Weekly Review', message: 'Complete your weekly progress review and update study goals.', urgency: 'RELAXED', due_date: '2026-02-22' },
  ],
  insights: [
    { type: 'performance', message: 'Your weekly completion rate of 85% is above average. Keep up the consistent effort.' },
    { type: 'risk', message: 'Linear Algebra needs immediate attention. You are 38% behind your target completion rate.' },
    { type: 'balance', message: 'Good balance between academics and business commitments. Consider protecting weekend mornings for deep work.' },
    { type: 'trend', message: 'Your study consistency has improved 15% over the last 3 weeks.' },
  ],
  balance_analysis: 'Your current academic-business balance is **healthy** at 78/100. You are maintaining consistent study schedules while managing business commitments. However, the upcoming Linear Algebra deadline may require temporarily reallocating time from lower-priority subjects.\n\n### Key Observations:\n- Morning study blocks are your most productive\n- Business commitments are well-contained and predictable\n- Weekend study time is underutilized\n\n### Recommended Adjustments:\n- Shift one Business Strategy session to make room for extra Linear Algebra prep\n- Use Sunday afternoons for cumulative review across all subjects',
  recommendations: [
    'Prioritize Linear Algebra over the next 2 weeks to improve from 62% completion.',
    'Schedule a dedicated ML project work session this weekend.',
    'Maintain current Data Structures pace - you are ahead of schedule.',
    'Consider study group sessions for difficult topics to improve retention.',
  ],
}

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ProgressRing({ value, size = 80, strokeWidth = 6, label, color = 'hsl(160, 70%, 40%)' }: { value: number; size?: number; strokeWidth?: number; label: string; color?: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const safeValue = Math.min(100, Math.max(0, value || 0))
  const offset = circumference - (safeValue / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(160, 22%, 15%)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{safeValue}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  )
}

function DifficultyDots({ level }: { level: number }) {
  const safeLevel = Math.min(5, Math.max(0, level || 0))
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((dot) => (
        <div key={dot} className={`w-2 h-2 rounded-full ${dot <= safeLevel ? 'bg-accent' : 'bg-muted'}`} />
      ))}
    </div>
  )
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const u = (urgency || '').toUpperCase()
  let classes = 'text-xs px-2 py-0.5 rounded-full font-medium '
  if (u === 'CRITICAL') classes += 'bg-red-900/50 text-red-300 ring-1 ring-red-500/50'
  else if (u === 'URGENT') classes += 'bg-amber-900/50 text-amber-300 ring-1 ring-amber-500/50'
  else if (u === 'MODERATE') classes += 'bg-yellow-900/50 text-yellow-300 ring-1 ring-yellow-500/50'
  else classes += 'bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-500/50'
  return <span className={classes}>{u || 'N/A'}</span>
}

function SkeletonCard() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4 bg-muted" />
        <Skeleton className="h-3 w-1/2 bg-muted" />
        <Skeleton className="h-3 w-full bg-muted" />
      </CardContent>
    </Card>
  )
}

function StatusMessage({ message, type = 'info' }: { message: string; type?: 'success' | 'error' | 'info' }) {
  if (!message) return null
  let classes = 'px-4 py-3 rounded-xl text-sm flex items-center gap-2 '
  if (type === 'success') classes += 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/30'
  else if (type === 'error') classes += 'bg-red-900/30 text-red-300 border border-red-700/30'
  else classes += 'bg-blue-900/30 text-blue-300 border border-blue-700/30'
  return (
    <div className={classes}>
      {type === 'success' ? <RiCheckLine className="w-4 h-4 flex-shrink-0" /> : type === 'error' ? <RiAlertLine className="w-4 h-4 flex-shrink-0" /> : <RiInformationLine className="w-4 h-4 flex-shrink-0" />}
      <span>{message}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard Screen
// ---------------------------------------------------------------------------
function DashboardScreen({
  subjects,
  setSubjects,
  commitments,
  setCommitments,
  energyPreference,
  setEnergyPreference,
  studyPlan,
  generatingPlan,
  onGeneratePlan,
  sampleMode,
  statusMessage,
}: {
  subjects: Subject[]
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>
  commitments: Commitment[]
  setCommitments: React.Dispatch<React.SetStateAction<Commitment[]>>
  energyPreference: string
  setEnergyPreference: (v: string) => void
  studyPlan: StudyPlanData | null
  generatingPlan: boolean
  onGeneratePlan: () => void
  sampleMode: boolean
  statusMessage: { text: string; type: 'success' | 'error' | 'info' } | null
}) {
  const addSubject = () => {
    setSubjects(prev => [...prev, { id: generateId(), name: '', difficulty: 3, deadline: '' }])
  }
  const removeSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id))
  }
  const updateSubject = (id: string, field: keyof Subject, value: any) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }
  const addCommitment = () => {
    setCommitments(prev => [...prev, { id: generateId(), name: '', recurring: false, timeBlock: 'Morning' }])
  }
  const removeCommitment = (id: string) => {
    setCommitments(prev => prev.filter(c => c.id !== id))
  }
  const updateCommitment = (id: string, field: keyof Commitment, value: any) => {
    setCommitments(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const nextDeadline = subjects.length > 0
    ? subjects
        .filter(s => s.deadline)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0]
    : null

  const [daysToNextDeadline, setDaysToNextDeadline] = useState<number | null>(null)
  useEffect(() => {
    if (nextDeadline?.deadline) {
      const diff = Math.ceil((new Date(nextDeadline.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      setDaysToNextDeadline(diff)
    } else {
      setDaysToNextDeadline(null)
    }
  }, [nextDeadline?.deadline])

  const todayBlocks = Array.isArray(studyPlan?.study_blocks)
    ? studyPlan!.study_blocks.filter(b => {
        const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
        return (b.day || '').toLowerCase() === (todayName || '').toLowerCase()
      })
    : []

  const allSubjectNames = Array.isArray(studyPlan?.subjects_covered)
    ? studyPlan!.subjects_covered.map(s => s.subject)
    : subjects.map(s => s.name)

  return (
    <div className="space-y-6">
      {statusMessage && <StatusMessage message={statusMessage.text} type={statusMessage.type} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Input forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subjects */}
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <RiBookOpenLine className="w-5 h-5 text-accent" />
                  Subjects
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addSubject} className="gap-1 text-xs">
                  <RiAddLine className="w-4 h-4" /> Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {subjects.length === 0 ? (
                <div className="text-center py-8">
                  <RiBookOpenLine className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Add your first subject to get started</p>
                </div>
              ) : (
                subjects.map((subject) => (
                  <div key={subject.id} className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
                    <div className="flex items-center gap-2">
                      <Input placeholder="Subject name" value={subject.name} onChange={(e) => updateSubject(subject.id, 'name', e.target.value)} className="flex-1 bg-background border-border" />
                      <Button variant="ghost" size="sm" onClick={() => removeSubject(subject.id)} className="text-muted-foreground hover:text-destructive">
                        <RiDeleteBinLine className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Difficulty ({subject.difficulty}/5)</Label>
                        <Slider value={[subject.difficulty]} onValueChange={(v) => updateSubject(subject.id, 'difficulty', v[0])} min={1} max={5} step={1} className="w-full" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Deadline</Label>
                        <Input type="date" value={subject.deadline} onChange={(e) => updateSubject(subject.id, 'deadline', e.target.value)} className="bg-background border-border" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Business Commitments */}
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <RiCalendarCheckLine className="w-5 h-5 text-accent" />
                  Business Commitments
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addCommitment} className="gap-1 text-xs">
                  <RiAddLine className="w-4 h-4" /> Add Commitment
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {commitments.length === 0 ? (
                <div className="text-center py-8">
                  <RiCalendarCheckLine className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No business commitments added yet</p>
                </div>
              ) : (
                commitments.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
                    <div className="flex items-center gap-2">
                      <Input placeholder="Commitment name" value={c.name} onChange={(e) => updateCommitment(c.id, 'name', e.target.value)} className="flex-1 bg-background border-border" />
                      <Button variant="ghost" size="sm" onClick={() => removeCommitment(c.id)} className="text-muted-foreground hover:text-destructive">
                        <RiDeleteBinLine className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={c.recurring} onCheckedChange={(v) => updateCommitment(c.id, 'recurring', v)} />
                        <Label className="text-xs text-muted-foreground">Recurring</Label>
                      </div>
                      <Select value={c.timeBlock} onValueChange={(v) => updateCommitment(c.id, 'timeBlock', v)}>
                        <SelectTrigger className="w-32 bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Morning">Morning</SelectItem>
                          <SelectItem value="Afternoon">Afternoon</SelectItem>
                          <SelectItem value="Evening">Evening</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Energy Preferences */}
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RiFlashlightLine className="w-5 h-5 text-accent" />
                Peak Energy Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {[
                  { val: 'morning', icon: RiSunLine, label: 'Morning' },
                  { val: 'afternoon', icon: RiFireLine, label: 'Afternoon' },
                  { val: 'evening', icon: RiMoonLine, label: 'Evening' },
                ].map(({ val, icon: Icon, label }) => (
                  <button key={val} onClick={() => setEnergyPreference(val)} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${energyPreference === val ? 'bg-accent/20 border-accent text-accent' : 'bg-secondary/50 border-border text-muted-foreground hover:border-accent/40'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generate Plan CTA */}
          <Button onClick={onGeneratePlan} disabled={generatingPlan || subjects.length === 0} className="w-full h-12 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20">
            {generatingPlan ? (
              <span className="flex items-center gap-2"><RiLoader4Line className="w-5 h-5 animate-spin" /> Generating Study Plan...</span>
            ) : (
              <span className="flex items-center gap-2"><RiCalendarLine className="w-5 h-5" /> Generate Study Plan</span>
            )}
          </Button>
        </div>

        {/* Right column - Quick stats */}
        <div className="space-y-6">
          {/* Next Deadline */}
          <Card className="bg-card border-border shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <RiTimeLine className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Next Deadline</p>
                  <p className="text-sm font-semibold">{nextDeadline?.name || 'None set'}</p>
                </div>
              </div>
              {daysToNextDeadline !== null ? (
                <div className="text-center py-2">
                  <p className="text-3xl font-bold text-accent">{daysToNextDeadline}</p>
                  <p className="text-xs text-muted-foreground">days remaining</p>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">Add subjects with deadlines</p>
              )}
            </CardContent>
          </Card>

          {/* Hours Planned */}
          <Card className="bg-card border-border shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <RiBarChartLine className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hours Planned</p>
                  <p className="text-sm font-semibold">This Week</p>
                </div>
              </div>
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-foreground">{studyPlan?.total_study_hours ?? 0}</p>
                <p className="text-xs text-muted-foreground">hours</p>
              </div>
            </CardContent>
          </Card>

          {/* Balance Score */}
          <Card className="bg-card border-border shadow-lg">
            <CardContent className="p-6 flex flex-col items-center">
              <ProgressRing value={studyPlan?.balance_score ?? 0} size={100} strokeWidth={8} label="Balance Score" />
            </CardContent>
          </Card>

          {/* Agent Info */}
          <Card className="bg-card border-border shadow-md">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Powered by AI Agents</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs text-foreground">Study Plan Coordinator</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs text-foreground">Deadline & Goals Tracker</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Calendar Analyzer (sub-agent)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Workload Optimizer (sub-agent)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Today's blocks */}
      {studyPlan && (
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <RiCalendarLine className="w-5 h-5 text-accent" />
              Today&apos;s Study Blocks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No study blocks scheduled for today</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {todayBlocks.map((block) => (
                  <div key={block.id} className="flex-shrink-0 w-56 p-4 rounded-xl border border-border" style={{ borderLeftColor: getSubjectColor(block.subject, allSubjectNames), borderLeftWidth: 3 }}>
                    <p className="font-semibold text-sm">{block.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">{block.start_time} - {block.end_time}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <DifficultyDots level={block.difficulty} />
                      <Badge variant="secondary" className="text-xs">{block.energy_match}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {generatingPlan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly Plan Screen
// ---------------------------------------------------------------------------
function WeeklyPlanScreen({
  studyPlan,
  subjects,
  generatingPlan,
  onRegeneratePlan,
}: {
  studyPlan: StudyPlanData | null
  subjects: Subject[]
  generatingPlan: boolean
  onRegeneratePlan: () => void
}) {
  const allSubjectNames = Array.isArray(studyPlan?.subjects_covered)
    ? studyPlan!.subjects_covered.map(s => s.subject)
    : subjects.map(s => s.name)

  if (!studyPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RiCalendarLine className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Study Plan Generated</h3>
        <p className="text-sm text-muted-foreground mb-6">Generate a study plan from the Dashboard first</p>
      </div>
    )
  }

  const blocks = Array.isArray(studyPlan.study_blocks) ? studyPlan.study_blocks : []
  const subjectsCovered = Array.isArray(studyPlan.subjects_covered) ? studyPlan.subjects_covered : []
  const recommendations = Array.isArray(studyPlan.recommendations) ? studyPlan.recommendations : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm text-muted-foreground">Week of {studyPlan.week_start ?? 'N/A'} to {studyPlan.week_end ?? 'N/A'}</h3>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="secondary" className="text-xs">{studyPlan.total_study_hours ?? 0} hours planned</Badge>
            <Badge variant="secondary" className="text-xs">Balance: {studyPlan.balance_score ?? 0}/100</Badge>
          </div>
        </div>
        <Button onClick={onRegeneratePlan} disabled={generatingPlan} variant="outline" className="gap-2">
          {generatingPlan ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiRefreshLine className="w-4 h-4" />}
          Regenerate Plan
        </Button>
      </div>

      {/* Weekly Grid */}
      <Card className="bg-card border-border shadow-lg overflow-hidden">
        <ScrollArea className="w-full">
          <div className="grid grid-cols-7 min-w-[700px]">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="border-r border-border last:border-r-0">
                <div className="p-3 text-center bg-secondary/50 border-b border-border">
                  <p className="text-xs font-semibold">{day.slice(0, 3)}</p>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {blocks
                    .filter(b => (b.day || '').toLowerCase() === day.toLowerCase())
                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                    .map((block) => (
                      <Popover key={block.id}>
                        <PopoverTrigger asChild>
                          <button className="w-full text-left p-2 rounded-lg border border-border/50 transition-all duration-200 hover:shadow-md hover:scale-[1.02]" style={{ backgroundColor: getSubjectColor(block.subject, allSubjectNames) + '20', borderLeftColor: getSubjectColor(block.subject, allSubjectNames), borderLeftWidth: 3 }}>
                            <p className="text-xs font-semibold truncate">{block.subject}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{block.start_time} - {block.end_time}</p>
                            <div className="mt-1">
                              <DifficultyDots level={block.difficulty} />
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 bg-popover border-border shadow-xl">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-sm">{block.subject}</h4>
                              <p className="text-xs text-muted-foreground">{block.day} {block.start_time} - {block.end_time} ({block.duration_minutes}min)</p>
                            </div>
                            <Separator className="bg-border" />
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Energy Match</span>
                                <Badge variant="secondary" className="text-xs">{block.energy_match}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Difficulty</span>
                                <DifficultyDots level={block.difficulty} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Calendar</span>
                                <Badge variant={block.calendar_event_created ? 'default' : 'secondary'} className="text-xs">
                                  {block.calendar_event_created ? 'Synced' : 'Pending'}
                                </Badge>
                              </div>
                            </div>
                            {block.focus_tips && (
                              <>
                                <Separator className="bg-border" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><RiLightbulbLine className="w-3 h-3" /> Focus Tips</p>
                                  <p className="text-xs text-foreground">{block.focus_tips}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Subject coverage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Subject Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subjectsCovered.map((sc, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getSubjectColor(sc.subject, allSubjectNames) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{sc.subject}</p>
                    <span className="text-xs text-muted-foreground ml-2">{sc.hours_allocated}h / {sc.sessions_count} sessions</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${((sc.hours_allocated / (studyPlan.total_study_hours || 1)) * 100)}%`, backgroundColor: getSubjectColor(sc.subject, allSubjectNames) }} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Plan Summary & Recommendations */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Plan Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {studyPlan.plan_summary && renderMarkdown(studyPlan.plan_summary)}
            {recommendations.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><RiLightbulbLine className="w-3 h-3" /> Recommendations</p>
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50">
                    <RiCheckLine className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-foreground">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {generatingPlan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Goals Screen
// ---------------------------------------------------------------------------
function GoalsScreen({
  goalsData,
  checkingGoals,
  onCheckGoals,
  statusMessage,
}: {
  goalsData: GoalsData | null
  checkingGoals: boolean
  onCheckGoals: () => void
  statusMessage: { text: string; type: 'success' | 'error' | 'info' } | null
}) {
  const deadlines = Array.isArray(goalsData?.upcoming_deadlines) ? goalsData!.upcoming_deadlines : []
  const reminders = Array.isArray(goalsData?.reminders) ? goalsData!.reminders : []
  const insights = Array.isArray(goalsData?.insights) ? goalsData!.insights : []
  const recommendations = Array.isArray(goalsData?.recommendations) ? goalsData!.recommendations : []
  const progress = goalsData?.goal_progress
  const atRisk = Array.isArray(progress?.subjects_at_risk) ? progress!.subjects_at_risk : []

  const sortedDeadlines = [...deadlines].sort((a, b) => {
    const urgencyOrder: Record<string, number> = { CRITICAL: 0, URGENT: 1, MODERATE: 2, RELAXED: 3 }
    return (urgencyOrder[a.urgency?.toUpperCase()] ?? 4) - (urgencyOrder[b.urgency?.toUpperCase()] ?? 4)
  })

  return (
    <div className="space-y-6">
      {statusMessage && <StatusMessage message={statusMessage.text} type={statusMessage.type} />}

      {/* CTA */}
      <Button onClick={onCheckGoals} disabled={checkingGoals} className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 gap-2">
        {checkingGoals ? (
          <><RiLoader4Line className="w-5 h-5 animate-spin" /> Checking Goals...</>
        ) : (
          <><RiTargetLine className="w-5 h-5" /> Check Goals & Deadlines</>
        )}
      </Button>

      {checkingGoals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Progress rings */}
      {progress && (
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-around flex-wrap gap-6">
              <ProgressRing value={progress.overall_academic_progress ?? 0} label="Academic Progress" color="hsl(160, 75%, 50%)" />
              <ProgressRing value={progress.weekly_completion_rate ?? 0} label="Weekly Completion" color="hsl(142, 65%, 45%)" />
              <ProgressRing value={progress.balance_score ?? 0} label="Balance Score" color="hsl(180, 55%, 50%)" />
            </div>
            {atRisk.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-700/30">
                <p className="text-xs font-medium text-red-300 flex items-center gap-1"><RiAlertLine className="w-3 h-3" /> Subjects at Risk: {atRisk.join(', ')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deadlines */}
      {sortedDeadlines.length > 0 && (
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <RiTimeLine className="w-5 h-5 text-accent" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedDeadlines.map((d, i) => (
              <div key={i} className={`p-4 rounded-xl border transition-all ${d.urgency?.toUpperCase() === 'CRITICAL' ? 'border-red-700/50 ring-2 ring-red-500/20' : d.urgency?.toUpperCase() === 'URGENT' ? 'border-amber-700/50 ring-1 ring-amber-500/20' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{d.subject}</h4>
                    <UrgencyBadge urgency={d.urgency} />
                  </div>
                  <span className="text-xs text-muted-foreground">{d.deadline}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{d.days_remaining} days remaining</span>
                  <span className="text-xs font-medium text-accent">{d.completion_percentage ?? 0}% complete</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                  <div className="h-1.5 rounded-full bg-accent transition-all duration-500" style={{ width: `${d.completion_percentage ?? 0}%` }} />
                </div>
                {d.action_needed && <p className="text-xs text-muted-foreground">{d.action_needed}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reminders & Insights side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reminders */}
        {reminders.length > 0 && (
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RiNotification3Line className="w-5 h-5 text-accent" />
                Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reminders.map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium">{r.title}</h4>
                    <UrgencyBadge urgency={r.urgency} />
                  </div>
                  <p className="text-xs text-muted-foreground">{r.message}</p>
                  {r.due_date && <p className="text-[10px] text-muted-foreground mt-1">Due: {r.due_date}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RiLightbulbLine className="w-5 h-5 text-accent" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.map((ins, i) => (
                <div key={i} className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <Badge variant="secondary" className="text-[10px] mb-1.5">{ins.type}</Badge>
                  <p className="text-xs text-foreground">{ins.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Balance Analysis */}
      {goalsData?.balance_analysis && (
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <RiBarChartLine className="w-5 h-5 text-accent" />
              Balance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderMarkdown(goalsData.balance_analysis)}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50">
                <RiCheckLine className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!goalsData && !checkingGoals && (
        <div className="flex flex-col items-center justify-center py-16">
          <RiTargetLine className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Goals Data Yet</h3>
          <p className="text-sm text-muted-foreground">Click &quot;Check Goals &amp; Deadlines&quot; to analyze your progress</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------
function SettingsScreen({
  timezone,
  setTimezone,
  energyPreference,
  setEnergyPreference,
  notifications,
  setNotifications,
}: {
  timezone: string
  setTimezone: (v: string) => void
  energyPreference: string
  setEnergyPreference: (v: string) => void
  notifications: { deadlineReminders: boolean; dailyBriefing: boolean; planUpdates: boolean }
  setNotifications: React.Dispatch<React.SetStateAction<{ deadlineReminders: boolean; dailyBriefing: boolean; planUpdates: boolean }>>
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [togglingSchedule, setTogglingSchedule] = useState(false)
  const [triggeringSchedule, setTriggeringSchedule] = useState(false)

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    setScheduleError(null)
    try {
      const res = await listSchedules()
      if (res.success) {
        setSchedules(Array.isArray(res.schedules) ? res.schedules : [])
      } else {
        setScheduleError(res.error || 'Failed to load schedules')
      }
    } catch (e) {
      setScheduleError('Failed to load schedules')
    }
    setSchedulesLoading(false)
  }, [])

  const loadLogs = useCallback(async (scheduleId: string) => {
    setLogsLoading(true)
    try {
      const res = await getScheduleLogs(scheduleId, { limit: 5 })
      if (res.success) {
        setLogs(Array.isArray(res.executions) ? res.executions : [])
      }
    } catch { /* ignore */ }
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const targetSchedule = schedules.find(s => s.id === SCHEDULE_ID) || schedules.find(s => s.agent_id === DEADLINE_GOALS_TRACKER_ID) || (schedules.length > 0 ? schedules[0] : null)

  useEffect(() => {
    if (targetSchedule?.id) {
      loadLogs(targetSchedule.id)
    }
  }, [targetSchedule?.id, loadLogs])

  const handleToggleSchedule = async () => {
    if (!targetSchedule) return
    setTogglingSchedule(true)
    setScheduleError(null)
    setScheduleSuccess(null)
    try {
      const result = targetSchedule.is_active
        ? await pauseSchedule(targetSchedule.id)
        : await resumeSchedule(targetSchedule.id)
      if (result.success) {
        setScheduleSuccess(targetSchedule.is_active ? 'Schedule paused' : 'Schedule resumed')
        await loadSchedules()
      } else {
        setScheduleError(result.error || 'Failed to toggle schedule')
        await loadSchedules()
      }
    } catch {
      setScheduleError('Failed to toggle schedule')
      await loadSchedules()
    }
    setTogglingSchedule(false)
  }

  const handleTriggerNow = async () => {
    if (!targetSchedule) return
    setTriggeringSchedule(true)
    setScheduleError(null)
    setScheduleSuccess(null)
    try {
      const result = await triggerScheduleNow(targetSchedule.id)
      if (result.success) {
        setScheduleSuccess('Schedule triggered successfully')
        await loadSchedules()
        await loadLogs(targetSchedule.id)
      } else {
        setScheduleError(result.error || 'Failed to trigger schedule')
      }
    } catch {
      setScheduleError('Failed to trigger schedule')
    }
    setTriggeringSchedule(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Calendar Settings */}
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <RiGlobalLine className="w-5 h-5 text-accent" />
            Calendar Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Energy Defaults */}
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <RiFlashlightLine className="w-5 h-5 text-accent" />
            Energy Defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-sm mb-2 block">Default Peak Energy Time</Label>
          <div className="flex gap-3">
            {[
              { val: 'morning', icon: RiSunLine, label: 'Morning' },
              { val: 'afternoon', icon: RiFireLine, label: 'Afternoon' },
              { val: 'evening', icon: RiMoonLine, label: 'Evening' },
            ].map(({ val, icon: Icon, label }) => (
              <button key={val} onClick={() => setEnergyPreference(val)} className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${energyPreference === val ? 'bg-accent/20 border-accent text-accent' : 'bg-secondary/50 border-border text-muted-foreground hover:border-accent/40'}`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <RiNotification3Line className="w-5 h-5 text-accent" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Deadline Reminders</Label>
              <p className="text-xs text-muted-foreground">Get notified before deadlines</p>
            </div>
            <Switch checked={notifications.deadlineReminders} onCheckedChange={(v) => setNotifications(prev => ({ ...prev, deadlineReminders: v }))} />
          </div>
          <Separator className="bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Daily Briefing</Label>
              <p className="text-xs text-muted-foreground">Morning study plan summary</p>
            </div>
            <Switch checked={notifications.dailyBriefing} onCheckedChange={(v) => setNotifications(prev => ({ ...prev, dailyBriefing: v }))} />
          </div>
          <Separator className="bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Plan Updates</Label>
              <p className="text-xs text-muted-foreground">Notifications when plans change</p>
            </div>
            <Switch checked={notifications.planUpdates} onCheckedChange={(v) => setNotifications(prev => ({ ...prev, planUpdates: v }))} />
          </div>
        </CardContent>
      </Card>

      {/* Schedule Management */}
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <RiHistoryLine className="w-5 h-5 text-accent" />
            Schedule Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleError && <StatusMessage message={scheduleError} type="error" />}
          {scheduleSuccess && <StatusMessage message={scheduleSuccess} type="success" />}

          {schedulesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/2 bg-muted" />
              <Skeleton className="h-4 w-3/4 bg-muted" />
              <Skeleton className="h-4 w-2/3 bg-muted" />
            </div>
          ) : targetSchedule ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={targetSchedule.is_active ? 'default' : 'secondary'} className={targetSchedule.is_active ? 'bg-accent text-accent-foreground' : ''}>
                    {targetSchedule.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Schedule</span>
                  <span className="text-sm">{targetSchedule.cron_expression ? cronToHuman(targetSchedule.cron_expression) : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Timezone</span>
                  <span className="text-sm">{targetSchedule.timezone || 'UTC'}</span>
                </div>
                {targetSchedule.next_run_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Next Run</span>
                    <span className="text-sm">{new Date(targetSchedule.next_run_time).toLocaleString()}</span>
                  </div>
                )}
                {targetSchedule.last_run_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Run</span>
                    <span className="text-sm">{new Date(targetSchedule.last_run_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <Separator className="bg-border" />

              <div className="flex gap-3">
                <Button onClick={handleToggleSchedule} disabled={togglingSchedule} variant="outline" className="flex-1 gap-2">
                  {togglingSchedule ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : targetSchedule.is_active ? <RiPauseLine className="w-4 h-4" /> : <RiPlayLine className="w-4 h-4" />}
                  {targetSchedule.is_active ? 'Pause Schedule' : 'Resume Schedule'}
                </Button>
                <Button onClick={handleTriggerNow} disabled={triggeringSchedule} variant="outline" className="flex-1 gap-2">
                  {triggeringSchedule ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiPlayLine className="w-4 h-4" />}
                  Run Now
                </Button>
              </div>

              {/* Execution History */}
              <Separator className="bg-border" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Execution History</p>
                  <Button variant="ghost" size="sm" onClick={() => { if (targetSchedule?.id) loadLogs(targetSchedule.id) }} disabled={logsLoading}>
                    <RiRefreshLine className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {logsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full bg-muted" />
                    <Skeleton className="h-8 w-full bg-muted" />
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No execution history yet</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 border border-border">
                        <div className="flex items-center gap-2">
                          {log.success ? <RiCheckLine className="w-3.5 h-3.5 text-accent" /> : <RiCloseLine className="w-3.5 h-3.5 text-red-400" />}
                          <span className="text-xs">{log.success ? 'Success' : 'Failed'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(log.executed_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <RiHistoryLine className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No schedules found</p>
              <Button variant="outline" size="sm" onClick={loadSchedules} className="mt-3 gap-1">
                <RiRefreshLine className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Page() {
  // Navigation
  const [activeScreen, setActiveScreen] = useState<ScreenType>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Sample data toggle
  const [sampleMode, setSampleMode] = useState(false)

  // Subject inputs
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [energyPreference, setEnergyPreference] = useState<string>('morning')
  const [timezone, setTimezone] = useState('America/New_York')

  // Agent response data
  const [studyPlan, setStudyPlan] = useState<StudyPlanData | null>(null)
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null)

  // Loading states
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [checkingGoals, setCheckingGoals] = useState(false)

  // Status messages
  const [dashboardStatus, setDashboardStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [goalsStatus, setGoalsStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Active agent tracking
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Notifications
  const [notifications, setNotifications] = useState({ deadlineReminders: true, dailyBriefing: true, planUpdates: true })

  // Sample mode toggling
  useEffect(() => {
    if (sampleMode) {
      setSubjects(SAMPLE_SUBJECTS)
      setCommitments(SAMPLE_COMMITMENTS)
      setStudyPlan(SAMPLE_STUDY_PLAN)
      setGoalsData(SAMPLE_GOALS)
    } else {
      setSubjects([])
      setCommitments([])
      setStudyPlan(null)
      setGoalsData(null)
    }
  }, [sampleMode])

  // Generate study plan
  const handleGeneratePlan = async () => {
    if (subjects.length === 0) return
    setGeneratingPlan(true)
    setDashboardStatus({ text: 'Generating your optimized study plan...', type: 'info' })
    setActiveAgentId(STUDY_PLAN_COORDINATOR_ID)
    try {
      const message = `Generate an optimized weekly study plan with these inputs:

SUBJECTS:
${subjects.map(s => `- ${s.name} (Difficulty: ${s.difficulty}/5, Deadline: ${s.deadline})`).join('\n')}

BUSINESS COMMITMENTS:
${commitments.map(c => `- ${c.name} (${c.recurring ? 'Recurring' : 'One-time'}, ${c.timeBlock})`).join('\n')}

ENERGY PREFERENCES:
- Peak energy time: ${energyPreference}
- Timezone: ${timezone}

Please analyze my Google Calendar for free slots, optimize study blocks based on difficulty and energy patterns, and create calendar events for each study session.`

      const result = await callAIAgent(message, STUDY_PLAN_COORDINATOR_ID)
      if (result.success) {
        const data = parseAgentResponse(result)
        if (data) {
          const planData: StudyPlanData = {
            week_start: data.week_start ?? '',
            week_end: data.week_end ?? '',
            study_blocks: Array.isArray(data.study_blocks) ? data.study_blocks : [],
            total_study_hours: data.total_study_hours ?? 0,
            subjects_covered: Array.isArray(data.subjects_covered) ? data.subjects_covered : [],
            balance_score: data.balance_score ?? 0,
            plan_summary: data.plan_summary ?? '',
            recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
          }
          setStudyPlan(planData)
          setDashboardStatus({ text: 'Study plan generated successfully!', type: 'success' })
          setActiveScreen('weekly')
        } else {
          setDashboardStatus({ text: 'Received response but could not parse plan data.', type: 'error' })
        }
      } else {
        setDashboardStatus({ text: result.error || 'Failed to generate study plan.', type: 'error' })
      }
    } catch (err) {
      setDashboardStatus({ text: 'An unexpected error occurred.', type: 'error' })
    }
    setActiveAgentId(null)
    setGeneratingPlan(false)
  }

  // Check goals
  const handleCheckGoals = async () => {
    setCheckingGoals(true)
    setGoalsStatus({ text: 'Analyzing your goals and deadlines...', type: 'info' })
    setActiveAgentId(DEADLINE_GOALS_TRACKER_ID)
    try {
      const message = `Check my upcoming academic deadlines and goal progress.

My current subjects and deadlines:
${subjects.map(s => `- ${s.name}: deadline ${s.deadline}, difficulty ${s.difficulty}/5`).join('\n')}

Please review my Google Calendar for upcoming deadline events, assess my study progress, and provide balance insights between academics and business commitments.`

      const result = await callAIAgent(message, DEADLINE_GOALS_TRACKER_ID)
      if (result.success) {
        const data = parseAgentResponse(result)
        if (data) {
          const goalsResult: GoalsData = {
            upcoming_deadlines: Array.isArray(data.upcoming_deadlines) ? data.upcoming_deadlines : [],
            goal_progress: {
              overall_academic_progress: data.goal_progress?.overall_academic_progress ?? 0,
              weekly_completion_rate: data.goal_progress?.weekly_completion_rate ?? 0,
              balance_score: data.goal_progress?.balance_score ?? 0,
              subjects_at_risk: Array.isArray(data.goal_progress?.subjects_at_risk) ? data.goal_progress.subjects_at_risk : [],
            },
            reminders: Array.isArray(data.reminders) ? data.reminders : [],
            insights: Array.isArray(data.insights) ? data.insights : [],
            balance_analysis: data.balance_analysis ?? '',
            recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
          }
          setGoalsData(goalsResult)
          setGoalsStatus({ text: 'Goals analysis complete!', type: 'success' })
        } else {
          setGoalsStatus({ text: 'Received response but could not parse goals data.', type: 'error' })
        }
      } else {
        setGoalsStatus({ text: result.error || 'Failed to check goals.', type: 'error' })
      }
    } catch (err) {
      setGoalsStatus({ text: 'An unexpected error occurred.', type: 'error' })
    }
    setActiveAgentId(null)
    setCheckingGoals(false)
  }

  const navItems: { screen: ScreenType; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { screen: 'dashboard', icon: RiDashboardLine, label: 'Dashboard' },
    { screen: 'weekly', icon: RiCalendarLine, label: 'Weekly Plan' },
    { screen: 'goals', icon: RiTargetLine, label: 'Goals' },
    { screen: 'settings', icon: RiSettings3Line, label: 'Settings' },
  ]

  const screenTitles: Record<ScreenType, string> = {
    dashboard: 'Dashboard',
    weekly: 'Weekly Plan',
    goals: 'Goals',
    settings: 'Settings',
  }

  const nextDeadlineSubject = subjects.length > 0
    ? subjects.filter(s => s.deadline).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0]
    : null

  const [headerDeadlineDays, setHeaderDeadlineDays] = useState<number | null>(null)
  useEffect(() => {
    if (nextDeadlineSubject?.deadline) {
      const diff = Math.ceil((new Date(nextDeadlineSubject.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      setHeaderDeadlineDays(diff)
    } else {
      setHeaderDeadlineDays(null)
    }
  }, [nextDeadlineSubject?.deadline])

  // Sidebar content
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 p-4 ${sidebarOpen ? '' : 'justify-center'}`}>
        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
          <RiBookOpenLine className="w-5 h-5 text-accent" />
        </div>
        {sidebarOpen && <span className="font-bold text-lg tracking-tight">StudySync AI</span>}
      </div>

      <Separator className="bg-border mx-3" />

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ screen, icon: Icon, label }) => (
          <button key={screen} onClick={() => { setActiveScreen(screen); setMobileSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${activeScreen === screen ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'} ${sidebarOpen ? '' : 'justify-center'}`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
          </button>
        ))}
      </nav>

      {/* Active agent indicator */}
      {activeAgentId && sidebarOpen && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2">
            <RiLoader4Line className="w-4 h-4 text-accent animate-spin" />
            <span className="text-xs text-accent font-medium">Agent working...</span>
          </div>
        </div>
      )}

      {/* Collapse button */}
      <div className="p-3 hidden md:block">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-muted-foreground hover:bg-secondary transition-all">
          {sidebarOpen ? <RiArrowLeftSLine className="w-5 h-5" /> : <RiArrowRightSLine className="w-5 h-5" />}
          {sidebarOpen && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border shadow-2xl">
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 flex-shrink-0 ${sidebarOpen ? 'w-60' : 'w-16'}`}>
          {sidebarContent}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-secondary">
                <RiMenuLine className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold">{screenTitles[activeScreen]}</h1>
            </div>
            <div className="flex items-center gap-3">
              {headerDeadlineDays !== null && (
                <Badge variant="secondary" className="gap-1 text-xs hidden sm:flex">
                  <RiTimeLine className="w-3 h-3" />
                  {headerDeadlineDays}d to deadline
                </Badge>
              )}
              {studyPlan?.balance_score != null && studyPlan.balance_score > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs hidden sm:flex">
                  <RiBarChartLine className="w-3 h-3" />
                  Balance: {studyPlan.balance_score}
                </Badge>
              )}
              {/* Sample data toggle */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground hidden sm:block">Sample Data</Label>
                <Switch checked={sampleMode} onCheckedChange={setSampleMode} />
              </div>
            </div>
          </header>

          {/* Screen content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">
              {activeScreen === 'dashboard' && (
                <DashboardScreen
                  subjects={subjects}
                  setSubjects={setSubjects}
                  commitments={commitments}
                  setCommitments={setCommitments}
                  energyPreference={energyPreference}
                  setEnergyPreference={setEnergyPreference}
                  studyPlan={studyPlan}
                  generatingPlan={generatingPlan}
                  onGeneratePlan={handleGeneratePlan}
                  sampleMode={sampleMode}
                  statusMessage={dashboardStatus}
                />
              )}
              {activeScreen === 'weekly' && (
                <WeeklyPlanScreen
                  studyPlan={studyPlan}
                  subjects={subjects}
                  generatingPlan={generatingPlan}
                  onRegeneratePlan={handleGeneratePlan}
                />
              )}
              {activeScreen === 'goals' && (
                <GoalsScreen
                  goalsData={goalsData}
                  checkingGoals={checkingGoals}
                  onCheckGoals={handleCheckGoals}
                  statusMessage={goalsStatus}
                />
              )}
              {activeScreen === 'settings' && (
                <SettingsScreen
                  timezone={timezone}
                  setTimezone={setTimezone}
                  energyPreference={energyPreference}
                  setEnergyPreference={setEnergyPreference}
                  notifications={notifications}
                  setNotifications={setNotifications}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}

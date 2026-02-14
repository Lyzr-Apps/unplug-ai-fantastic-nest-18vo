'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import {
  FiSend, FiHash, FiTrash2, FiCheck, FiClipboard, FiUsers, FiZap,
  FiMessageSquare, FiChevronDown, FiChevronUp, FiHelpCircle, FiBookmark,
  FiCalendar, FiSearch, FiEdit3, FiCornerUpRight
} from 'react-icons/fi'
import { cn } from '@/lib/utils'

// --- Constants ---
const AGENT_ID = '6990bce6ac906c9d68129086'

// --- Types ---
interface TaskDetection {
  detected: boolean
  title: string
  dueDate: string
  assignee: string
}

interface FollowUpDetection {
  detected: boolean
  question: string
  directedAt: string
  suggestedReply: string
}

interface DecisionDetection {
  detected: boolean
  summary: string
  madeBy: string
  context: string
}

interface MeetingDetection {
  detected: boolean
  topic: string
  time: string
  participants: string
  suggestedAgenda: string
}

interface MessageIntelligence {
  task?: TaskDetection
  followUp?: FollowUpDetection
  decision?: DecisionDetection
  meeting?: MeetingDetection
}

interface Message {
  id: string
  sender: string
  avatar: string
  content: string
  timestamp: Date
  channel: string
  intelligence?: MessageIntelligence
  taskAdded?: boolean
  followUpAdded?: boolean
  decisionAdded?: boolean
  meetingAdded?: boolean
  isProcessing?: boolean
}

interface Task {
  id: string
  title: string
  dueDate?: string
  assignee?: string
  completed: boolean
  fromMessageId: string
  createdAt: Date
}

interface FollowUp {
  id: string
  question: string
  directedAt: string
  suggestedReply: string
  fromSender: string
  fromMessageId: string
  resolved: boolean
  createdAt: Date
  channel: string
}

interface Decision {
  id: string
  summary: string
  madeBy: string
  context: string
  fromMessageId: string
  createdAt: Date
  channel: string
}

interface MeetingItem {
  id: string
  topic: string
  time: string
  participants: string
  suggestedAgenda: string
  notes: string
  fromMessageId: string
  createdAt: Date
  channel: string
  notesAdded: boolean
}

type SidebarTab = 'tasks' | 'followups' | 'decisions'

interface Channel {
  id: string
  name: string
  type: 'channel' | 'dm'
  avatar?: string
}

interface MeetingCardState {
  agendaExpanded: boolean
  notesExpanded: boolean
  editedAgenda: string
  notes: string
}

// --- Static Data ---
const channels: Channel[] = [
  { id: 'general', name: 'general', type: 'channel' },
  { id: 'engineering', name: 'engineering', type: 'channel' },
  { id: 'design', name: 'design', type: 'channel' },
  { id: 'random', name: 'random', type: 'channel' },
]

const dmsList: Channel[] = [
  { id: 'dm-alex', name: 'Alex Turner', type: 'dm', avatar: 'AT' },
  { id: 'dm-sarah', name: 'Sarah Chen', type: 'dm', avatar: 'SC' },
  { id: 'dm-mike', name: 'Mike Ross', type: 'dm', avatar: 'MR' },
]

const avatarColors: Record<string, string> = {
  'AT': 'bg-amber-700 text-amber-50',
  'SC': 'bg-orange-700 text-orange-50',
  'MR': 'bg-yellow-800 text-yellow-50',
  'YO': 'bg-stone-700 text-stone-50',
}

const initialMessages: Message[] = [
  {
    id: '1', sender: 'Alex Turner', avatar: 'AT',
    content: 'Hey team! Hope everyone had a great weekend.',
    timestamp: new Date(Date.now() - 3600000 * 8), channel: 'general',
  },
  {
    id: '2', sender: 'Sarah Chen', avatar: 'SC',
    content: 'We need to finish the API documentation by Wednesday.',
    timestamp: new Date(Date.now() - 3600000 * 7), channel: 'general',
    intelligence: {
      task: { detected: true, title: 'Finish the API documentation', dueDate: 'Wednesday', assignee: '' }
    },
  },
  {
    id: '3', sender: 'Mike Ross', avatar: 'MR',
    content: '@Sarah can you review my pull request when you get a chance?',
    timestamp: new Date(Date.now() - 3600000 * 6), channel: 'general',
    intelligence: {
      followUp: { detected: true, question: 'Can you review my pull request?', directedAt: 'Sarah', suggestedReply: 'Sure, I will review your PR this afternoon and leave comments.' }
    },
  },
  {
    id: '4', sender: 'Alex Turner', avatar: 'AT',
    content: 'After discussing the options, we decided to go with PostgreSQL for the new service.',
    timestamp: new Date(Date.now() - 3600000 * 5), channel: 'general',
    intelligence: {
      decision: { detected: true, summary: 'Go with PostgreSQL for the new service', madeBy: 'Alex Turner', context: 'After evaluating MongoDB and PostgreSQL, team agreed PostgreSQL fits better with existing infrastructure.' }
    },
  },
  {
    id: '5', sender: 'Sarah Chen', avatar: 'SC',
    content: 'Let\'s sync tomorrow at 2pm to discuss the sprint priorities. @Alex @Mike',
    timestamp: new Date(Date.now() - 3600000 * 4), channel: 'general',
    intelligence: {
      meeting: { detected: true, topic: 'Sprint priorities discussion', time: 'Tomorrow at 2pm', participants: 'Sarah, Alex, Mike', suggestedAgenda: '1. Review completed items from current sprint\n2. Discuss blockers and dependencies\n3. Prioritize backlog for next sprint\n4. Assign ownership for top items' }
    },
  },
  {
    id: '6', sender: 'Mike Ross', avatar: 'MR',
    content: 'Deployed the latest build to staging. All tests passing.',
    timestamp: new Date(Date.now() - 7200000), channel: 'engineering',
  },
  {
    id: '7', sender: 'Alex Turner', avatar: 'AT',
    content: 'We need to migrate the database schema before Friday. @Mike can you handle this?',
    timestamp: new Date(Date.now() - 5400000), channel: 'engineering',
    intelligence: {
      task: { detected: true, title: 'Migrate the database schema', dueDate: 'Friday', assignee: 'Mike' },
      followUp: { detected: true, question: 'Can you handle the database migration?', directedAt: 'Mike', suggestedReply: 'Yes, I can start on the migration tomorrow. Will have it done by Thursday.' }
    },
  },
  {
    id: '8', sender: 'Sarah Chen', avatar: 'SC',
    content: 'We approved the new color palette. Let\'s go with the warm amber tones across all components.',
    timestamp: new Date(Date.now() - 6000000), channel: 'design',
    intelligence: {
      decision: { detected: true, summary: 'Approved warm amber tone color palette for all components', madeBy: 'Sarah Chen', context: 'Team reviewed multiple palette options and selected warm amber tones for brand consistency.' }
    },
  },
  {
    id: '9', sender: 'Alex Turner', avatar: 'AT',
    content: 'Let\'s schedule a design review meeting on Monday at 10am. Everyone from the design team should join.',
    timestamp: new Date(Date.now() - 4800000), channel: 'design',
    intelligence: {
      meeting: { detected: true, topic: 'Design review', time: 'Monday at 10am', participants: 'Design team', suggestedAgenda: '1. Review updated color palette implementation\n2. Discuss component library updates\n3. Review responsive design specs' }
    },
  },
]

// --- Helpers ---
function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

// --- Avatar Component ---
function AvatarCircle({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const colorClass = avatarColors[initials] ?? 'bg-stone-600 text-stone-50'
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div className={cn('rounded-full flex items-center justify-center font-medium flex-shrink-0', sizeClass, colorClass)}>
      {initials}
    </div>
  )
}

// --- Processing Dots ---
function ProcessingDots() {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'hsl(27 61% 26%)', animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'hsl(27 61% 26%)', animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'hsl(27 61% 26%)', animationDelay: '300ms' }} />
      </span>
      <span>Analyzing message...</span>
    </div>
  )
}

// --- Inline Task Detection Card ---
function InlineTaskCard({
  task,
  onAdd,
  added,
}: {
  task: TaskDetection
  onAdd: () => void
  added: boolean
}) {
  if (!task?.detected) return null

  if (added) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(140 30% 40%)' }}>
        <FiCheck className="w-3.5 h-3.5" />
        <span>Added to tasks</span>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border-l-4 px-3 py-2.5 flex items-center justify-between gap-3" style={{ borderLeftColor: 'hsl(27 61% 26%)', backgroundColor: 'hsl(35 29% 92%)' }}>
      <div className="flex items-center gap-2 min-w-0">
        <FiClipboard className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(27 61% 26%)' }} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'hsl(30 22% 14%)' }}>
            Task detected: {task.title}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            {task.assignee ? (
              <p className="text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
                Assigned to: {task.assignee}
              </p>
            ) : null}
            {task.dueDate ? (
              <p className="text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
                Due: {task.dueDate}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-90"
        style={{ backgroundColor: 'hsl(27 61% 26%)', color: 'hsl(35 29% 98%)' }}
      >
        Add to tasks
      </button>
    </div>
  )
}

// --- Inline Follow-Up Detection Card ---
function InlineFollowUpCard({
  followUp,
  onTrack,
  tracked,
  onUseReply,
}: {
  followUp: FollowUpDetection
  onTrack: () => void
  tracked: boolean
  onUseReply: (reply: string) => void
}) {
  if (!followUp?.detected) return null

  if (tracked) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(210 40% 50%)' }}>
        <FiCheck className="w-3.5 h-3.5" />
        <span>Tracking follow-up</span>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border-l-4 px-3 py-2.5" style={{ borderLeftColor: 'hsl(210 50% 45%)', backgroundColor: 'hsl(35 29% 92%)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiHelpCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(210 50% 45%)' }} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'hsl(30 22% 14%)' }}>
              Follow-up needed: {followUp.question}
            </p>
            {followUp.directedAt ? (
              <p className="text-xs mt-0.5" style={{ color: 'hsl(30 20% 45%)' }}>
                Directed at: {followUp.directedAt}
              </p>
            ) : null}
          </div>
        </div>
        <button
          onClick={onTrack}
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: 'hsl(210 50% 45%)', color: 'hsl(210 30% 98%)' }}
        >
          Track follow-up
        </button>
      </div>
      {followUp.suggestedReply ? (
        <button
          onClick={() => onUseReply(followUp.suggestedReply)}
          className="mt-1.5 flex items-center gap-1 text-xs hover:underline"
          style={{ color: 'hsl(210 50% 45%)' }}
        >
          <FiCornerUpRight className="w-3 h-3" />
          Use suggested reply
        </button>
      ) : null}
    </div>
  )
}

// --- Inline Decision Detection Card ---
function InlineDecisionCard({
  decision,
  onLog,
  logged,
}: {
  decision: DecisionDetection
  onLog: () => void
  logged: boolean
}) {
  if (!decision?.detected) return null

  if (logged) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(140 30% 40%)' }}>
        <FiCheck className="w-3.5 h-3.5" />
        <span>Decision logged</span>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border-l-4 px-3 py-2.5 flex items-center justify-between gap-3" style={{ borderLeftColor: 'hsl(140 40% 35%)', backgroundColor: 'hsl(35 29% 92%)' }}>
      <div className="flex items-center gap-2 min-w-0">
        <FiBookmark className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(140 40% 35%)' }} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'hsl(30 22% 14%)' }}>
            Decision: {decision.summary}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            {decision.madeBy ? (
              <p className="text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
                By: {decision.madeBy}
              </p>
            ) : null}
          </div>
          {decision.context ? (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(30 20% 45%)' }}>
              {decision.context}
            </p>
          ) : null}
        </div>
      </div>
      <button
        onClick={onLog}
        className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-90"
        style={{ backgroundColor: 'hsl(140 40% 35%)', color: 'hsl(140 20% 98%)' }}
      >
        Log decision
      </button>
    </div>
  )
}

// --- Inline Meeting Detection Card ---
function InlineMeetingCard({
  meeting,
  messageId,
  onSave,
  saved,
  cardState,
  onToggleAgenda,
  onEditAgenda,
  onToggleNotes,
  onEditNotes,
  onSaveNotes,
  notesSaved,
}: {
  meeting: MeetingDetection
  messageId: string
  onSave: (editedAgenda: string) => void
  saved: boolean
  cardState: MeetingCardState
  onToggleAgenda: () => void
  onEditAgenda: (val: string) => void
  onToggleNotes: () => void
  onEditNotes: (val: string) => void
  onSaveNotes: () => void
  notesSaved: boolean
}) {
  if (!meeting?.detected) return null

  if (saved) {
    return (
      <div className="mt-2 rounded-lg border-l-4 px-3 py-2.5" style={{ borderLeftColor: 'hsl(270 40% 45%)', backgroundColor: 'hsl(35 29% 92%)' }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'hsl(270 35% 45%)' }}>
          <FiCheck className="w-3.5 h-3.5" />
          <span className="font-medium">Meeting saved</span>
          <span className="mx-1">-</span>
          <span>{meeting.topic}</span>
          <span className="mx-1">at</span>
          <span>{meeting.time}</span>
        </div>
        {!notesSaved ? (
          <div className="mt-2">
            <button
              onClick={onToggleNotes}
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: 'hsl(270 40% 45%)' }}
            >
              <FiEdit3 className="w-3 h-3" />
              {cardState.notesExpanded ? 'Hide notes' : 'Add notes?'}
            </button>
            {cardState.notesExpanded ? (
              <div className="mt-1.5">
                <textarea
                  value={cardState.notes}
                  onChange={(e) => onEditNotes(e.target.value)}
                  placeholder="Add meeting notes..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-md border resize-none outline-none"
                  style={{ borderColor: 'hsl(35 20% 80%)', backgroundColor: 'hsl(35 29% 96%)', color: 'hsl(30 22% 14%)' }}
                />
                <button
                  onClick={onSaveNotes}
                  className="mt-1 px-2.5 py-1 rounded text-xs font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'hsl(270 40% 45%)', color: 'white' }}
                >
                  Save notes
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(140 30% 40%)' }}>
            <FiCheck className="w-3 h-3" />
            <span>Notes added</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border-l-4 px-3 py-2.5" style={{ borderLeftColor: 'hsl(270 40% 45%)', backgroundColor: 'hsl(35 29% 92%)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiCalendar className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(270 40% 45%)' }} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'hsl(30 22% 14%)' }}>
              Meeting: {meeting.topic}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              {meeting.time ? (
                <p className="text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
                  {meeting.time}
                </p>
              ) : null}
              {meeting.participants ? (
                <p className="text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
                  {meeting.participants}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <button
          onClick={onToggleAgenda}
          className="flex-shrink-0 p-1 rounded hover:bg-black/[0.04] transition-colors"
          style={{ color: 'hsl(270 40% 45%)' }}
        >
          {cardState.agendaExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {cardState.agendaExpanded ? (
        <div className="mt-2">
          <p className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: 'hsl(30 20% 45%)' }}>
            Suggested Agenda
          </p>
          <textarea
            value={cardState.editedAgenda}
            onChange={(e) => onEditAgenda(e.target.value)}
            rows={4}
            className="w-full text-xs p-2 rounded-md border resize-none outline-none"
            style={{ borderColor: 'hsl(35 20% 80%)', backgroundColor: 'hsl(35 29% 96%)', color: 'hsl(30 22% 14%)' }}
          />
          <button
            onClick={() => onSave(cardState.editedAgenda)}
            className="mt-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: 'hsl(270 40% 45%)', color: 'white' }}
          >
            Save meeting
          </button>
        </div>
      ) : null}
    </div>
  )
}

// --- Message Item ---
function MessageItem({
  message,
  onAddTask,
  onTrackFollowUp,
  onLogDecision,
  onSaveMeeting,
  onUseReply,
  meetingCardState,
  onToggleMeetingAgenda,
  onEditMeetingAgenda,
  onToggleMeetingNotes,
  onEditMeetingNotes,
  onSaveMeetingNotes,
}: {
  message: Message
  onAddTask: (msg: Message) => void
  onTrackFollowUp: (msg: Message) => void
  onLogDecision: (msg: Message) => void
  onSaveMeeting: (msg: Message, editedAgenda: string) => void
  onUseReply: (reply: string) => void
  meetingCardState: MeetingCardState
  onToggleMeetingAgenda: (msgId: string) => void
  onEditMeetingAgenda: (msgId: string, val: string) => void
  onToggleMeetingNotes: (msgId: string) => void
  onEditMeetingNotes: (msgId: string, val: string) => void
  onSaveMeetingNotes: (msgId: string) => void
}) {
  const meetingNoteSaved = message.meetingAdded === true && (meetingCardState.notes.length > 0 && !meetingCardState.notesExpanded && meetingCardState.notes !== '')

  return (
    <div className="group flex gap-3 px-4 py-2 hover:bg-black/[0.02] transition-colors">
      <AvatarCircle initials={message.avatar} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium" style={{ color: 'hsl(30 22% 14%)' }}>
            {message.sender}
          </span>
          <span className="text-[11px]" style={{ color: 'hsl(30 20% 45%)' }}>
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm leading-relaxed mt-0.5" style={{ color: 'hsl(30 22% 20%)' }}>
          {message.content}
        </p>

        {message.isProcessing ? <ProcessingDots /> : null}

        {message.intelligence?.task?.detected ? (
          <InlineTaskCard
            task={message.intelligence.task}
            onAdd={() => onAddTask(message)}
            added={message.taskAdded === true}
          />
        ) : null}

        {message.intelligence?.followUp?.detected ? (
          <InlineFollowUpCard
            followUp={message.intelligence.followUp}
            onTrack={() => onTrackFollowUp(message)}
            tracked={message.followUpAdded === true}
            onUseReply={onUseReply}
          />
        ) : null}

        {message.intelligence?.decision?.detected ? (
          <InlineDecisionCard
            decision={message.intelligence.decision}
            onLog={() => onLogDecision(message)}
            logged={message.decisionAdded === true}
          />
        ) : null}

        {message.intelligence?.meeting?.detected ? (
          <InlineMeetingCard
            meeting={message.intelligence.meeting}
            messageId={message.id}
            onSave={(editedAgenda) => onSaveMeeting(message, editedAgenda)}
            saved={message.meetingAdded === true}
            cardState={meetingCardState}
            onToggleAgenda={() => onToggleMeetingAgenda(message.id)}
            onEditAgenda={(val) => onEditMeetingAgenda(message.id, val)}
            onToggleNotes={() => onToggleMeetingNotes(message.id)}
            onEditNotes={(val) => onEditMeetingNotes(message.id, val)}
            onSaveNotes={() => onSaveMeetingNotes(message.id)}
            notesSaved={meetingCardState.notes.length > 0 && !meetingCardState.notesExpanded}
          />
        ) : null}
      </div>
    </div>
  )
}

// --- Task List Item ---
function TaskListItem({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors">
      <button
        onClick={onToggle}
        className={cn(
          'mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          task.completed ? 'border-transparent' : 'border-stone-400 hover:border-stone-500'
        )}
        style={task.completed ? { backgroundColor: 'hsl(27 61% 26%)' } : undefined}
      >
        {task.completed ? <FiCheck className="w-2.5 h-2.5 text-white" /> : null}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn('text-sm leading-snug', task.completed ? 'line-through' : '')}
          style={{ color: task.completed ? 'hsl(30 20% 45%)' : 'hsl(30 22% 14%)' }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.dueDate ? (
            <span className="text-[11px]" style={{ color: 'hsl(30 20% 45%)' }}>
              Due: {task.dueDate}
            </span>
          ) : null}
          {task.assignee ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'hsl(35 20% 85%)', color: 'hsl(27 61% 26%)' }}>
              {task.assignee}
            </span>
          ) : null}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 p-0.5 rounded hover:bg-red-100"
        aria-label="Delete task"
      >
        <FiTrash2 className="w-3.5 h-3.5 text-red-500" />
      </button>
    </div>
  )
}

// --- Follow-Up List Item ---
function FollowUpListItem({
  followUp,
  onResolve,
  onDelete,
  onUseReply,
}: {
  followUp: FollowUp
  onResolve: () => void
  onDelete: () => void
  onUseReply: (reply: string) => void
}) {
  return (
    <div className="group px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors">
      <div className="flex items-start gap-2.5">
        <div className="mt-1 flex-shrink-0">
          {followUp.resolved ? (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(140 40% 45%)' }} />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(210 50% 55%)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn('text-sm leading-snug line-clamp-2', followUp.resolved ? 'line-through' : '')}
            style={{ color: followUp.resolved ? 'hsl(30 20% 45%)' : 'hsl(30 22% 14%)' }}
          >
            {followUp.question}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px]" style={{ color: 'hsl(30 20% 45%)' }}>
              From: {followUp.fromSender}
            </span>
            {followUp.directedAt ? (
              <span className="text-[11px]" style={{ color: 'hsl(30 20% 45%)' }}>
                For: {followUp.directedAt}
              </span>
            ) : null}
          </div>
          {!followUp.resolved ? (
            <div className="flex items-center gap-2 mt-1.5">
              {followUp.suggestedReply ? (
                <button
                  onClick={() => onUseReply(followUp.suggestedReply)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'hsl(210 50% 92%)', color: 'hsl(210 50% 40%)' }}
                >
                  <FiCornerUpRight className="w-2.5 h-2.5" />
                  Use reply
                </button>
              ) : null}
              <button
                onClick={onResolve}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors hover:opacity-80"
                style={{ backgroundColor: 'hsl(140 30% 90%)', color: 'hsl(140 40% 35%)' }}
              >
                <FiCheck className="w-2.5 h-2.5" />
                Mark resolved
              </button>
            </div>
          ) : null}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 p-0.5 rounded hover:bg-red-100 flex-shrink-0"
          aria-label="Delete follow-up"
        >
          <FiTrash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  )
}

// --- Decision List Item ---
function DecisionListItem({
  decision,
  onDelete,
  mounted,
}: {
  decision: Decision
  onDelete: () => void
  mounted: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const channelName = channels.find(c => c.id === decision.channel)?.name ?? decision.channel

  return (
    <div className="group px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors">
      <div className="flex items-start gap-2.5">
        <FiBookmark className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsl(140 40% 35%)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: 'hsl(30 22% 14%)' }}>
            {decision.summary}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {decision.madeBy ? (
              <span className="text-[11px]" style={{ color: 'hsl(30 20% 45%)' }}>
                By: {decision.madeBy}
              </span>
            ) : null}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'hsl(35 20% 85%)', color: 'hsl(30 20% 45%)' }}>
              #{channelName}
            </span>
            <span className="text-[10px]" style={{ color: 'hsl(30 15% 55%)' }}>
              {mounted ? formatTime(decision.createdAt) : ''}
            </span>
          </div>
          {decision.context ? (
            <div className="mt-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: 'hsl(140 40% 35%)' }}
              >
                {expanded ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />}
                {expanded ? 'Less' : 'More context'}
              </button>
              {expanded ? (
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'hsl(30 20% 40%)' }}>
                  {decision.context}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 p-0.5 rounded hover:bg-red-100 flex-shrink-0"
          aria-label="Delete decision"
        >
          <FiTrash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  )
}


// === MAIN PAGE ===
export default function Page() {
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [tasks, setTasks] = useState<Task[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [meetings, setMeetings] = useState<MeetingItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('tasks')
  const [decisionSearch, setDecisionSearch] = useState('')
  const [meetingCardStates, setMeetingCardStates] = useState<Record<string, MeetingCardState>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Hydration safety
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChannel])

  // Helpers for meeting card states
  const getMeetingCardState = useCallback((msgId: string, defaultAgenda: string): MeetingCardState => {
    return meetingCardStates[msgId] ?? {
      agendaExpanded: false,
      notesExpanded: false,
      editedAgenda: defaultAgenda,
      notes: '',
    }
  }, [meetingCardStates])

  const updateMeetingCardState = useCallback((msgId: string, updates: Partial<MeetingCardState>) => {
    setMeetingCardStates(prev => {
      const current = prev[msgId] ?? { agendaExpanded: false, notesExpanded: false, editedAgenda: '', notes: '' }
      return { ...prev, [msgId]: { ...current, ...updates } }
    })
  }, [])

  // Channel data
  const allChannels = [...channels, ...dmsList]
  const currentChannel = allChannels.find(c => c.id === activeChannel)
  const currentMessages = messages.filter(m => m.channel === activeChannel)

  // Sorted tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  // Sorted follow-ups
  const sortedFollowUps = [...followUps].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  // Filtered decisions
  const filteredDecisions = decisions.filter(d => {
    if (!decisionSearch.trim()) return true
    const s = decisionSearch.toLowerCase()
    return (
      (d.summary?.toLowerCase() ?? '').includes(s) ||
      (d.madeBy?.toLowerCase() ?? '').includes(s) ||
      (d.context?.toLowerCase() ?? '').includes(s)
    )
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // Counts
  const incompleteTasks = tasks.filter(t => !t.completed).length
  const unresolvedFollowUps = followUps.filter(f => !f.resolved).length
  const totalDecisions = decisions.length

  // --- Send Message ---
  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isSending) return

    const messageId = generateId()
    const newMessage: Message = {
      id: messageId,
      sender: 'You',
      avatar: 'YO',
      content: text,
      timestamp: new Date(),
      channel: activeChannel,
      isProcessing: true,
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue('')
    setIsSending(true)

    try {
      const result = await callAIAgent(text, AGENT_ID)

      if (result?.success) {
        let parsed = result?.response?.result
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed)
          } catch {
            parsed = null
          }
        }

        if (parsed) {
          const intelligence: MessageIntelligence = {}

          if (parsed.task?.detected) {
            intelligence.task = {
              detected: true,
              title: parsed.task.title ?? '',
              dueDate: parsed.task.dueDate ?? '',
              assignee: parsed.task.assignee ?? '',
            }
          }
          if (parsed.followUp?.detected) {
            intelligence.followUp = {
              detected: true,
              question: parsed.followUp.question ?? '',
              directedAt: parsed.followUp.directedAt ?? '',
              suggestedReply: parsed.followUp.suggestedReply ?? '',
            }
          }
          if (parsed.decision?.detected) {
            intelligence.decision = {
              detected: true,
              summary: parsed.decision.summary ?? '',
              madeBy: parsed.decision.madeBy ?? '',
              context: parsed.decision.context ?? '',
            }
          }
          if (parsed.meeting?.detected) {
            intelligence.meeting = {
              detected: true,
              topic: parsed.meeting.topic ?? '',
              time: parsed.meeting.time ?? '',
              participants: parsed.meeting.participants ?? '',
              suggestedAgenda: parsed.meeting.suggestedAgenda ?? '',
            }
          }

          setMessages(prev =>
            prev.map(m =>
              m.id === messageId
                ? {
                    ...m,
                    isProcessing: false,
                    intelligence: Object.keys(intelligence).length > 0 ? intelligence : undefined,
                  }
                : m
            )
          )
        } else {
          setMessages(prev =>
            prev.map(m =>
              m.id === messageId ? { ...m, isProcessing: false } : m
            )
          )
        }
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, isProcessing: false } : m
          )
        )
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, isProcessing: false } : m
        )
      )
    } finally {
      setIsSending(false)
    }
  }, [inputValue, isSending, activeChannel])

  // --- Action Handlers ---
  const handleAddTask = useCallback((msg: Message) => {
    if (!msg.intelligence?.task?.detected || msg.taskAdded) return
    const newTask: Task = {
      id: generateId(),
      title: msg.intelligence.task.title,
      dueDate: msg.intelligence.task.dueDate || undefined,
      assignee: msg.intelligence.task.assignee || undefined,
      completed: false,
      fromMessageId: msg.id,
      createdAt: new Date(),
    }
    setTasks(prev => [...prev, newTask])
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, taskAdded: true } : m))
  }, [])

  const handleTrackFollowUp = useCallback((msg: Message) => {
    if (!msg.intelligence?.followUp?.detected || msg.followUpAdded) return
    const newFollowUp: FollowUp = {
      id: generateId(),
      question: msg.intelligence.followUp.question,
      directedAt: msg.intelligence.followUp.directedAt,
      suggestedReply: msg.intelligence.followUp.suggestedReply,
      fromSender: msg.sender,
      fromMessageId: msg.id,
      resolved: false,
      createdAt: new Date(),
      channel: msg.channel,
    }
    setFollowUps(prev => [...prev, newFollowUp])
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, followUpAdded: true } : m))
  }, [])

  const handleLogDecision = useCallback((msg: Message) => {
    if (!msg.intelligence?.decision?.detected || msg.decisionAdded) return
    const newDecision: Decision = {
      id: generateId(),
      summary: msg.intelligence.decision.summary,
      madeBy: msg.intelligence.decision.madeBy,
      context: msg.intelligence.decision.context,
      fromMessageId: msg.id,
      createdAt: new Date(),
      channel: msg.channel,
    }
    setDecisions(prev => [...prev, newDecision])
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, decisionAdded: true } : m))
  }, [])

  const handleSaveMeeting = useCallback((msg: Message, editedAgenda: string) => {
    if (!msg.intelligence?.meeting?.detected || msg.meetingAdded) return
    const newMeeting: MeetingItem = {
      id: generateId(),
      topic: msg.intelligence.meeting.topic,
      time: msg.intelligence.meeting.time,
      participants: msg.intelligence.meeting.participants,
      suggestedAgenda: editedAgenda || msg.intelligence.meeting.suggestedAgenda,
      notes: '',
      fromMessageId: msg.id,
      createdAt: new Date(),
      channel: msg.channel,
      notesAdded: false,
    }
    setMeetings(prev => [...prev, newMeeting])
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, meetingAdded: true } : m))
    updateMeetingCardState(msg.id, { agendaExpanded: false })
  }, [updateMeetingCardState])

  const handleUseSuggestedReply = useCallback((reply: string) => {
    setInputValue(reply)
    inputRef.current?.focus()
  }, [])

  const handleToggleTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t))
  }, [])

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])

  const handleResolveFollowUp = useCallback((id: string) => {
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, resolved: !f.resolved } : f))
  }, [])

  const handleDeleteFollowUp = useCallback((id: string) => {
    setFollowUps(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleDeleteDecision = useCallback((id: string) => {
    setDecisions(prev => prev.filter(d => d.id !== id))
  }, [])

  const handleSaveMeetingNotes = useCallback((msgId: string) => {
    const state = meetingCardStates[msgId]
    if (!state?.notes?.trim()) return
    setMeetings(prev => prev.map(m => {
      if (m.fromMessageId === msgId) {
        return { ...m, notes: state.notes, notesAdded: true }
      }
      return m
    }))
    updateMeetingCardState(msgId, { notesExpanded: false })
  }, [meetingCardStates, updateMeetingCardState])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    },
    [handleSendMessage]
  )

  const channelDisplayName = currentChannel?.type === 'channel'
    ? `# ${currentChannel?.name ?? ''}`
    : currentChannel?.name ?? ''

  const memberCount = currentChannel?.type === 'channel' ? 4 : undefined

  return (
    <div className="h-screen flex overflow-hidden font-sans" style={{ backgroundColor: 'hsl(35 29% 95%)' }}>
      {/* === LEFT SIDEBAR === */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ backgroundColor: 'hsl(35 25% 90%)', borderRightColor: 'hsl(35 20% 85%)' }}
      >
        {/* Workspace Header */}
        <div className="px-4 py-4 flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'hsl(27 61% 26%)' }}
          >
            <FiZap className="w-4 h-4" style={{ color: 'hsl(35 29% 98%)' }} />
          </div>
          <h1 className="text-lg font-serif font-semibold tracking-wide" style={{ color: 'hsl(30 22% 14%)' }}>
            Unplug
          </h1>
        </div>

        {/* Channels */}
        <div className="px-3 mt-2">
          <p className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'hsl(30 20% 45%)' }}>
            Channels
          </p>
          <nav className="space-y-0.5">
            {channels.map(ch => {
              const isActive = activeChannel === ch.id
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    isActive ? 'font-medium' : 'hover:bg-black/[0.04]'
                  )}
                  style={
                    isActive
                      ? { color: 'hsl(27 61% 26%)', backgroundColor: 'hsl(35 20% 85%)' }
                      : { color: 'hsl(30 22% 14%)' }
                  }
                >
                  <FiHash className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <span>{ch.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* DMs */}
        <div className="px-3 mt-5">
          <p className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'hsl(30 20% 45%)' }}>
            Direct Messages
          </p>
          <nav className="space-y-0.5">
            {dmsList.map(dm => {
              const isActive = activeChannel === dm.id
              return (
                <button
                  key={dm.id}
                  onClick={() => setActiveChannel(dm.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    isActive ? 'font-medium' : 'hover:bg-black/[0.04]'
                  )}
                  style={
                    isActive
                      ? { color: 'hsl(27 61% 26%)', backgroundColor: 'hsl(35 20% 85%)' }
                      : { color: 'hsl(30 22% 14%)' }
                  }
                >
                  <AvatarCircle initials={dm.avatar ?? '??'} size="sm" />
                  <span>{dm.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Agent Info */}
        <div className="mt-auto px-3 pb-4 pt-4">
          <div className="rounded-lg p-3" style={{ backgroundColor: 'hsl(35 20% 85%)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-[11px] font-medium" style={{ color: 'hsl(30 22% 14%)' }}>
                Message Intelligence Agent
              </span>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'hsl(30 20% 45%)' }}>
              Detects tasks, follow-ups, decisions, and meetings in your messages.
            </p>
          </div>
        </div>
      </aside>

      {/* === CENTER CHAT === */}
      <main className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'hsl(35 29% 95%)' }}>
        {/* Channel Header */}
        <header
          className="flex-shrink-0 px-5 py-3 flex items-center justify-between border-b"
          style={{ borderBottomColor: 'hsl(35 20% 85%)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base font-serif font-semibold tracking-wide" style={{ color: 'hsl(30 22% 14%)' }}>
              {channelDisplayName}
            </h2>
            {memberCount != null ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
                <FiUsers className="w-3 h-3" />
                {memberCount}
              </span>
            ) : null}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="py-4">
            {currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full pt-20">
                <FiMessageSquare className="w-10 h-10 mb-3" style={{ color: 'hsl(35 15% 75%)' }} />
                <p className="text-sm" style={{ color: 'hsl(30 20% 45%)' }}>
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              currentMessages.map(msg => (
                <MessageItem
                  key={msg.id}
                  message={mounted ? msg : { ...msg, timestamp: new Date(0) }}
                  onAddTask={handleAddTask}
                  onTrackFollowUp={handleTrackFollowUp}
                  onLogDecision={handleLogDecision}
                  onSaveMeeting={handleSaveMeeting}
                  onUseReply={handleUseSuggestedReply}
                  meetingCardState={getMeetingCardState(msg.id, msg.intelligence?.meeting?.suggestedAgenda ?? '')}
                  onToggleMeetingAgenda={(msgId) => {
                    const current = getMeetingCardState(msgId, msg.intelligence?.meeting?.suggestedAgenda ?? '')
                    updateMeetingCardState(msgId, {
                      agendaExpanded: !current.agendaExpanded,
                      editedAgenda: current.editedAgenda || (msg.intelligence?.meeting?.suggestedAgenda ?? ''),
                    })
                  }}
                  onEditMeetingAgenda={(msgId, val) => updateMeetingCardState(msgId, { editedAgenda: val })}
                  onToggleMeetingNotes={(msgId) => {
                    const current = getMeetingCardState(msgId, '')
                    updateMeetingCardState(msgId, { notesExpanded: !current.notesExpanded })
                  }}
                  onEditMeetingNotes={(msgId, val) => updateMeetingCardState(msgId, { notes: val })}
                  onSaveMeetingNotes={handleSaveMeetingNotes}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t" style={{ borderTopColor: 'hsl(35 20% 85%)' }}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-shadow leading-relaxed"
              style={{
                backgroundColor: 'hsl(35 15% 88%)',
                color: 'hsl(30 22% 14%)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
              }}
              onFocus={e => {
                e.currentTarget.style.boxShadow = '0 0 0 2px hsl(27 61% 26%)'
              }}
              onBlur={e => {
                e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isSending}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'hsl(27 61% 26%)' }}
            >
              <FiSend className="w-4 h-4" style={{ color: 'hsl(35 29% 98%)' }} />
            </button>
          </div>
        </div>
      </main>

      {/* === RIGHT SIDEBAR === */}
      <aside
        className="w-[300px] flex-shrink-0 flex flex-col border-l overflow-hidden"
        style={{ backgroundColor: 'hsl(35 29% 92%)', borderLeftColor: 'hsl(35 20% 85%)' }}
      >
        {/* Tab Bar */}
        <div className="flex-shrink-0 flex border-b" style={{ borderBottomColor: 'hsl(35 20% 85%)' }}>
          <button
            onClick={() => setSidebarTab('tasks')}
            className={cn('flex-1 px-2 py-3 text-xs font-medium transition-colors relative text-center')}
            style={{ color: sidebarTab === 'tasks' ? 'hsl(27 61% 26%)' : 'hsl(30 20% 45%)' }}
          >
            <span className={sidebarTab === 'tasks' ? 'font-semibold' : ''}>Tasks</span>
            {incompleteTasks > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] rounded-full font-medium" style={{ backgroundColor: 'hsl(27 61% 26%)', color: 'hsl(35 29% 98%)' }}>
                {incompleteTasks}
              </span>
            ) : null}
            {sidebarTab === 'tasks' ? (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: 'hsl(27 61% 26%)' }} />
            ) : null}
          </button>
          <button
            onClick={() => setSidebarTab('followups')}
            className={cn('flex-1 px-2 py-3 text-xs font-medium transition-colors relative text-center')}
            style={{ color: sidebarTab === 'followups' ? 'hsl(210 50% 45%)' : 'hsl(30 20% 45%)' }}
          >
            <span className={sidebarTab === 'followups' ? 'font-semibold' : ''}>Follow-ups</span>
            {unresolvedFollowUps > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] rounded-full font-medium" style={{ backgroundColor: 'hsl(210 50% 45%)', color: 'white' }}>
                {unresolvedFollowUps}
              </span>
            ) : null}
            {sidebarTab === 'followups' ? (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: 'hsl(210 50% 45%)' }} />
            ) : null}
          </button>
          <button
            onClick={() => setSidebarTab('decisions')}
            className={cn('flex-1 px-2 py-3 text-xs font-medium transition-colors relative text-center')}
            style={{ color: sidebarTab === 'decisions' ? 'hsl(140 40% 35%)' : 'hsl(30 20% 45%)' }}
          >
            <span className={sidebarTab === 'decisions' ? 'font-semibold' : ''}>Decisions</span>
            {totalDecisions > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] rounded-full font-medium" style={{ backgroundColor: 'hsl(140 40% 35%)', color: 'white' }}>
                {totalDecisions}
              </span>
            ) : null}
            {sidebarTab === 'decisions' ? (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: 'hsl(140 40% 35%)' }} />
            ) : null}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Tasks Tab */}
          {sidebarTab === 'tasks' ? (
            sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-16 px-4 text-center">
                <FiClipboard className="w-8 h-8 mb-3" style={{ color: 'hsl(35 15% 75%)' }} />
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(30 20% 45%)' }}>
                  No tasks yet. Tasks detected from your messages will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {sortedTasks.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleTask(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
              </div>
            )
          ) : null}

          {/* Follow-ups Tab */}
          {sidebarTab === 'followups' ? (
            sortedFollowUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-16 px-4 text-center">
                <FiHelpCircle className="w-8 h-8 mb-3" style={{ color: 'hsl(35 15% 75%)' }} />
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(30 20% 45%)' }}>
                  No follow-ups. Questions detected in messages will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {sortedFollowUps.map(fu => (
                  <FollowUpListItem
                    key={fu.id}
                    followUp={fu}
                    onResolve={() => handleResolveFollowUp(fu.id)}
                    onDelete={() => handleDeleteFollowUp(fu.id)}
                    onUseReply={handleUseSuggestedReply}
                  />
                ))}
              </div>
            )
          ) : null}

          {/* Decisions Tab */}
          {sidebarTab === 'decisions' ? (
            <div>
              {/* Search */}
              <div className="px-1 pb-2">
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'hsl(30 20% 55%)' }} />
                  <input
                    type="text"
                    value={decisionSearch}
                    onChange={(e) => setDecisionSearch(e.target.value)}
                    placeholder="Search decisions..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs outline-none border"
                    style={{ borderColor: 'hsl(35 20% 82%)', backgroundColor: 'hsl(35 29% 96%)', color: 'hsl(30 22% 14%)' }}
                  />
                </div>
              </div>
              {filteredDecisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-12 px-4 text-center">
                  <FiBookmark className="w-8 h-8 mb-3" style={{ color: 'hsl(35 15% 75%)' }} />
                  <p className="text-sm leading-relaxed" style={{ color: 'hsl(30 20% 45%)' }}>
                    {decisionSearch.trim()
                      ? 'No decisions match your search.'
                      : 'No decisions logged. Team decisions detected in messages will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredDecisions.map(d => (
                    <DecisionListItem
                      key={d.id}
                      decision={d}
                      onDelete={() => handleDeleteDecision(d.id)}
                      mounted={mounted}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

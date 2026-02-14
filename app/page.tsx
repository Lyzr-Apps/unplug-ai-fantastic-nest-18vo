'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { FiSend, FiHash, FiTrash2, FiCheck, FiClipboard, FiUsers, FiZap, FiMessageSquare, FiChevronDown } from 'react-icons/fi'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// --- Constants ---
const AGENT_ID = '6990bce6ac906c9d68129086'

// --- Types ---
interface TaskDetection {
  hasTask: boolean
  taskTitle: string
  dueDate: string
}

interface Message {
  id: string
  sender: string
  avatar: string
  content: string
  timestamp: Date
  channel: string
  taskDetected?: TaskDetection
  taskAdded?: boolean
  isProcessing?: boolean
}

interface Task {
  id: string
  title: string
  dueDate?: string
  completed: boolean
  fromMessageId: string
  createdAt: Date
}

interface Channel {
  id: string
  name: string
  type: 'channel' | 'dm'
  avatar?: string
}

// --- Static Data ---
const channels: Channel[] = [
  { id: 'general', name: 'general', type: 'channel' },
  { id: 'engineering', name: 'engineering', type: 'channel' },
  { id: 'design', name: 'design', type: 'channel' },
  { id: 'random', name: 'random', type: 'channel' },
]

const dms: Channel[] = [
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
    timestamp: new Date(Date.now() - 3600000 * 5), channel: 'general',
  },
  {
    id: '2', sender: 'Sarah Chen', avatar: 'SC',
    content: 'We need to finish the API documentation by Wednesday.',
    timestamp: new Date(Date.now() - 3600000 * 4), channel: 'general',
    taskDetected: { hasTask: true, taskTitle: 'Finish the API documentation', dueDate: 'Wednesday' },
    taskAdded: false,
  },
  {
    id: '3', sender: 'Mike Ross', avatar: 'MR',
    content: 'Sure thing! I can handle the authentication endpoints section.',
    timestamp: new Date(Date.now() - 3600000 * 3), channel: 'general',
  },
  {
    id: '4', sender: 'Alex Turner', avatar: 'AT',
    content: 'Perfect. Also, someone should review the pull request for the new dashboard.',
    timestamp: new Date(Date.now() - 3600000 * 2), channel: 'general',
    taskDetected: { hasTask: true, taskTitle: 'Review the pull request for the new dashboard', dueDate: '' },
    taskAdded: false,
  },
  {
    id: '5', sender: 'Sarah Chen', avatar: 'SC',
    content: 'Good morning! Ready for standup?',
    timestamp: new Date(Date.now() - 3600000), channel: 'general',
  },
  // Engineering channel
  {
    id: '6', sender: 'Mike Ross', avatar: 'MR',
    content: 'Deployed the latest build to staging. All tests passing.',
    timestamp: new Date(Date.now() - 7200000), channel: 'engineering',
  },
  {
    id: '7', sender: 'Alex Turner', avatar: 'AT',
    content: 'We need to migrate the database schema before Friday.',
    timestamp: new Date(Date.now() - 5400000), channel: 'engineering',
    taskDetected: { hasTask: true, taskTitle: 'Migrate the database schema', dueDate: 'Friday' },
    taskAdded: false,
  },
  // Design channel
  {
    id: '8', sender: 'Sarah Chen', avatar: 'SC',
    content: 'Updated the Figma file with the new color palette. Take a look when you get a chance.',
    timestamp: new Date(Date.now() - 6000000), channel: 'design',
  },
  {
    id: '9', sender: 'Alex Turner', avatar: 'AT',
    content: 'Looks great! The warm tones really work well together.',
    timestamp: new Date(Date.now() - 4800000), channel: 'design',
  },
]

// --- Helper: format time ---
function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// --- Helper: generate unique ID ---
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

// --- Task Detection Card ---
function TaskCard({
  task,
  onAdd,
  added,
}: {
  task: TaskDetection
  onAdd: () => void
  added: boolean
}) {
  if (!task?.hasTask) return null

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
            Task detected: {task.taskTitle}
          </p>
          {task.dueDate ? (
            <p className="text-xs mt-0.5" style={{ color: 'hsl(30 20% 45%)' }}>
              Due: {task.dueDate}
            </p>
          ) : null}
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

// --- Message Item ---
function MessageItem({
  message,
  onAddTask,
}: {
  message: Message
  onAddTask: (msg: Message) => void
}) {
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
        {message.isProcessing ? (
          <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'hsl(30 20% 45%)' }}>
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'hsl(27 61% 26%)', animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'hsl(27 61% 26%)', animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'hsl(27 61% 26%)', animationDelay: '300ms' }} />
            </span>
            <span>Analyzing for tasks...</span>
          </div>
        ) : null}
        {message.taskDetected?.hasTask ? (
          <TaskCard
            task={message.taskDetected}
            onAdd={() => onAddTask(message)}
            added={message.taskAdded === true}
          />
        ) : null}
      </div>
    </div>
  )
}

// --- Task List Item ---
function TaskItem({
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
          task.completed
            ? 'border-transparent'
            : 'border-stone-400 hover:border-stone-500'
        )}
        style={task.completed ? { backgroundColor: 'hsl(27 61% 26%)' } : undefined}
      >
        {task.completed ? <FiCheck className="w-2.5 h-2.5 text-white" /> : null}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm leading-snug',
            task.completed ? 'line-through' : ''
          )}
          style={{ color: task.completed ? 'hsl(30 20% 45%)' : 'hsl(30 22% 14%)' }}
        >
          {task.title}
        </p>
        {task.dueDate ? (
          <p className="text-[11px] mt-0.5" style={{ color: 'hsl(30 20% 45%)' }}>
            Due: {task.dueDate}
          </p>
        ) : null}
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

// === MAIN PAGE ===
export default function Page() {
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [tasks, setTasks] = useState<Task[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Timestamps for hydration safety
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChannel])

  // Get current channel info
  const allChannels = [...channels, ...dms]
  const currentChannel = allChannels.find(c => c.id === activeChannel)
  const currentMessages = messages.filter(m => m.channel === activeChannel)

  // Sort tasks: incomplete first, then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  const incompleteTasks = tasks.filter(t => !t.completed)

  // --- Handlers ---
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
            parsed = { hasTask: false, taskTitle: '', dueDate: '' }
          }
        }

        const hasTask = parsed?.hasTask === true
        const taskTitle = parsed?.taskTitle ?? ''
        const dueDate = parsed?.dueDate ?? ''

        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  isProcessing: false,
                  taskDetected: hasTask
                    ? { hasTask: true, taskTitle, dueDate }
                    : undefined,
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

  const handleAddTask = useCallback((msg: Message) => {
    if (!msg.taskDetected?.hasTask || msg.taskAdded) return

    const newTask: Task = {
      id: generateId(),
      title: msg.taskDetected.taskTitle,
      dueDate: msg.taskDetected.dueDate || undefined,
      completed: false,
      fromMessageId: msg.id,
      createdAt: new Date(),
    }

    setTasks(prev => [...prev, newTask])
    setMessages(prev =>
      prev.map(m => (m.id === msg.id ? { ...m, taskAdded: true } : m))
    )
  }, [])

  const handleToggleTask = useCallback((taskId: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    )
  }, [])

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])

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
            {dms.map(dm => {
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

        {/* Spacer + Agent Info */}
        <div className="mt-auto px-3 pb-4 pt-4">
          <div className="rounded-lg p-3" style={{ backgroundColor: 'hsl(35 20% 85%)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-[11px] font-medium" style={{ color: 'hsl(30 22% 14%)' }}>
                Task Extractor Agent
              </span>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'hsl(30 20% 45%)' }}>
              Analyzes messages to detect actionable tasks, deadlines, and assignments.
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

      {/* === RIGHT SIDEBAR - TASKS === */}
      <aside
        className="w-[280px] flex-shrink-0 flex flex-col border-l overflow-hidden"
        style={{ backgroundColor: 'hsl(35 29% 92%)', borderLeftColor: 'hsl(35 20% 85%)' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between border-b" style={{ borderBottomColor: 'hsl(35 20% 85%)' }}>
          <h2 className="text-base font-serif font-semibold tracking-wide" style={{ color: 'hsl(30 22% 14%)' }}>
            Tasks
          </h2>
          <Badge
            className="text-[11px] px-2 py-0.5 font-medium rounded-full border-0"
            style={{ backgroundColor: 'hsl(27 61% 26%)', color: 'hsl(35 29% 98%)' }}
          >
            {incompleteTasks.length}
          </Badge>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-2">
          {sortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 px-4 text-center">
              <FiClipboard className="w-8 h-8 mb-3" style={{ color: 'hsl(35 15% 75%)' }} />
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(30 20% 45%)' }}>
                No tasks yet. Tasks detected from your messages will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sortedTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggleTask(task.id)}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

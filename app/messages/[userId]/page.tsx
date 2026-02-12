'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read_at: string | null
  created_at: string
}

export default function MessagePage() {
  const router = useRouter()
  const params = useParams()
  const otherUserId = params.userId as string

  const [user, setUser] = useState<User | null>(null)
  const [otherUser, setOtherUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 스크롤을 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchOtherUser()
          fetchMessages(data.user.id)
          markAsRead(data.user.id)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router, otherUserId])

  // Supabase Realtime 구독
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`messages-${user.id}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as Message
          // 이 대화방에 해당하는 메시지만 추가
          if (
            (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === user.id)
          ) {
            setMessages(prev => {
              // 중복 방지
              if (prev.find(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            // 상대방이 보낸 메시지는 읽음 처리
            if (msg.sender_id === otherUserId) {
              supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', msg.id)
                .then()
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, otherUserId])

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchOtherUser = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', otherUserId)
      .single()

    if (data) setOtherUser(data)
  }

  const fetchMessages = async (myId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`
      )
      .order('created_at', { ascending: true })

    if (data) setMessages(data)
  }

  const markAsRead = async (myId: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', myId)
      .is('read_at', null)
  }

  const handleSend = async () => {
    if (!user || !newMessage.trim() || sending) return
    setSending(true)

    const content = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      content,
    })

    if (error) {
      console.error('Send error:', error)
      setNewMessage(content) // 실패 시 복원
    }

    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return '오늘'
    if (date.toDateString() === yesterday.toDateString()) return '어제'
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // 날짜 구분선 표시 여부
  const shouldShowDateLabel = (idx: number) => {
    if (idx === 0) return true
    const prev = new Date(messages[idx - 1].created_at).toDateString()
    const curr = new Date(messages[idx].created_at).toDateString()
    return prev !== curr
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  const isTrainer = user.role === 'trainer'

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (isTrainer) {
                router.push('/trainer')
              } else {
                router.push('/dashboard')
              }
            }}
            className="text-gray-600"
          >
            <span className="text-2xl">←</span>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">
              {otherUser?.name || '대화'}
            </h1>
            <p className="text-xs text-gray-500">
              {otherUser?.role === 'trainer' ? '트레이너' : '환자'}
            </p>
          </div>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">첫 메시지를 보내보세요!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === user.id
              const showDate = shouldShowDateLabel(idx)

              return (
                <div key={msg.id}>
                  {/* 날짜 구분선 */}
                  {showDate && (
                    <div className="flex items-center justify-center my-4">
                      <span className="bg-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full">
                        {formatDateLabel(msg.created_at)}
                      </span>
                    </div>
                  )}

                  {/* 말풍선 */}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className={`flex items-end gap-1.5 max-w-[75%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                          isMine
                            ? 'bg-blue-500 text-white rounded-br-sm'
                            : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {isMine && msg.read_at && (
                          <span className="text-[10px] text-blue-400">읽음</span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="bg-white border-t sticky bottom-0">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            className="flex-1 border rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-600 disabled:bg-blue-300 transition flex-shrink-0"
          >
            <span className="text-lg">↑</span>
          </button>
        </div>
      </div>
    </div>
  )
}

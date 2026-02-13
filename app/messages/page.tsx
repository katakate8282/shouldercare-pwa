'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface ChatRoom {
  otherUserId: string
  otherUserName: string
  otherUserRole: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

export default function MessagesListPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchChatRooms(data.user.id)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  // Realtime 구독 - 새 메시지 올 때 목록 갱신
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`chatlist-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as any
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            fetchChatRooms(user.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchChatRooms = async (myId: string) => {
    // 내가 보내거나 받은 모든 메시지 조회
    const { data: sentMessages } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false })

    if (!sentMessages) return

    // 대화 상대별로 그룹화
    const roomMap: Record<string, {
      lastMessage: string
      lastMessageAt: string
      unreadCount: number
    }> = {}

    sentMessages.forEach(msg => {
      const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id

      if (!roomMap[otherId]) {
        roomMap[otherId] = {
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        }
      }

      // 읽지 않은 메시지 카운트 (상대가 보낸 것 중 read_at이 null)
      if (msg.sender_id !== myId && !msg.read_at) {
        roomMap[otherId].unreadCount++
      }
    })

    // 상대방 유저 정보 조회
    const otherIds = Object.keys(roomMap)
    if (otherIds.length === 0) {
      setChatRooms([])
      return
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, role')
      .in('id', otherIds)

    const userMap: Record<string, User> = {}
    users?.forEach(u => { userMap[u.id] = u })

    const rooms: ChatRoom[] = otherIds.map(id => ({
      otherUserId: id,
      otherUserName: userMap[id]?.name || '알 수 없음',
      otherUserRole: userMap[id]?.role || 'patient',
      lastMessage: roomMap[id].lastMessage,
      lastMessageAt: roomMap[id].lastMessageAt,
      unreadCount: roomMap[id].unreadCount,
    }))

    // 최근 메시지 순 정렬
    rooms.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

    setChatRooms(rooms)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // 오늘이면 시간만
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }

    // 어제
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) {
      return '어제'
    }

    // 7일 이내
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      return `${days}일 전`
    }

    // 그 외
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
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
    <div className="min-h-screen bg-gray-50 pb-24">
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
          <h1 className="text-lg font-bold text-gray-900">메시지</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {chatRooms.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">대화 내역이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y">
            {chatRooms.map((room) => (
              <button
                key={room.otherUserId}
                onClick={() => router.push(`/messages/${room.otherUserId}`)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
              >
                {/* 프로필 아이콘 */}
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">
                    {room.otherUserRole === 'trainer' ? '👨‍⚕️' : '👤'}
                  </span>
                </div>

                {/* 이름 + 마지막 메시지 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 text-sm">{room.otherUserName}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTime(room.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-500 truncate pr-2">
                      {room.lastMessage}
                    </p>
                    {room.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 flex-shrink-0">
                        {room.unreadCount > 99 ? '99+' : room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <BottomNav role={user.role || "patient"} />
    </div>
  )
}

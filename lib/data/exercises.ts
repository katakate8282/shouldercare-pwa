// lib/data/exercises.ts
// 운동 데이터 - Supabase DB 연동 버전

import { supabase } from '@/lib/supabase/client'

export interface Exercise {
  id: number
  name_ko: string
  name_en: string | null
  category: string
  difficulty: string
  target_area: string | null
  equipment: string
  description: string | null
  video_url: string | null
  video_filename: string | null
  thumbnail_url: string | null
  default_sets: number
  default_reps: number | null
  duration_seconds: number | null
  source_pdf: string | null
  is_active: boolean
}

export interface Program {
  id: number
  name_ko: string
  type: string
  description: string | null
  total_weeks: number
  total_phases: number
  is_active: boolean
}

export interface ProgramExercise {
  id: number
  program_id: number
  phase: number
  exercise_id: number
  order_in_phase: number
  sets: number
  reps: number | null
  frequency_per_week: string
  intensity: string
  notes: string | null
  exercise?: Exercise
}

// 전체 운동 목록 조회
export async function getExercises(category?: string): Promise<Exercise[]> {
  if (!supabase) return []
  
  let query = supabase
    .from('exercises')
    .select('*')
    .eq('is_active', true)
    .order('id')
  
  if (category && category !== 'all') {
    query = query.eq('category', category)
  }
  
  const { data, error } = await query
  if (error) {
    console.error('Error fetching exercises:', error)
    return []
  }
  return data || []
}

// 운동 카테고리 목록 조회
export async function getCategories(): Promise<string[]> {
  if (!supabase) return []
  
  const { data, error } = await supabase
    .from('exercises')
    .select('category')
    .eq('is_active', true)
  
  if (error) return []
  const categories = [...new Set(data?.map(d => d.category) || [])]
  return categories.sort()
}

// 운동 상세 조회
export async function getExerciseById(id: number): Promise<Exercise | null> {
  if (!supabase) return null
  
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Error fetching exercise:', error)
    return null
  }
  return data
}

// 프로그램 목록 조회
export async function getPrograms(type?: string): Promise<Program[]> {
  if (!supabase) return []
  
  let query = supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .order('id')
  
  if (type) {
    query = query.eq('type', type)
  }
  
  const { data, error } = await query
  if (error) return []
  return data || []
}

// 프로그램별 운동 매핑 조회 (Phase별)
export async function getProgramExercises(programId: number, phase?: number): Promise<ProgramExercise[]> {
  if (!supabase) return []
  
  let query = supabase
    .from('program_exercises')
    .select(`
      *,
      exercise:exercises(*)
    `)
    .eq('program_id', programId)
    .order('phase')
    .order('order_in_phase')
  
  if (phase) {
    query = query.eq('phase', phase)
  }
  
  const { data, error } = await query
  if (error) {
    console.error('Error fetching program exercises:', error)
    return []
  }
  return data || []
}

// 난이도 한글 변환
export function getDifficultyText(difficulty: string): string {
  const map: Record<string, string> = {
    '매우 낮음': '매우 낮음',
    '낮음': '낮음',
    '중간': '중간',
    '중상': '중상',
    '높음': '높음',
  }
  return map[difficulty] || difficulty
}

// 난이도 색상
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case '매우 낮음': return 'bg-blue-100 text-blue-800'
    case '낮음': return 'bg-green-100 text-green-800'
    case '중간': return 'bg-yellow-100 text-yellow-800'
    case '중상': return 'bg-orange-100 text-orange-800'
    case '높음': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// 카테고리 한글 표시명
export function getCategoryDisplayName(category: string): string {
  const map: Record<string, string> = {
    '흉추_가동성': '흉추 가동성',
    '견갑골_안정화': '견갑골 안정화',
    '회전근개_강화': '회전근개 강화',
    '어깨_강화': '어깨 강화',
    '코어_통합': '코어 통합',
    '관절_가동성': '관절 가동성',
    '등척성_운동': '등척성 운동',
    '고유수용감각': '고유수용감각',
    '기능적_운동': '기능적 운동',
  }
  return map[category] || category
}

// 하위 호환용 (기존 mockExercises 참조하는 코드 대응)
export const mockExercises: Exercise[] = []


// Signed URL 발급 (Private 버킷용)
export async function getSignedVideoUrl(videoFilename: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/storage?path=${encodeURIComponent(videoFilename)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.url || null
  } catch {
    return null
  }
}

export async function getSignedThumbnailUrl(videoFilename: string): Promise<string | null> {
  const thumbFilename = `thumbnails/${videoFilename.replace('.mp4', '.jpg')}`
  try {
    const res = await fetch(`/api/storage?path=${encodeURIComponent(thumbFilename)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.url || null
  } catch {
    return null
  }
}

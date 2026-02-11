// lib/data/exercises.ts
// 운동 데이터

export interface Exercise {
  id: string
  name: string
  koreanName: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  equipment: string
  thumbnailUrl: string
  demoVideoUrl: string
  defaultSets: number
  defaultReps: number
  targetMuscles: string[]
  instructions: string[]
  tips: string[]
  duration: number
}

export const mockExercises: Exercise[] = [
  {
    id: 'ex-001',
    name: 'External Rotation with Band',
    koreanName: '밴드 외회전',
    category: '외회전',
    difficulty: 'beginner',
    equipment: '밴드',
    thumbnailUrl: 'https://img.youtube.com/vi/U96kz0jMQzE/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/U96kz0jMQzE',
    defaultSets: 3,
    defaultReps: 15,
    targetMuscles: ['극하근', '소원근'],
    instructions: [
      '팔꿈치를 90도로 구부리고 몸통에 붙입니다',
      '밴드를 잡고 천천히 바깥쪽으로 회전합니다',
      '2초간 유지 후 천천히 원위치',
    ],
    tips: [
      '팔꿈치가 몸에서 떨어지지 않도록 주의',
      '어깨가 올라가지 않도록 주의',
    ],
    duration: 180,
  },
  {
    id: 'ex-002',
    name: 'Scapular Retraction',
    koreanName: '견갑골 후인',
    category: '견갑골',
    difficulty: 'beginner',
    equipment: '밴드',
    thumbnailUrl: 'https://img.youtube.com/vi/uKGTeWbjwXQ/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/uKGTeWbjwXQ',
    defaultSets: 3,
    defaultReps: 12,
    targetMuscles: ['승모근 중부', '능형근'],
    instructions: [
      '밴드를 가슴 높이로 잡습니다',
      '날개뼈를 등 중앙으로 모읍니다',
      '3초간 유지 후 천천히 풀어줍니다',
    ],
    tips: [
      '어깨를 으쓱하지 말고 뒤로만 당기기',
      '가슴을 펴고 시선은 정면',
    ],
    duration: 150,
  },
  {
    id: 'ex-003',
    name: 'Scaption',
    koreanName: '스캡션',
    category: 'ROM',
    difficulty: 'intermediate',
    equipment: '덤벨',
    thumbnailUrl: 'https://img.youtube.com/vi/zGaOOA4wGkc/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/zGaOOA4wGkc',
    defaultSets: 3,
    defaultReps: 10,
    targetMuscles: ['전면 삼각근', '극상근'],
    instructions: [
      '엄지가 위를 향하도록 덤벨을 잡습니다',
      '팔을 몸에서 30도 각도로 들어올립니다',
      '천천히 내립니다',
    ],
    tips: [
      '어깨 높이까지만 올리기',
      '무게는 가볍게 시작',
    ],
    duration: 120,
  },
  {
    id: 'ex-004',
    name: 'Pendulum Exercise',
    koreanName: '진자 운동',
    category: 'ROM',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/Ukj3ffOZtI8/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/Ukj3ffOZtI8',
    defaultSets: 2,
    defaultReps: 20,
    targetMuscles: ['어깨 관절'],
    instructions: [
      '허리를 90도로 숙입니다',
      '아픈 팔을 자연스럽게 늘어뜨립니다',
      '작은 원을 그리듯 흔들어줍니다',
    ],
    tips: [
      '힘을 빼고 중력에 맡기기',
      '통증이 있으면 즉시 중단',
    ],
    duration: 240,
  },
  {
    id: 'ex-005',
    name: 'Wall Slide',
    koreanName: '벽 슬라이드',
    category: 'ROM',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/EZ6L5ovBgoQ/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/EZ6L5ovBgoQ',
    defaultSets: 3,
    defaultReps: 10,
    targetMuscles: ['회전근개'],
    instructions: [
      '벽에 등을 대고 섭니다',
      '팔을 벽에 붙인 채 위로 올립니다',
      '천천히 내립니다',
    ],
    tips: [
      '허리가 벽에서 떨어지지 않게',
      '팔이 벽에서 떨어지지 않게',
    ],
    duration: 150,
  },
  {
    id: 'ex-006',
    name: 'Internal Rotation with Band',
    koreanName: '밴드 내회전',
    category: '내회전',
    difficulty: 'beginner',
    equipment: '밴드',
    thumbnailUrl: 'https://img.youtube.com/vi/O5fsFXHRGBE/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/O5fsFXHRGBE',
    defaultSets: 3,
    defaultReps: 15,
    targetMuscles: ['견갑하근'],
    instructions: [
      '팔꿈치를 90도로 구부립니다',
      '밴드를 잡고 안쪽으로 당깁니다',
      '천천히 원위치',
    ],
    tips: [
      '팔꿈치 고정',
      '상체는 움직이지 않기',
    ],
    duration: 180,
  },
  {
    id: 'ex-007',
    name: 'Shoulder Flexion',
    koreanName: '어깨 굴곡',
    category: 'ROM',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/mk3ZL0YKgZw/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/mk3ZL0YKgZw',
    defaultSets: 3,
    defaultReps: 12,
    targetMuscles: ['삼각근 전면'],
    instructions: [
      '팔을 쭉 펴고 앞으로 들어올립니다',
      '귀 옆까지 올립니다',
      '천천히 내립니다',
    ],
    tips: [
      '팔을 곧게 유지',
      '통증 없는 범위까지만',
    ],
    duration: 150,
  },
  {
    id: 'ex-008',
    name: 'Shoulder Abduction',
    koreanName: '어깨 외전',
    category: 'ROM',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/9NV2oDiA15w/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/9NV2oDiA15w',
    defaultSets: 3,
    defaultReps: 12,
    targetMuscles: ['삼각근 중부', '극상근'],
    instructions: [
      '팔을 옆으로 들어올립니다',
      '어깨 높이까지 올립니다',
      '천천히 내립니다',
    ],
    tips: [
      '엄지가 천장을 향하게',
      '어깨가 으쓱하지 않게',
    ],
    duration: 150,
  },
  {
    id: 'ex-009',
    name: 'Y-Raise',
    koreanName: 'Y 레이즈',
    category: '근력',
    difficulty: 'intermediate',
    equipment: '덤벨',
    thumbnailUrl: 'https://img.youtube.com/vi/lFXbcjyxVfo/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/lFXbcjyxVfo',
    defaultSets: 3,
    defaultReps: 10,
    targetMuscles: ['승모근 하부', '전거근'],
    instructions: [
      '엎드린 자세에서 팔을 Y자로 만듭니다',
      '덤벨을 들어올립니다',
      '천천히 내립니다',
    ],
    tips: [
      '목에 힘 빼기',
      '날개뼈를 아래로',
    ],
    duration: 120,
  },
  {
    id: 'ex-010',
    name: 'T-Raise',
    koreanName: 'T 레이즈',
    category: '근력',
    difficulty: 'intermediate',
    equipment: '덤벨',
    thumbnailUrl: 'https://img.youtube.com/vi/wjZGHI4nozQ/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/wjZGHI4nozQ',
    defaultSets: 3,
    defaultReps: 10,
    targetMuscles: ['승모근 중부', '능형근'],
    instructions: [
      '엎드린 자세에서 팔을 T자로 만듭니다',
      '덤벨을 들어올립니다',
      '천천히 내립니다',
    ],
    tips: [
      '팔을 곧게',
      '날개뼈 모으기',
    ],
    duration: 120,
  },
  {
    id: 'ex-011',
    name: 'Shoulder Stretch',
    koreanName: '어깨 스트레칭',
    category: 'ROM',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/IL6T8c7CjMM/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/IL6T8c7CjMM',
    defaultSets: 2,
    defaultReps: 15,
    targetMuscles: ['어깨 전체'],
    instructions: [
      '팔을 가슴 앞으로 교차합니다',
      '반대 손으로 팔꿈치를 당깁니다',
      '15초간 유지',
    ],
    tips: [
      '통증 없이 부드럽게',
      '호흡 유지',
    ],
    duration: 120,
  },
  {
    id: 'ex-012',
    name: 'Shoulder Rotation',
    koreanName: '어깨 회전',
    category: 'ROM',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/D0GfzgUJNKM/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/D0GfzgUJNKM',
    defaultSets: 3,
    defaultReps: 10,
    targetMuscles: ['회전근개'],
    instructions: [
      '팔을 옆으로 90도 들어올립니다',
      '천천히 앞뒤로 회전합니다',
      '부드럽게 움직입니다',
    ],
    tips: [
      '큰 동작으로 천천히',
      '통증 범위 내에서',
    ],
    duration: 150,
  },
  {
    id: 'ex-013',
    name: 'Scapular Stabilization',
    koreanName: '견갑골 안정화',
    category: '견갑골',
    difficulty: 'beginner',
    equipment: '없음',
    thumbnailUrl: 'https://img.youtube.com/vi/w3QQhTO2oc8/mqdefault.jpg',
    demoVideoUrl: 'https://www.youtube.com/embed/w3QQhTO2oc8',
    defaultSets: 3,
    defaultReps: 12,
    targetMuscles: ['전거근', '승모근'],
    instructions: [
      '벽에 손을 대고 섭니다',
      '날개뼈를 모았다 펴는 동작 반복',
      '천천히 조절하며 실시',
    ],
    tips: [
      '팔꿈치는 곧게',
      '날개뼈 움직임에 집중',
    ],
    duration: 150,
  },
]

export function getExerciseById(id: string): Exercise | undefined {
  return mockExercises.find((ex) => ex.id === id)
}

export function getExercisesByCategory(category: string): Exercise[] {
  return mockExercises.filter((ex) => ex.category === category)
}

export function getExercisesByDifficulty(difficulty: string): Exercise[] {
  return mockExercises.filter((ex) => ex.difficulty === difficulty)
}

export interface SubscriptionStatus {
  isPremium: boolean
  type: 'FREE' | 'PLATINUM_PATIENT' | 'PREMIUM'
  expiresAt: Date | null
  daysLeft: number | null
  isExpired: boolean
}

export function checkSubscription(user: {
  subscription_type?: string
  subscription_expires_at?: string | null
}): SubscriptionStatus {
  const type = (user.subscription_type || 'FREE') as SubscriptionStatus['type']

  if (type === 'FREE') {
    return {
      isPremium: false,
      type: 'FREE',
      expiresAt: null,
      daysLeft: null,
      isExpired: false,
    }
  }

  const expiresAt = user.subscription_expires_at
    ? new Date(user.subscription_expires_at)
    : null

  if (!expiresAt) {
    // 만료일 없으면 유료로 간주 (관리자 수동 설정 등)
    return {
      isPremium: true,
      type,
      expiresAt: null,
      daysLeft: null,
      isExpired: false,
    }
  }

  const now = new Date()
  const isExpired = now > expiresAt
  const daysLeft = isExpired
    ? 0
    : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    isPremium: !isExpired,
    type,
    expiresAt,
    daysLeft,
    isExpired,
  }
}

export function getSubscriptionLabel(status: SubscriptionStatus): string {
  if (status.isExpired) return '만료됨 (무료)'
  switch (status.type) {
    case 'PLATINUM_PATIENT':
      return status.daysLeft !== null
        ? `플래티넘 환자 (${status.daysLeft}일 남음)`
        : '플래티넘 환자'
    case 'PREMIUM':
      return status.daysLeft !== null
        ? `프리미엄 (${status.daysLeft}일 남음)`
        : '프리미엄 회원'
    default:
      return '무료 회원'
  }
}

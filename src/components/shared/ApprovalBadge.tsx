import { Check, Clock, X, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'not_required'

interface Props {
  status: ApprovalStatus
  size?: 'sm' | 'md'
  className?: string
}

const STYLES: Record<ApprovalStatus, { bg: string; text: string; label: string; Icon: typeof Check }> = {
  pending: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Pending approval',
    Icon: Clock,
  },
  approved: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    label: 'Approved',
    Icon: Check,
  },
  rejected: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    label: 'Rejected',
    Icon: X,
  },
  not_required: {
    bg: 'bg-surface-50 border-surface-200',
    text: 'text-surface-600',
    label: 'No approval needed',
    Icon: ShieldCheck,
  },
}

export default function ApprovalBadge({ status, size = 'sm', className }: Props) {
  const s = STYLES[status]
  const Icon = s.Icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        s.bg, s.text,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {s.label}
    </span>
  )
}

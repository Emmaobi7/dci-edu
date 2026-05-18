import { Crown, Shield } from 'lucide-react';

export type ChatRole = 'teacher' | 'moderator' | 'student';

export function chatRoleFor(
  userId: string,
  teacherId: string,
  moderatorId: string | null,
): ChatRole {
  if (userId === teacherId) return 'teacher';
  if (moderatorId && userId === moderatorId) return 'moderator';
  return 'student';
}

export function ChatRoleAvatar({ name, role, size = 'md' }: {
  name: string; role: ChatRole; size?: 'sm' | 'md';
}) {
  const sz = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  const ringClass =
    role === 'teacher' ? 'ring-2 ring-brand'
    : role === 'moderator' ? 'ring-2 ring-brand-300'
    : '';
  const tone =
    role === 'teacher' ? 'bg-brand text-white'
    : role === 'moderator' ? 'bg-brand-300 text-white'
    : 'bg-brand/15 text-brand';
  const badge =
    role === 'teacher' ? <Crown className="h-3 w-3" />
    : role === 'moderator' ? <Shield className="h-3 w-3" />
    : null;
  return (
    <div className="relative shrink-0">
      <div className={`${sz} ${tone} ${ringClass} rounded-full grid place-items-center font-medium`}>
        {name.slice(0, 1).toUpperCase()}
      </div>
      {badge && (
        <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full grid place-items-center ${
          role === 'teacher' ? 'bg-brand text-white' : 'bg-brand-300 text-white'
        }`}>
          {badge}
        </div>
      )}
    </div>
  );
}

export function ChatRolePill({ role, className = '' }: { role: ChatRole; className?: string }) {
  if (role === 'student') return null;
  const tone = role === 'teacher'
    ? 'bg-brand/15 text-brand'
    : 'bg-brand-300/15 text-brand-300';
  const Icon = role === 'teacher' ? Crown : Shield;
  const label = role === 'teacher' ? 'Faculty' : 'Moderator';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone} ${className}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

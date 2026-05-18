import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { CircleSlash, MessageSquare, Send, Trash2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getSocket } from '@/lib/socket';
import { deleteMessage, listMessages } from '@/lib/messages';
import type { ChatMessage, ClassroomDetail, Role } from '@/lib/types';
import { ChatRoleAvatar, ChatRolePill, chatRoleFor } from '@/components/ChatRoleBadge';

interface Props {
  classroom: ClassroomDetail;
  viewerId: string;
  viewerRole: Role;
}

export function ChatTab({ classroom, viewerId, viewerRole }: Props) {
  const classroomId = classroom.id;
  const isTeacher = viewerRole === 'ADMIN' || viewerId === classroom.teacherId;

  const [moderatorId, setModeratorId] = useState<string | null>(classroom.moderatorId);
  useEffect(() => { setModeratorId(classroom.moderatorId); }, [classroom.moderatorId]);
  const isModerator = moderatorId !== null && moderatorId === viewerId;

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Initial load + socket join
  useEffect(() => {
    let cancelled = false;
    const sock = getSocket();
    setMessages(null); setError(null);

    listMessages(classroomId, { limit: 50 })
      .then((r) => {
        if (cancelled) return;
        setMessages(r.messages);
        setHasMore(r.hasMore);
        setTimeout(() => scrollToBottom(false), 0);
      })
      .catch((e) => { if (!cancelled) setError(extractError(e) ?? 'Failed to load chat'); });

    const onJoinAck = (res: { ok: boolean; error?: string; role?: { isMuted: boolean } }) => {
      if (!res.ok) { setError(res.error ?? 'Cannot join chat'); return; }
      setMuted(!!res.role?.isMuted);
    };
    sock.emit('chat:join', { classroomId }, onJoinAck);

    const onNew = (p: { message: ChatMessage }) => {
      if (p.message.classroomId !== classroomId) return;
      setMessages((m) => (m ? [...m, p.message] : [p.message]));
      setTimeout(() => scrollToBottom(true), 0);
    };
    const onDeleted = (p: { message: ChatMessage }) => {
      if (p.message.classroomId !== classroomId) return;
      setMessages((m) => m ? m.map((x) => x.id === p.message.id ? p.message : x) : m);
    };
    const onPresenceState = (p: { classroomId: string; userIds: string[] }) => {
      if (p.classroomId !== classroomId) return;
      setOnline(new Set(p.userIds));
    };
    const onPresenceJoin = (p: { classroomId: string; userId: string }) => {
      if (p.classroomId !== classroomId) return;
      setOnline((s) => new Set(s).add(p.userId));
    };
    const onPresenceLeave = (p: { classroomId: string; userId: string }) => {
      if (p.classroomId !== classroomId) return;
      setOnline((s) => { const n = new Set(s); n.delete(p.userId); return n; });
    };
    const onMute = (p: { classroomId: string; studentId: string }) => {
      if (p.classroomId !== classroomId) return;
      if (p.studentId === viewerId) setMuted(true);
    };
    const onUnmute = (p: { classroomId: string; studentId: string }) => {
      if (p.classroomId !== classroomId) return;
      if (p.studentId === viewerId) setMuted(false);
    };
    const onPromote = (p: { classroomId: string; moderatorId: string }) => {
      if (p.classroomId !== classroomId) return;
      setModeratorId(p.moderatorId);
    };
    const onDemote = (p: { classroomId: string }) => {
      if (p.classroomId !== classroomId) return;
      setModeratorId(null);
    };

    sock.on('message:new', onNew);
    sock.on('message:deleted', onDeleted);
    sock.on('presence:state', onPresenceState);
    sock.on('presence:join', onPresenceJoin);
    sock.on('presence:leave', onPresenceLeave);
    sock.on('moderation:mute', onMute);
    sock.on('moderation:unmute', onUnmute);
    sock.on('moderation:promote', onPromote);
    sock.on('moderation:demote', onDemote);

    return () => {
      cancelled = true;
      sock.emit('chat:leave', { classroomId });
      sock.off('message:new', onNew);
      sock.off('message:deleted', onDeleted);
      sock.off('presence:state', onPresenceState);
      sock.off('presence:join', onPresenceJoin);
      sock.off('presence:leave', onPresenceLeave);
      sock.off('moderation:mute', onMute);
      sock.off('moderation:unmute', onUnmute);
      sock.off('moderation:promote', onPromote);
      sock.off('moderation:demote', onDemote);
    };
  }, [classroomId, viewerId, scrollToBottom]);

  async function loadOlder() {
    if (!messages || messages.length === 0 || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0]!;
      const r = await listMessages(classroomId, { before: oldest.createdAt, limit: 50 });
      setMessages((m) => (m ? [...r.messages, ...m] : r.messages));
      setHasMore(r.hasMore);
    } catch (e) {
      setError(extractError(e) ?? 'Failed to load older messages');
    } finally {
      setLoadingMore(false);
    }
  }

  function onSend() {
    const body = draft.trim();
    if (!body || sending || muted) return;
    setSending(true); setError(null);
    const sock = getSocket();
    sock.emit('message:send', { classroomId, body }, (res: { ok: boolean; error?: string }) => {
      setSending(false);
      if (!res.ok) { setError(res.error ?? 'Failed to send'); return; }
      setDraft('');
    });
  }

  async function onDelete(id: string) {
    try { await deleteMessage(id); }
    catch (e) { setError(extractError(e) ?? 'Failed to delete'); }
  }

  const canModerate = isTeacher || isModerator;

  return (
    <ChatLayout
      classroom={classroom}
      moderatorId={moderatorId}
      messages={messages}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadOlder={loadOlder}
      onlineCount={online.size}
      online={online}
      viewerId={viewerId}
      canModerate={canModerate}
      onDelete={onDelete}
      error={error}
      muted={muted}
      draft={draft}
      setDraft={setDraft}
      onSend={onSend}
      sending={sending}
      listRef={listRef}
    />
  );
}

interface LayoutProps {
  classroom: ClassroomDetail;
  moderatorId: string | null;
  messages: ChatMessage[] | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  onlineCount: number;
  online: Set<string>;
  viewerId: string;
  canModerate: boolean;
  onDelete: (id: string) => void;
  error: string | null;
  muted: boolean;
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
  sending: boolean;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
}

function ChatLayout(p: LayoutProps) {
  const dayGroups = useMemo(() => groupByDay(p.messages ?? []), [p.messages]);
  return (
    <Card className="p-0 overflow-hidden flex flex-col h-[70vh] min-h-[400px]">
      <div className="px-5 py-3 border-b border-foreground/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand" />
          <h3 className="font-semibold">Class chat</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {p.onlineCount} online
        </span>
      </div>

      <div ref={p.listRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {p.hasMore && (
          <button
            type="button"
            onClick={p.onLoadOlder}
            disabled={p.loadingMore}
            className="self-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >{p.loadingMore ? 'Loading…' : 'Load older messages'}</button>
        )}
        {p.messages === null && <div className="text-sm text-muted-foreground self-center">Loading…</div>}
        {p.messages && p.messages.length === 0 && (
          <div className="text-sm text-muted-foreground self-center py-10">No messages yet — say hi 👋</div>
        )}
        {dayGroups.map((group) => (
          <div key={group.day} className="flex flex-col gap-2">
            <div className="self-center text-[10px] uppercase tracking-wide text-muted-foreground">{group.day}</div>
            {group.items.map((m) => (
              <MessageRow
                key={m.id}
                m={m}
                viewerId={p.viewerId}
                online={p.online}
                teacherId={p.classroom.teacherId}
                moderatorId={p.moderatorId}
                canModerate={p.canModerate}
                onDelete={p.onDelete}
              />
            ))}
          </div>
        ))}
      </div>

      {p.muted ? (
        <div className="px-5 py-3 border-t border-foreground/10 bg-destructive/5 text-sm text-destructive inline-flex items-center gap-2">
          <VolumeX className="h-4 w-4" /> You have been muted by faculty.
        </div>
      ) : (
        <div className="px-5 py-3 border-t border-foreground/10">
          {p.error && <div className="text-xs text-destructive mb-2">{p.error}</div>}
          <div className="flex items-end gap-2">
            <Textarea
              value={p.draft}
              onChange={(e) => p.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.onSend(); }
              }}
              placeholder="Type a message…"
              rows={2}
              maxLength={2000}
              className="flex-1 resize-none"
            />
            <Button onClick={p.onSend} disabled={p.sending || p.draft.trim() === ''}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Text only · Enter to send · Shift+Enter for newline</div>
        </div>
      )}
    </Card>
  );
}

function MessageRow({
  m, viewerId, online, teacherId, moderatorId, canModerate, onDelete,
}: {
  m: ChatMessage; viewerId: string; online: Set<string>;
  teacherId: string; moderatorId: string | null;
  canModerate: boolean; onDelete: (id: string) => void;
}) {
  const role = chatRoleFor(m.sender.id, teacherId, moderatorId);
  const mine = m.sender.id === viewerId;
  const isOnline = online.has(m.sender.id);
  const canDelete = !m.deletedAt && (mine || canModerate);
  return (
    <div className="flex items-start gap-3 group">
      <div className="relative">
        <ChatRoleAvatar name={m.sender.name} role={role} />
        <span
          aria-hidden
          className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
            isOnline ? 'bg-emerald-500' : 'bg-foreground/20'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{m.sender.name}</span>
          <ChatRolePill role={role} />
          <span className="text-[10px] text-muted-foreground">
            {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
        {m.deletedAt ? (
          <div className="text-sm text-muted-foreground italic inline-flex items-center gap-1 mt-0.5">
            <CircleSlash className="h-3 w-3" /> Message removed
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words mt-0.5">{m.body}</div>
        )}
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(m.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
          aria-label="Delete message"
        ><Trash2 className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

interface DayGroup { day: string; items: ChatMessage[] }
function groupByDay(messages: ChatMessage[]): DayGroup[] {
  const out: DayGroup[] = [];
  for (const m of messages) {
    const day = new Date(m.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(m);
    else out.push({ day, items: [m] });
  }
  return out;
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return null;
}

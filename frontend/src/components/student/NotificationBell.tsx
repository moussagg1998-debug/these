// Notification dropdown — was previously a purely decorative bell (badge
// count only, no click handler) in StudentNav. GET/PATCH /api/notifications
// already existed and were already tested but never consumed by any UI
// before this component.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { relativeTime } from '@/lib/theses';

interface NotificationCountResponse {
  count: number;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  nextCursor: string | null;
}

// Where a click on a notification of this type should navigate. Types with
// no entry here are marked read and the dropdown just closes — no page in
// this app's scope corresponds to them yet (e.g. WITHDRAWAL_REQUESTED is
// unrelated to the thesis-tracking domain).
const TYPE_DESTINATION: Record<string, string> = {
  COMMENT_ADDED: '/comments',
  DEADLINE_ADDED: '/deadlines',
  DOCUMENT_SUBMITTED: '/documents',
  MESSAGE_RECEIVED: '/messages',
  THESIS_ASSIGNED: '/dashboard',
};

export function NotificationBell() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: countRes, refresh: refreshCount } = useApi<NotificationCountResponse>(
    '/api/notifications/count',
  );
  const count = countRes?.count ?? 0;

  const {
    data: listRes,
    loading: listLoading,
    refresh: refreshList,
  } = useApi<NotificationsResponse>('/api/notifications?limit=10', { skip: !open });

  const items = listRes?.items ?? [];
  const hasUnread = items.some((n) => n.readAt === null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function markRead(ids: string[] | 'all') {
    try {
      await api('/api/notifications', { method: 'PATCH', body: { ids } });
      void refreshList();
      void refreshCount();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    }
  }

  function onNotificationClick(n: NotificationItem) {
    if (n.readAt === null) void markRead([n.id]);
    setOpen(false);
    const destination = TYPE_DESTINATION[n.type];
    if (destination) router.push(destination);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative w-8 h-8 rounded-sm border border-border bg-surface flex items-center justify-center"
      >
        <Icon i="bell" size={15} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-md shadow-lg z-50 motion-safe:animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {hasUnread && (
              <button
                type="button"
                onClick={() => void markRead('all')}
                className="text-xs font-medium text-primary"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {listLoading && !listRes ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Chargement…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Aucune notification.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onNotificationClick(n)}
                  className="w-full flex items-start gap-2 px-4 py-3 border-b border-border last:border-0 text-left hover:bg-input"
                >
                  {n.readAt === null && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.readAt === null ? '' : 'pl-3.5'}`}>
                    <div className="text-xs font-semibold text-foreground truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.body}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, Inbox } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { DASHBOARD_STREAM_URL } from '@/lib/config';
import { AppNotification } from '@/lib/dashboard-types';

export function NotificationBell() {
  const { accessToken, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    api
      .get('/notifications')
      .then((response) => {
        setNotifications(response.data.notifications ?? []);
        setUnreadCount(response.data.unreadCount ?? 0);
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    const stream = new EventSource(
      `${DASHBOARD_STREAM_URL}?token=${encodeURIComponent(accessToken)}`,
    );

    stream.addEventListener('notification', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as AppNotification;
      setNotifications((current) => [payload, ...current.filter((item) => item.id !== payload.id)].slice(0, 30));
      setUnreadCount((current) => current + (payload.isRead ? 0 : 1));
    });

    return () => {
      stream.close();
    };
  }, [accessToken, user]);

  async function markAsRead(notificationId: string) {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      const updated = response.data.notification as AppNotification;
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      return;
    }
  }

  const unreadItems = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  useEffect(() => {
    setUnreadCount(unreadItems);
  }, [unreadItems]);

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-[10px] text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-card">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-16 z-[80] mt-3 rounded-3xl border border-border/60 bg-card p-3 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:w-96">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="font-display text-xl">Notifications</p><p className="text-xs text-muted-foreground">{unreadCount} unread</p></div>
            <Button className="h-8 px-3 py-1 text-xs" onClick={() => setOpen(false)} type="button" variant="secondary">
              Close
            </Button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary"><Inbox className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold">All quiet</p><p className="mt-1 text-xs text-muted-foreground">New budget and recurring alerts will appear here.</p></div>
            ) : (
              notifications.map((item) => (
                <div
                  className={`rounded-2xl p-3.5 ${item.isRead ? 'bg-secondary/25' : 'bg-accent/70'}`}
                  key={item.id}
                >
                  <p className="text-sm font-medium">{item.message}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    {!item.isRead ? (
                      <Button className="h-8 px-3 py-1 text-xs" onClick={() => void markAsRead(item.id)} type="button" variant="outline">
                        <Check className="h-3 w-3" />Mark read
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

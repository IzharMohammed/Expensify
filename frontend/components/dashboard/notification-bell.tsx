'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
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
        className="relative rounded-full bg-white/80 p-2 text-foreground transition hover:bg-white"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-border/70 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">Notifications</p>
            <Button className="h-8 px-3 py-1 text-xs" onClick={() => setOpen(false)} type="button" variant="secondary">
              Close
            </Button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="rounded-xl bg-secondary/30 p-3 text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              notifications.map((item) => (
                <div
                  className={`rounded-xl border p-3 ${item.isRead ? 'border-border/60 bg-secondary/10' : 'border-amber-200 bg-amber-50'}`}
                  key={item.id}
                >
                  <p className="text-sm font-medium">{item.message}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    {!item.isRead ? (
                      <Button className="h-8 px-3 py-1 text-xs" onClick={() => void markAsRead(item.id)} type="button" variant="outline">
                        Mark read
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

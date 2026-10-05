export type NotificationKind = 'info' | 'success' | 'warning' | 'error';

let hideTimer: number | undefined;

function notificationElement(): HTMLDivElement {
  const existing = document.querySelector<HTMLDivElement>('#app-notification');
  if (existing) return existing;

  const notification = document.createElement('div');
  notification.id = 'app-notification';
  notification.className = 'tst';
  notification.setAttribute('aria-atomic', 'true');
  document.body.append(notification);
  return notification;
}

export function showNotification(
  message: string,
  kind: NotificationKind = 'info',
  durationMs = 5_000,
): void {
  const notification = notificationElement();
  window.clearTimeout(hideTimer);
  notification.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  notification.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  notification.textContent = message;
  notification.className = `tst show ${
    kind === 'success' ? 's' : kind === 'error' ? 'e' : kind === 'warning' ? 'w' : ''
  }`;
  hideTimer = window.setTimeout(() => notification.classList.remove('show'), durationMs);
}

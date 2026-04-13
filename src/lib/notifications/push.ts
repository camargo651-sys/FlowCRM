// Web Push Notifications helper
// NOTE: This is a client-side stub. Real push (server -> client) requires
// VAPID keys and a backend that stores PushSubscription objects and sends
// payloads via the Web Push Protocol. See TODOs below.

const VAPID_PUBLIC_KEY_PLACEHOLDER =
  // TODO: replace with real VAPID public key from env (NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
}

function supportsNotifications(): boolean {
  return isBrowser() && 'Notification' in window
}

function supportsServiceWorker(): boolean {
  return isBrowser() && 'serviceWorker' in navigator
}

export async function requestPushPermission(): Promise<boolean> {
  if (!supportsNotifications()) return false
  try {
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch (err) {
    console.warn('[push] permission request failed', err)
    return false
  }
}

export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {}
): Promise<void> {
  if (!supportsNotifications()) return
  if (Notification.permission !== 'granted') return

  const opts: NotificationOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    ...options,
  }

  try {
    if (supportsServiceWorker()) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, opts)
      return
    }
  } catch (err) {
    console.warn('[push] SW notification failed, falling back', err)
  }

  // Fallback to window.Notification
  try {
    new Notification(title, opts)
  } catch (err) {
    console.warn('[push] window.Notification failed', err)
  }
}

export function scheduleReminder(
  title: string,
  body: string,
  delayMs: number
): number | null {
  if (!isBrowser()) return null
  if (delayMs < 0) delayMs = 0
  // TODO: move to server-side scheduled push (VAPID + cron/queue) so reminders
  // still fire when the tab is closed. This setTimeout only works while the
  // page is open.
  const id = window.setTimeout(() => {
    showLocalNotification(title, { body, tag: `reminder-${Date.now()}` })
  }, delayMs)
  return id
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!supportsServiceWorker() || !supportsNotifications()) return null
  if (!('PushManager' in window)) return null
  const granted = await requestPushPermission()
  if (!granted) return null

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return existing

    if (!VAPID_PUBLIC_KEY_PLACEHOLDER) {
      console.warn('[push] missing VAPID public key, cannot subscribe')
      // TODO: generate real VAPID keypair, store private on server,
      // expose public via NEXT_PUBLIC_VAPID_PUBLIC_KEY.
      return null
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY_PLACEHOLDER).buffer as ArrayBuffer,
    })

    // TODO: POST `sub` to backend (e.g. /api/push/subscribe) to persist
    // the PushSubscription against the current user/workspace.
    return sub
  } catch (err) {
    console.warn('[push] subscribe failed', err)
    return null
  }
}

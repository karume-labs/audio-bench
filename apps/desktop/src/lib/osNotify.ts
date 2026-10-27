import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let permissionRequest: Promise<boolean> | null = null;

const requestOnce = async (): Promise<boolean> => {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    return granted;
  } catch {
    return false;
  }
};

/**
 * Ensure notification permission is granted. The request is cached as a
 * single in-flight promise so concurrent callers (e.g. React StrictMode's
 * double-invoked mount effect) share one prompt instead of asking twice.
 */
export const ensureNotificationPermission = (): Promise<boolean> => {
  permissionRequest ??= requestOnce();
  return permissionRequest;
};

/**
 * Send an OS-level desktop notification only when the app window is NOT
 * focused - so users who are actively looking at the app get the in-app
 * toast instead of a duplicate OS popup. Works on Windows/macOS/Linux.
 */
export const notifyOsIfUnfocused = async (
  title: string,
  body: string,
): Promise<void> => {
  try {
    const focused = await getCurrentWindow().isFocused();
    if (focused) return;
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    sendNotification({ title, body });
  } catch {
    // Notifications are best-effort; never block the UI.
  }
};

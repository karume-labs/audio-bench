import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let permissionEnsured = false;

/** Ensure notification permission is granted (asks once per session). */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (permissionEnsured) {
    try {
      return await isPermissionGranted();
    } catch {
      return false;
    }
  }
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    permissionEnsured = true;
    return granted;
  } catch {
    return false;
  }
};

/**
 * Send an OS-level desktop notification only when the app window is NOT
 * focused — so users who are actively looking at the app get the in-app
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

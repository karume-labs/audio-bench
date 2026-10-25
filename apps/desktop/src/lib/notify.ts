import { notifications } from "@mantine/notifications";

export const notifyError = (title: string, err: unknown): void => {
  const message = err instanceof Error ? err.message : String(err);
  notifications.show({ color: "red", title, message, autoClose: 8000 });
};

export const notifySuccess = (title: string, message: string): void => {
  notifications.show({ color: "green", title, message });
};

export const notifyInfo = (title: string, message: string): void => {
  notifications.show({ color: "blue", title, message });
};

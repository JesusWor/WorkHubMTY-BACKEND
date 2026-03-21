export type UserRole =
  | "IT"
  | "FINANCE"
  | "ADMIN"
  | "USER";

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;

  targetUsers?: string[];
  targetRoles?: UserRole[];

  readBy: string[];
}
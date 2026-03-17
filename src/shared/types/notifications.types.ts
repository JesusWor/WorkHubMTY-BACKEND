export interface Notification {
  id: string;
  userId: string;
  message: string;
  date: Date;
  read: boolean;
}
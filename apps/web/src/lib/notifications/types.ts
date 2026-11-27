export interface NotificationItem {
  id: number;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

import type { Paginated } from "@/lib/projects/types";

export type RevenueMonth = {
  month: string;
  invoiced: string;
  collected: string;
};

export type RevenueReport = {
  from: string;
  to: string;
  months: RevenueMonth[];
  totals: { invoiced: string; collected: string };
  outstanding_total: string;
};

export type ProjectReportRow = {
  id: number;
  name: string;
  client: { id: number; name: string };
  status: string;
  progress_percent: number;
  due_date: string | null;
  is_overdue: boolean;
  budget: string | number | null;
  invoiced_total: string | number;
  collected_total: string | number;
  remaining_budget: string | number;
};

export type ClientReportRow = {
  id: number;
  name: string;
  status: string;
  projects_count: number;
  invoiced_total: string | number;
  collected_total: string | number;
  outstanding: string | number;
};

export type { Paginated };

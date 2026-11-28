export type LeadsByStage = {
  new: number;
  contacted: number;
  qualified: number;
  unqualified: number;
};

export type SalesSection = {
  new_leads_this_month: number;
  new_leads_last_month: number;
  new_leads_delta_percent: number | null;
  active_clients: number;
  leads_by_stage: LeadsByStage;
};

export type ProjectsByStatus = {
  draft: number;
  in_progress: number;
  on_hold: number;
  completed: number;
  cancelled: number;
};

export type ProjectsSection = {
  scope: "agency" | "mine";
  projects_by_status: ProjectsByStatus;
  overdue_tasks: number;
  overdue_projects: number;
};

export type MonthlySeriesPoint = {
  month: string;
  invoiced: string;
  collected: string;
};

export type FinanceSection = {
  collected_this_month: string;
  collected_last_month: string;
  collected_delta_percent: number | null;
  invoiced_this_month: string;
  outstanding_total: string;
  monthly_series: MonthlySeriesPoint[];
};

export type PersonalSection = {
  my_open_tasks: number;
  my_overdue_tasks: number;
};

export type AnalyticsOverview = {
  sales?: SalesSection;
  projects?: ProjectsSection;
  finance?: FinanceSection;
  personal?: PersonalSection;
};

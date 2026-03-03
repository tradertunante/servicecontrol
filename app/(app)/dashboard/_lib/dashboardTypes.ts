// FILE: app/(app)/dashboard/_lib/dashboardTypes.ts

export type Role = "admin" | "manager" | "auditor" | "superadmin" | "quality";

export type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

export type HotelRow = {
  id: string;
  name: string;
  created_at?: string | null;
};

export type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
  sort_order?: number | null;
};

export type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
  area_id: string;
  audit_template_id: string;
  hotel_id?: string | null;
  team_member_id?: string | null;
  executed_by?: string | null;
  notes?: string | null;
  audit_channel?: "internal" | "quality" | null;  // ✅ este era el campo que faltaba
};

export type ScoreAgg = { avg: number | null; count: number };

export type AreaScore = {
  id: string;
  name: string;
  score: number;
  count: number;
};

export type TrendPoint = {
  key: string;
  monthIndex: number;
  year: number;
  avg: number | null;
  count: number;
};

export type WorstAudit = {
  id: string;
  areaId: string;
  name: string;
  avg: number;
  count: number;
};
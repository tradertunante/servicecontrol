export type MemberAreaOption = {
  id: string;
  name: string;
};

export type MemberRecord = {
  id: string;
  full_name: string;
  employee_number: string | null;
  active: boolean;
  hotel_id: string;
  area_ids: string[];
  area_names: string[];
};

export type MembersPagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type MembersResponse = {
  ok: boolean;
  members: MemberRecord[];
  available_areas: MemberAreaOption[];
  hotel_id: string;
  role: string;
  pagination?: MembersPagination;
};

export type MemberImportPreviewRow = {
  row_number: number;
  full_name: string;
  employee_number: string;
  active: string;
  areas: string;
};

export type MemberImportRowResult = {
  row_number: number;
  status: "created" | "skipped" | "error";
  message: string;
  employee_number: string;
  full_name: string;
};

export type MemberImportCreatedMember = {
  id: string;
  full_name: string;
  employee_number: string;
  active: boolean;
  area_ids: string[];
  area_names: string[];
};

export type MemberImportResponse = {
  ok: boolean;
  hotel_id: string;
  total_rows: number;
  created_count: number;
  skipped_count: number;
  error_count: number;
  created_members: MemberImportCreatedMember[];
  row_results: MemberImportRowResult[];
};

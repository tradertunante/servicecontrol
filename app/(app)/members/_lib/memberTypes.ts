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

export type MembersResponse = {
  ok: boolean;
  members: MemberRecord[];
  available_areas: MemberAreaOption[];
  hotel_id: string;
  role: string;
};

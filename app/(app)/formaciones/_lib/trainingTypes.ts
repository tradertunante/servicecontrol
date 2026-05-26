export type TrainingSession = {
  id: string;
  topic_id: string;
  hotel_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  supervisor_name_snapshot: string | null;
  session_label: string | null;
  attendance_count: number;
  registration_token?: string | null;
  attendances?: TrainingAttendance[];
};

export type TrainingAttendance = {
  id: string;
  team_member_id: string | null;
  employee_name_input: string | null;
  employee_number: string;
  checked_in_at: string;
  validated_member_name: string | null;
};

export type TrainingTopic = {
  id: string;
  hotel_id: string;
  area_id: string | null;
  area_name: string | null;
  title: string;
  description: string | null;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  sessions: TrainingSession[];
};

export type TrainingTopicsResponse = {
  ok: boolean;
  topics: TrainingTopic[];
  available_areas?: Array<{ id: string; name: string }>;
};

export type TrainingHistorySession = {
  id: string;
  topic_id: string;
  topic_title: string;
  hotel_id: string;
  opened_at: string;
  closed_at: string | null;
  supervisor_name_snapshot: string | null;
  session_label: string | null;
  attendance_count: number;
};

export type TrainingHistoryAttendance = TrainingAttendance;

export type TrainingHistoryResponse = {
  ok: boolean;
  sessions: TrainingHistorySession[];
};

export type TrainingHistoryDetailResponse = {
  ok: boolean;
  session: TrainingHistorySession;
  attendances: TrainingHistoryAttendance[];
};

export type AiTrainingSuggestion = {
  id: string;
  area_id: string;
  area_name: string | null;
  question_id: string | null;
  question_text: string;
  trigger_ratio: number;
  trigger_count: number;
  trigger_period_days: number;
  ai_content: {
    objective: string;
    procedure: string[];
    checklist: string[];
    questions: string[];
  };
  review_status: "pending" | "approved" | "rejected" | "realized";
  reviewed_at: string | null;
  approved_at: string | null;
  realized_at: string | null;
  topic_id: string | null;
  created_at: string;
};

export type AiSuggestionsResponse = {
  ok: boolean;
  suggestions: AiTrainingSuggestion[];
};

export type TrainingPublicTopicResponse = {
  ok: boolean;
  topic: {
    id: string;
    title: string;
    description: string | null;
    qr_token: string;
  };
  sessions: TrainingSession[];
};

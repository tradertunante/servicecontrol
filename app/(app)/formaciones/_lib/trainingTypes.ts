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
};

export type TrainingTopic = {
  id: string;
  hotel_id: string;
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

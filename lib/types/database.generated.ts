export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      area_target_assignments: {
        Row: {
          active: boolean
          area_id: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          period: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          area_id: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          period: string
          target_count: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          area_id?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          period?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_target_assignments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_target_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_target_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_target_assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_target_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_target_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      area_targets: {
        Row: {
          active: boolean
          area_id: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          period: string
          target_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_id: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          period: string
          target_count: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_id?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          period?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_targets_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_targets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      area_template_target_assignments: {
        Row: {
          active: boolean
          area_id: string
          audit_template_id: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          period: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          area_id: string
          audit_template_id: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          period: string
          target_count: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          area_id?: string
          audit_template_id?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          period?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_template_target_assignments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_target_assignments_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_target_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_target_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_target_assignments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_target_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_target_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      area_template_targets: {
        Row: {
          active: boolean
          area_id: string
          audit_template_id: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          period: string
          target_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_id: string
          audit_template_id: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          period: string
          target_count: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_id?: string
          audit_template_id?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          period?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_template_targets_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_targets_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_template_targets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          active: boolean | null
          created_at: string | null
          hotel_id: string
          id: string
          name: string
          sort_order: number | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          hotel_id: string
          id?: string
          name: string
          sort_order?: number | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          hotel_id?: string
          id?: string
          name?: string
          sort_order?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_answers: {
        Row: {
          answer: string
          audit_run_id: string
          comment: string | null
          created_at: string
          id: string
          is_na: boolean
          photo_path: string | null
          question_id: string
          question_text: string | null
          result: string | null
          updated_at: string
        }
        Insert: {
          answer?: string
          audit_run_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_na?: boolean
          photo_path?: string | null
          question_id: string
          question_text?: string | null
          result?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string
          audit_run_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_na?: boolean
          photo_path?: string | null
          question_id?: string
          question_text?: string | null
          result?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_answers_audit_run_fk"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_fk"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_fk"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_fk"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_fk"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_answers_question_fk"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_corrective_actions: {
        Row: {
          area_id: string
          assigned_department: string
          assigned_department_id: string | null
          audit_run_id: string
          blocks_reaudit: boolean
          description: string | null
          evidence_note: string | null
          evidence_photo_path: string | null
          hotel_id: string
          id: string
          opened_at: string
          question_id: string
          reaudit_run_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          team_member_id: string | null
          title: string
        }
        Insert: {
          area_id: string
          assigned_department: string
          assigned_department_id?: string | null
          audit_run_id: string
          blocks_reaudit?: boolean
          description?: string | null
          evidence_note?: string | null
          evidence_photo_path?: string | null
          hotel_id: string
          id?: string
          opened_at?: string
          question_id: string
          reaudit_run_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          team_member_id?: string | null
          title: string
        }
        Update: {
          area_id?: string
          assigned_department?: string
          assigned_department_id?: string | null
          audit_run_id?: string
          blocks_reaudit?: boolean
          description?: string | null
          evidence_note?: string | null
          evidence_photo_path?: string | null
          hotel_id?: string
          id?: string
          opened_at?: string
          question_id?: string
          reaudit_run_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          team_member_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_corrective_actions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "hotel_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_evidence: {
        Row: {
          audit_answer_id: string
          created_at: string
          file_url: string
          id: string
        }
        Insert: {
          audit_answer_id: string
          created_at?: string
          file_url: string
          id?: string
        }
        Update: {
          audit_answer_id?: string
          created_at?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_evidence_audit_answer_id_fkey"
            columns: ["audit_answer_id"]
            isOneToOne: false
            referencedRelation: "audit_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          hotel_id: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          hotel_id: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          hotel_id?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_questions: {
        Row: {
          active: boolean | null
          audit_section_id: string
          blocks_reaudit_until_resolved: boolean
          classification: string | null
          comment_requirement: string | null
          corrective_flow: string
          created_at: string | null
          id: string
          order: number
          owner_department: string | null
          photo_requirement: string | null
          require_comment: boolean
          require_photo: boolean
          require_signature: boolean
          responsible_department: string | null
          signature_requirement: string | null
          tag: string | null
          text: string
          weight: number
        }
        Insert: {
          active?: boolean | null
          audit_section_id: string
          blocks_reaudit_until_resolved?: boolean
          classification?: string | null
          comment_requirement?: string | null
          corrective_flow?: string
          created_at?: string | null
          id?: string
          order?: number
          owner_department?: string | null
          photo_requirement?: string | null
          require_comment?: boolean
          require_photo?: boolean
          require_signature?: boolean
          responsible_department?: string | null
          signature_requirement?: string | null
          tag?: string | null
          text: string
          weight?: number
        }
        Update: {
          active?: boolean | null
          audit_section_id?: string
          blocks_reaudit_until_resolved?: boolean
          classification?: string | null
          comment_requirement?: string | null
          corrective_flow?: string
          created_at?: string | null
          id?: string
          order?: number
          owner_department?: string | null
          photo_requirement?: string | null
          require_comment?: boolean
          require_photo?: boolean
          require_signature?: boolean
          responsible_department?: string | null
          signature_requirement?: string | null
          tag?: string | null
          text?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_questions_audit_section_id_fkey"
            columns: ["audit_section_id"]
            isOneToOne: false
            referencedRelation: "audit_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          archived_at: string | null
          area_id: string
          assigned_auditor_id: string | null
          audit_channel: string
          audit_template_id: string
          auditor_email: string | null
          blocking_issue_count: number
          employee_number: string | null
          executed_at: string
          executed_by: string
          hotel_id: string
          id: string
          is_reaudit: boolean
          notes: string | null
          origin_type: string | null
          parent_audit_run_id: string | null
          ready_for_reaudit: boolean
          requires_training: boolean
          room_number: string | null
          scheduled_for: string | null
          score: number | null
          standard_id: string | null
          status: string
          team_member_id: string | null
          training_confirmed: boolean
        }
        Insert: {
          archived_at?: string | null
          area_id: string
          assigned_auditor_id?: string | null
          audit_channel?: string
          audit_template_id: string
          auditor_email?: string | null
          blocking_issue_count?: number
          employee_number?: string | null
          executed_at?: string
          executed_by: string
          hotel_id: string
          id?: string
          is_reaudit?: boolean
          notes?: string | null
          origin_type?: string | null
          parent_audit_run_id?: string | null
          ready_for_reaudit?: boolean
          requires_training?: boolean
          room_number?: string | null
          scheduled_for?: string | null
          score?: number | null
          standard_id?: string | null
          status?: string
          team_member_id?: string | null
          training_confirmed?: boolean
        }
        Update: {
          archived_at?: string | null
          area_id?: string
          assigned_auditor_id?: string | null
          audit_channel?: string
          audit_template_id?: string
          auditor_email?: string | null
          blocking_issue_count?: number
          employee_number?: string | null
          executed_at?: string
          executed_by?: string
          hotel_id?: string
          id?: string
          is_reaudit?: boolean
          notes?: string | null
          origin_type?: string | null
          parent_audit_run_id?: string | null
          ready_for_reaudit?: boolean
          requires_training?: boolean
          room_number?: string | null
          scheduled_for?: string | null
          score?: number | null
          standard_id?: string | null
          status?: string
          team_member_id?: string | null
          training_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_assigned_auditor_id_fkey"
            columns: ["assigned_auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_assigned_auditor_id_fkey"
            columns: ["assigned_auditor_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_parent_audit_run_id_fkey"
            columns: ["parent_audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_runs_parent_audit_run_id_fkey"
            columns: ["parent_audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_runs_parent_audit_run_id_fkey"
            columns: ["parent_audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_parent_audit_run_id_fkey"
            columns: ["parent_audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_runs_parent_audit_run_id_fkey"
            columns: ["parent_audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_runs_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_team_member_fk"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_sections: {
        Row: {
          active: boolean | null
          audit_template_id: string
          created_at: string | null
          id: string
          name: string
          order: number
        }
        Insert: {
          active?: boolean | null
          audit_template_id: string
          created_at?: string | null
          id?: string
          name: string
          order?: number
        }
        Update: {
          active?: boolean | null
          audit_template_id?: string
          created_at?: string | null
          id?: string
          name?: string
          order?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_sections_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_targets: {
        Row: {
          active: boolean
          audit_template_id: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          period: string
          target_count: number
          target_scope: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          audit_template_id: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          period: string
          target_count: number
          target_scope: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          audit_template_id?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          period?: string
          target_count?: number
          target_scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_targets_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_targets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_templates: {
        Row: {
          active: boolean | null
          area_id: string | null
          audit_type: string | null
          base_template_id: string | null
          created_at: string | null
          department: string | null
          hotel_id: string | null
          id: string
          is_global: boolean
          name: string
          pack_id: string | null
          require_audited_employee: boolean
          require_room_number: boolean
          scope: string
          source_template_id: string | null
          standard_id: string | null
        }
        Insert: {
          active?: boolean | null
          area_id?: string | null
          audit_type?: string | null
          base_template_id?: string | null
          created_at?: string | null
          department?: string | null
          hotel_id?: string | null
          id?: string
          is_global?: boolean
          name: string
          pack_id?: string | null
          require_audited_employee?: boolean
          require_room_number?: boolean
          scope: string
          source_template_id?: string | null
          standard_id?: string | null
        }
        Update: {
          active?: boolean | null
          area_id?: string | null
          audit_type?: string | null
          base_template_id?: string | null
          created_at?: string | null
          department?: string | null
          hotel_id?: string | null
          id?: string
          is_global?: boolean
          name?: string
          pack_id?: string | null
          require_audited_employee?: boolean
          require_room_number?: boolean
          scope?: string
          source_template_id?: string | null
          standard_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_templates_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_templates_base_template_id_fkey"
            columns: ["base_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_templates_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_templates_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "global_audit_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_templates_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          company_name: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          owner_user_id: string
          provider: string
          provider_customer_id: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          owner_user_id: string
          provider?: string
          provider_customer_id?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          owner_user_id?: string
          provider?: string
          provider_customer_id?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
          type: string
        }
        Insert: {
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id: string
          received_at?: string
          status?: string
          type: string
        }
        Update: {
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          amount: number
          billing_account_id: string
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interval: string
          plan_code: string
          provider_subscription_id: string
          status: string
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_account_id: string
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string
          plan_code: string
          provider_subscription_id: string
          status?: string
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_account_id?: string
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string
          plan_code?: string
          provider_subscription_id?: string
          status?: string
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      department_backlog_items: {
        Row: {
          area_id: string
          audit_run_id: string
          created_at: string
          hotel_id: string
          id: string
          owner_department: string
          question_id: string
          ready_for_reaudit: boolean
          resolution_comment: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area_id: string
          audit_run_id: string
          created_at?: string
          hotel_id: string
          id?: string
          owner_department: string
          question_id: string
          ready_for_reaudit?: boolean
          resolution_comment?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          audit_run_id?: string
          created_at?: string
          hotel_id?: string
          id?: string
          owner_department?: string
          question_id?: string
          ready_for_reaudit?: boolean
          resolution_comment?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_backlog_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_backlog_items_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "department_backlog_items_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "department_backlog_items_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_backlog_items_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "department_backlog_items_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "department_backlog_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_backlog_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          hotel_id: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          hotel_id: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          hotel_id?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      global_audit_pack_templates: {
        Row: {
          audit_template_id: string
          created_at: string
          pack_id: string
          position: number
        }
        Insert: {
          audit_template_id: string
          created_at?: string
          pack_id: string
          position?: number
        }
        Update: {
          audit_template_id?: string
          created_at?: string
          pack_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "global_audit_pack_templates_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_audit_pack_templates_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "global_audit_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      global_audit_packs: {
        Row: {
          active: boolean
          business_type: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          business_type: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          business_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      global_pack_templates: {
        Row: {
          created_at: string
          pack_id: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          pack_id: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          pack_id?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_pack_templates_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "global_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_pack_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      global_packs: {
        Row: {
          active: boolean
          business_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          business_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          business_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      hotel_audit_rules: {
        Row: {
          auto_reaudit_delay_days: number
          auto_reaudit_enabled: boolean
          auto_reaudit_threshold: number
          created_at: string
          hotel_id: string
          require_training_before_reaudit: boolean
          updated_at: string
        }
        Insert: {
          auto_reaudit_delay_days?: number
          auto_reaudit_enabled?: boolean
          auto_reaudit_threshold?: number
          created_at?: string
          hotel_id: string
          require_training_before_reaudit?: boolean
          updated_at?: string
        }
        Update: {
          auto_reaudit_delay_days?: number
          auto_reaudit_enabled?: boolean
          auto_reaudit_threshold?: number
          created_at?: string
          hotel_id?: string
          require_training_before_reaudit?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_audit_rules_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_departments: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          hotel_id: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_departments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_memberships: {
        Row: {
          active: boolean
          created_at: string
          hotel_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hotel_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hotel_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_memberships_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_notification_settings: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          new_user_email_enabled: boolean
          quality_audit_submitted_email_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          new_user_email_enabled?: boolean
          quality_audit_submitted_email_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          new_user_email_enabled?: boolean
          quality_audit_submitted_email_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_notification_settings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_quality_thresholds: {
        Row: {
          created_at: string
          hotel_id: string
          success_fail_rate_max: number
          success_score_min: number
          updated_at: string
          warning_fail_rate_max: number
          warning_score_min: number
        }
        Insert: {
          created_at?: string
          hotel_id: string
          success_fail_rate_max?: number
          success_score_min?: number
          updated_at?: string
          warning_fail_rate_max?: number
          warning_score_min?: number
        }
        Update: {
          created_at?: string
          hotel_id?: string
          success_fail_rate_max?: number
          success_score_min?: number
          updated_at?: string
          warning_fail_rate_max?: number
          warning_score_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_quality_thresholds_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_settings: {
        Row: {
          contact_info: Json
          created_at: string
          currency: string
          date_format: string
          font_size: string
          hotel_id: string
          id: string
          language: string
          logo_url: string | null
          notifications: Json
          theme_colors: Json
          time_format: string
          timezone: string
          updated_at: string
        }
        Insert: {
          contact_info?: Json
          created_at?: string
          currency?: string
          date_format?: string
          font_size?: string
          hotel_id: string
          id?: string
          language?: string
          logo_url?: string | null
          notifications?: Json
          theme_colors?: Json
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          contact_info?: Json
          created_at?: string
          currency?: string
          date_format?: string
          font_size?: string
          hotel_id?: string
          id?: string
          language?: string
          logo_url?: string | null
          notifications?: Json
          theme_colors?: Json
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_settings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: true
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          active: boolean | null
          billing_account_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          billing_account_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          billing_account_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          hotel_id: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          hotel_id: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          hotel_id?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          analytics_enabled: boolean
          created_at: string
          max_audits_per_month: number
          max_hotels: number
          max_users_per_hotel: number
          name: string
          plan_code: string
          reports_enabled: boolean
          training_enabled: boolean
        }
        Insert: {
          analytics_enabled?: boolean
          created_at?: string
          max_audits_per_month?: number
          max_hotels?: number
          max_users_per_hotel?: number
          name: string
          plan_code: string
          reports_enabled?: boolean
          training_enabled?: boolean
        }
        Update: {
          analytics_enabled?: boolean
          created_at?: string
          max_audits_per_month?: number
          max_hotels?: number
          max_users_per_hotel?: number
          name?: string
          plan_code?: string
          reports_enabled?: boolean
          training_enabled?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean | null
          assigned_department_id: string | null
          created_at: string | null
          email: string | null
          employee_number: string | null
          first_audit_completed_at: string | null
          first_login_at: string | null
          full_name: string | null
          hotel_id: string | null
          id: string
          is_trial: boolean
          role: string
          trial_expires_at: string | null
          trial_hotel_name: string | null
        }
        Insert: {
          active?: boolean | null
          assigned_department_id?: string | null
          created_at?: string | null
          email?: string | null
          employee_number?: string | null
          first_audit_completed_at?: string | null
          first_login_at?: string | null
          full_name?: string | null
          hotel_id?: string | null
          id: string
          is_trial?: boolean
          role: string
          trial_expires_at?: string | null
          trial_hotel_name?: string | null
        }
        Update: {
          active?: boolean | null
          assigned_department_id?: string | null
          created_at?: string | null
          email?: string | null
          employee_number?: string | null
          first_audit_completed_at?: string | null
          first_login_at?: string | null
          full_name?: string | null
          hotel_id?: string | null
          id?: string
          is_trial?: boolean
          role?: string
          trial_expires_at?: string | null
          trial_hotel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "hotel_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      reaudit_assignment_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          hotel_id: string
          id: string
          new_auditor_id: string
          note: string | null
          previous_auditor_id: string | null
          reason: string | null
          reaudit_run_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          new_auditor_id: string
          note?: string | null
          previous_auditor_id?: string | null
          reason?: string | null
          reaudit_run_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          new_auditor_id?: string
          note?: string | null
          previous_auditor_id?: string | null
          reason?: string | null
          reaudit_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reaudit_assignment_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_new_auditor_id_fkey"
            columns: ["new_auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_new_auditor_id_fkey"
            columns: ["new_auditor_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_previous_auditor_id_fkey"
            columns: ["previous_auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_previous_auditor_id_fkey"
            columns: ["previous_auditor_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_assignment_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
        ]
      }
      reaudit_training_logs: {
        Row: {
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          explanation: string
          hotel_id: string
          id: string
          reaudit_run_id: string
          team_member_id: string | null
        }
        Insert: {
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          explanation: string
          hotel_id: string
          id?: string
          reaudit_run_id: string
          team_member_id?: string | null
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          explanation?: string
          hotel_id?: string
          id?: string
          reaudit_run_id?: string
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reaudit_training_logs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_reaudit_run_id_fkey"
            columns: ["reaudit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "reaudit_training_logs_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      report_subscriptions: {
        Row: {
          active: boolean | null
          area_ids: string[] | null
          channel: string
          created_at: string | null
          created_by: string | null
          email: string
          frequency: string
          hotel_id: string
          id: string
          scope: string
        }
        Insert: {
          active?: boolean | null
          area_ids?: string[] | null
          channel?: string
          created_at?: string | null
          created_by?: string | null
          email: string
          frequency: string
          hotel_id: string
          id?: string
          scope?: string
        }
        Update: {
          active?: boolean | null
          area_ids?: string[] | null
          channel?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          frequency?: string
          hotel_id?: string
          id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_subscriptions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          created_at: string
          event_type: string
          hotel_id: string
          id: string
          points: number
          reason: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          hotel_id: string
          id?: string
          points: number
          reason: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          hotel_id?: string
          id?: string
          points?: number
          reason?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      standard_libraries: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          created_by: string | null
          hotel_id: string | null
          id: string
          name: string
          scope: string
          version: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          hotel_id?: string | null
          id?: string
          name: string
          scope: string
          version?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          hotel_id?: string | null
          id?: string
          name?: string
          scope?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standard_libraries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_libraries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standard_libraries_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_questions: {
        Row: {
          critical: boolean | null
          hotel_id: string | null
          id: string
          order_index: number | null
          scope: string
          section_id: string | null
          text: string
          weight: number | null
        }
        Insert: {
          critical?: boolean | null
          hotel_id?: string | null
          id?: string
          order_index?: number | null
          scope: string
          section_id?: string | null
          text: string
          weight?: number | null
        }
        Update: {
          critical?: boolean | null
          hotel_id?: string | null
          id?: string
          order_index?: number | null
          scope?: string
          section_id?: string | null
          text?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standard_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "standard_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_sections: {
        Row: {
          hotel_id: string | null
          id: string
          name: string
          order_index: number | null
          position: number | null
          scope: string
          template_id: string | null
        }
        Insert: {
          hotel_id?: string | null
          id?: string
          name: string
          order_index?: number | null
          position?: number | null
          scope: string
          template_id?: string | null
        }
        Update: {
          hotel_id?: string | null
          id?: string
          name?: string
          order_index?: number | null
          position?: number | null
          scope?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standard_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "standard_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_templates: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          hotel_id: string | null
          id: string
          library_id: string | null
          name: string
          scope: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          hotel_id?: string | null
          id?: string
          library_id?: string | null
          name: string
          scope: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          hotel_id?: string | null
          id?: string
          library_id?: string | null
          name?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_templates_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "standard_libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      standards: {
        Row: {
          active: boolean | null
          created_at: string | null
          hotel_id: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          hotel_id: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          hotel_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "standards_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          blocked_by_task_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          hotel_id: string
          id: string
          period_key: string | null
          photo_url: string | null
          priority: string
          related_area_id: string | null
          related_audit_run_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          task_type: string
          title: string
        }
        Insert: {
          blocked_by_task_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          hotel_id: string
          id?: string
          period_key?: string | null
          photo_url?: string | null
          priority?: string
          related_area_id?: string | null
          related_audit_run_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          task_type: string
          title: string
        }
        Update: {
          blocked_by_task_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          hotel_id?: string
          id?: string
          period_key?: string | null
          photo_url?: string | null
          priority?: string
          related_area_id?: string | null
          related_audit_run_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          task_type?: string
          title?: string
        }
        Relationships: []
      }
      team_member_areas: {
        Row: {
          area_id: string
          created_at: string
          id: string
          team_member_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          team_member_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_areas_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          area_id: string | null
          created_at: string
          department_id: string | null
          employee_code: string | null
          employee_number: string | null
          full_name: string
          hire_date: string | null
          hotel_id: string
          id: string
          position: string | null
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          department_id?: string | null
          employee_code?: string | null
          employee_number?: string | null
          full_name: string
          hire_date?: string | null
          hotel_id: string
          id?: string
          position?: string | null
        }
        Update: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          department_id?: string | null
          employee_code?: string | null
          employee_number?: string | null
          full_name?: string
          hire_date?: string | null
          hotel_id?: string
          id?: string
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attendances: {
        Row: {
          checked_in_at: string
          employee_name_input: string | null
          employee_number: string
          employee_profile_id: string | null
          hotel_id: string
          id: string
          session_id: string
          team_member_id: string | null
          topic_id: string
        }
        Insert: {
          checked_in_at?: string
          employee_name_input?: string | null
          employee_number: string
          employee_profile_id?: string | null
          hotel_id: string
          id?: string
          session_id: string
          team_member_id?: string | null
          topic_id: string
        }
        Update: {
          checked_in_at?: string
          employee_name_input?: string | null
          employee_number?: string
          employee_profile_id?: string | null
          hotel_id?: string
          id?: string
          session_id?: string
          team_member_id?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendances_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendances_employee_profile_id_fkey"
            columns: ["employee_profile_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendances_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendances_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendances_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      training_registration_tokens: {
        Row: {
          created_at: string
          expires_at: string
          hotel_id: string
          id: string
          session_id: string
          token_nonce_hash: string
          topic_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          hotel_id: string
          id?: string
          session_id: string
          token_nonce_hash: string
          topic_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          hotel_id?: string
          id?: string
          session_id?: string
          token_nonce_hash?: string
          topic_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_registration_tokens_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_registration_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_registration_tokens_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          closed_at: string | null
          closed_by_profile_id: string | null
          hotel_id: string
          id: string
          opened_at: string
          opened_by_profile_id: string | null
          session_label: string | null
          status: string
          supervisor_name_snapshot: string | null
          topic_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_profile_id?: string | null
          hotel_id: string
          id?: string
          opened_at?: string
          opened_by_profile_id?: string | null
          session_label?: string | null
          status?: string
          supervisor_name_snapshot?: string | null
          topic_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by_profile_id?: string | null
          hotel_id?: string
          id?: string
          opened_at?: string
          opened_by_profile_id?: string | null
          session_label?: string | null
          status?: string
          supervisor_name_snapshot?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_closed_by_profile_id_fkey"
            columns: ["closed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_closed_by_profile_id_fkey"
            columns: ["closed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_opened_by_profile_id_fkey"
            columns: ["opened_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_opened_by_profile_id_fkey"
            columns: ["opened_by_profile_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      training_topics: {
        Row: {
          area_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hotel_id: string
          id: string
          is_active: boolean
          qr_token: string
          title: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          qr_token: string
          title: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          qr_token?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_topics_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_topics_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_leads: {
        Row: {
          created_at: string
          email: string
          hotel_name: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          hotel_name: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          hotel_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_area_access: {
        Row: {
          area_id: string
          created_at: string
          hotel_id: string
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          hotel_id: string
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          hotel_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_area_access_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_area_access_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_area_permissions: {
        Row: {
          area_id: string
          can_audit: boolean
          can_view: boolean
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          can_audit?: boolean
          can_view?: boolean
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          can_audit?: boolean
          can_view?: boolean
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_area_permissions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_area_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_area_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audit_permissions: {
        Row: {
          audit_template_id: string
          can_audit: boolean
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          audit_template_id: string
          can_audit?: boolean
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          audit_template_id?: string
          can_audit?: boolean
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_audit_permissions_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audit_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audit_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hotels: {
        Row: {
          created_at: string
          hotel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hotels_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_scores: {
        Row: {
          hotel_id: string
          id: string
          level: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          hotel_id: string
          id?: string
          level?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          hotel_id?: string
          id?: string
          level?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      audit_area_latest_summary: {
        Row: {
          area_id: string | null
          audit_run_id: string | null
          executed_at: string | null
          executed_by: string | null
          fail_count: number | null
          na_count: number | null
          score_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_run_summary: {
        Row: {
          area_id: string | null
          audit_run_id: string | null
          executed_at: string | null
          executed_by: string | null
          fail_count: number | null
          na_count: number | null
          pass_count: number | null
          score_pct: number | null
          scored_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users_with_hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      department_corrective_actions_view: {
        Row: {
          area_id: string | null
          assigned_department: string | null
          assigned_department_id: string | null
          audit_created_at: string | null
          audit_run_id: string | null
          audit_score: number | null
          corrective_action_id: string | null
          created_at: string | null
          department_code: string | null
          department_name: string | null
          hotel_id: string | null
          question_id: string | null
          room_number: string | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_corrective_actions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "hotel_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_area_latest_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_run_summary"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_area_latest_score"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "v_team_member_failures"
            referencedColumns: ["audit_run_id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_corrective_actions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      users_with_hotel: {
        Row: {
          active: boolean | null
          full_name: string | null
          hotel_name: string | null
          id: string | null
          role: string | null
        }
        Relationships: []
      }
      v_area_common_failures: {
        Row: {
          affected_members: number | null
          area_id: string | null
          area_name: string | null
          fail_count: number | null
          fail_topic: string | null
          hotel_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      v_area_latest_score: {
        Row: {
          area_id: string | null
          audit_run_id: string | null
          executed_at: string | null
          fail_count: number | null
          na_count: number | null
          score_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_shared_fail_pairs: {
        Row: {
          area_id: string | null
          area_name: string | null
          hotel_id: string | null
          member_a: string | null
          member_a_name: string | null
          member_b: string | null
          member_b_name: string | null
          shared_fail_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_team_member_fk"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_team_member_fk"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_team_member_failures: {
        Row: {
          answer: string | null
          area_group: string | null
          area_id: string | null
          area_name: string | null
          audit_run_id: string | null
          audit_template_id: string | null
          classification: string | null
          comment: string | null
          executed_at: string | null
          hotel_id: string | null
          question_id: string | null
          question_text: string | null
          result: string | null
          tag: string | null
          team_member_id: string | null
          team_member_name: string | null
          team_member_number: string | null
          team_member_position: string | null
          template_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_answers_question_fk"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audit_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_audit_template_id_fkey"
            columns: ["audit_template_id"]
            isOneToOne: false
            referencedRelation: "audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_team_member_fk"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      v_team_member_ranking: {
        Row: {
          answered: number | null
          area_group: string | null
          area_id: string | null
          area_name: string | null
          fail_rate_pct: number | null
          fails: number | null
          hotel_id: string | null
          last_audit_at: string | null
          team_member_id: string | null
          team_member_name: string | null
          team_member_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_runs_team_member_fk"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _target_due_date: {
        Args: { p_now: string; p_period: string }
        Returns: string
      }
      _target_period_key: {
        Args: { p_now: string; p_period: string }
        Returns: string
      }
      archive_old_audit_runs: {
        Args: { p_hotel_id: string; p_older_than_days?: number }
        Returns: Json
      }
      award_gamification_points: {
        Args: {
          p_event_type: string
          p_hotel_id: string
          p_points: number
          p_reason: string
          p_reference_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      can_admin_hotel: { Args: { p_hotel_id: string }; Returns: boolean }
      can_manage_areas: { Args: never; Returns: boolean }
      can_manage_hotel: { Args: { p_hotel_id: string }; Returns: boolean }
      clone_global_audit_pack_to_hotel: {
        Args: { p_pack_id: string; p_target_hotel_id: string }
        Returns: undefined
      }
      clone_hotel_audit_template: {
        Args: {
          p_new_name: string
          p_target_hotel_id: string
          p_template_id: string
        }
        Returns: string
      }
      clone_hotel_structure: {
        Args: { new_hotel_name: string; source_hotel: string }
        Returns: string
      }
      clone_standard_library_to_hotel: {
        Args: { p_library_id: string; p_target_hotel_id: string }
        Returns: string
      }
      clone_template_to_hotel: {
        Args: { p_area_id: string; p_base_template_id: string }
        Returns: string
      }
      create_tasks_for_failed_audit:
        | { Args: { p_audit_run_id: string }; Returns: undefined }
        | {
            Args: { p_audit_run_id: string; p_threshold?: number }
            Returns: undefined
          }
      current_hotel_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      delete_area_safe: {
        Args: { p_area_id: string; p_hotel_id: string }
        Returns: undefined
      }
      delete_audit_run_safe: {
        Args: { p_hotel_id: string; p_run_id: string }
        Returns: undefined
      }
      delete_audit_template_cascade: {
        Args: { p_hotel_id: string; p_template_id: string }
        Returns: undefined
      }
      delete_audit_templates_by_area_cascade: {
        Args: { p_area_id: string; p_hotel_id: string }
        Returns: undefined
      }
      duplicate_audit_template_to_global: {
        Args: { p_pack_id: string; p_source_template_id: string }
        Returns: string
      }
      gamification_level: { Args: { p_points: number }; Returns: number }
      get_audit_run_full: {
        Args: { p_actor_user_id: string; p_run_id: string }
        Returns: Json
      }
      get_auditor_leaderboard: {
        Args: { p_day: string; p_hotel_id: string }
        Returns: {
          auditor_name: string
          auditor_user_id: string
          audits_done: number
          avg_score: number
          progress_pct: number
          remaining: number
          targets_completed: number
          targets_total: number
        }[]
      }
      get_department_corrective_actions: {
        Args: { p_user_id: string }
        Returns: {
          area_id: string
          assigned_department: string
          assigned_department_id: string
          audit_run_id: string
          audit_score: number
          corrective_action_id: string
          created_at: string
          hotel_id: string
          question_id: string
          room_number: string
          status: string
          title: string
        }[]
      }
      get_hotel_daily_targets_progress: {
        Args: { p_day: string; p_hotel_id: string }
        Returns: {
          auditor: string
          auditor_id: string
          completed: number
          progress_pct: number
          remaining: number
          target: number
          target_id: string
          template: string
        }[]
      }
      get_hotel_leaderboard: {
        Args: { p_hotel_id: string; p_limit?: number }
        Returns: {
          full_name: string
          level: number
          rank: number
          role: string
          total_points: number
          user_id: string
        }[]
      }
      get_my_daily_targets_progress: {
        Args: { p_day: string }
        Returns: {
          auditor: string
          auditor_user_id: string
          completed: number
          progress_pct: number
          remaining: number
          target: number
          target_id: string
          template: string
        }[]
      }
      get_scoped_department_corrective_actions:
        | {
            Args: { p_target_department_code: string; p_user_id: string }
            Returns: {
              area_id: string
              assigned_department: string
              assigned_department_id: string
              audit_run_id: string
              audit_score: number
              corrective_action_id: string
              created_at: string
              department_code: string
              hotel_id: string
              question_id: string
              room_number: string
              status: string
              title: string
            }[]
          }
        | {
            Args: { p_target_department_code: string; p_user_id: string }
            Returns: {
              area_id: string
              assigned_department: string
              assigned_department_id: string
              audit_run_id: string
              audit_score: number
              corrective_action_id: string
              created_at: string
              department_code: string
              hotel_id: string
              question_id: string
              room_number: string
              status: string
              title: string
            }[]
          }
      has_hotel_access: { Args: { h_id: string }; Returns: boolean }
      hotel_role: { Args: { hid: string }; Returns: string }
      import_standard_template_to_audit: {
        Args: { p_standard_template_id: string; p_target_hotel_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_auditor: { Args: never; Returns: boolean }
      is_hotel_admin: { Args: never; Returns: boolean }
      is_hotel_member: { Args: { hid: string }; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      list_accessible_hotels: {
        Args: never
        Returns: {
          deleted_at: string
          id: string
          name: string
          status: string
          timezone: string
        }[]
      }
      my_hotel_id: { Args: never; Returns: string }
      notify_user: {
        Args: {
          p_body?: string
          p_hotel_id: string
          p_link?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      period_key: { Args: { p_now: string; p_period: string }; Returns: string }
      period_window_end: {
        Args: { p_now: string; p_period: string }
        Returns: string
      }
      period_window_start: {
        Args: { p_now: string; p_period: string }
        Returns: string
      }
      process_reaudit_action: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_explanation?: string
          p_hotel_id: string
          p_next_auditor_id?: string
          p_note_block?: string
          p_run_id: string
        }
        Returns: Json
      }
      refresh_target_tasks: { Args: { p_now?: string }; Returns: number }
      rename_area: {
        Args: { p_area_id: string; p_hotel_id: string; p_new_name: string }
        Returns: undefined
      }
      restore_audit_run: {
        Args: { p_hotel_id: string; p_run_id: string }
        Returns: undefined
      }
      rpc_my_summary: {
        Args: { p_hotel_id: string; p_period: string; p_user_id: string }
        Returns: Json
      }
      rpc_team_summary:
        | {
            Args: { p_hotel_id: string; p_period: string; p_user_id: string }
            Returns: Json
          }
        | {
            Args: { p_hotel_id: string; p_period: string; p_user_id: string }
            Returns: Json
          }
      rpc_team_summary_v2: {
        Args: { p_hotel_id: string; p_period: string; p_user_id: string }
        Returns: Json
      }
      sc_can_manage_global_library_assets: { Args: never; Returns: boolean }
      sc_can_manage_members: {
        Args: { target_hotel: string }
        Returns: boolean
      }
      sc_can_manage_profile: {
        Args: {
          target_hotel: string
          target_profile: string
          target_role: string
        }
        Returns: boolean
      }
      sc_can_mutate_run: { Args: { target_run: string }; Returns: boolean }
      sc_can_mutate_template: {
        Args: { target_hotel: string }
        Returns: boolean
      }
      sc_can_read_corrective_action: {
        Args: { target_action: string }
        Returns: boolean
      }
      sc_can_read_profile: {
        Args: { target_profile: string }
        Returns: boolean
      }
      sc_can_read_team_member: {
        Args: { target_hotel: string; target_member: string }
        Returns: boolean
      }
      sc_can_read_team_member_area: {
        Args: { target_area: string; target_member: string }
        Returns: boolean
      }
      sc_can_view_area: { Args: { target_area: string }; Returns: boolean }
      sc_can_view_global_library_assets: { Args: never; Returns: boolean }
      sc_can_view_run: { Args: { target_run: string }; Returns: boolean }
      sc_can_write_profile: {
        Args: { target_hotel: string; target_role: string }
        Returns: boolean
      }
      sc_can_write_team_member: {
        Args: { target_hotel: string }
        Returns: boolean
      }
      sc_has_area_assignment: {
        Args: { target_area: string }
        Returns: boolean
      }
      sc_has_hotel_role: {
        Args: { allowed_roles: string[]; target_hotel: string }
        Returns: boolean
      }
      sc_has_role: { Args: { allowed_roles: string[] }; Returns: boolean }
      sc_is_same_hotel: { Args: { target_hotel: string }; Returns: boolean }
      sc_manager_has_hotel_area_scope: {
        Args: { target_hotel: string }
        Returns: boolean
      }
      sc_user_hotel_id: { Args: never; Returns: string }
      sc_user_role: { Args: never; Returns: string }
      set_user_area_access_atomic: {
        Args: { p_area_ids: string[]; p_hotel_id: string; p_user_id: string }
        Returns: Json
      }
      start_append_note: {
        Args: { p_block: string; p_existing: string }
        Returns: string
      }
      start_audit_run:
        | {
            Args: {
              p_actor_user_id: string
              p_area_id: string
              p_audit_channel?: string
              p_hotel_id: string
              p_room_number?: string
              p_template_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_area_id: string
              p_assigned_auditor_id?: string
              p_audit_channel?: string
              p_executed_by: string
              p_hotel_id: string
              p_is_reaudit?: boolean
              p_origin_type?: string
              p_parent_audit_run_id?: string
              p_requires_training?: boolean
              p_room_number?: string
              p_scheduled_for?: string
              p_team_member_id?: string
              p_template_id: string
            }
            Returns: Json
          }
      submit_audit_run: {
        Args: { p_actor_user_id: string; p_run_id: string }
        Returns: Json
      }
      sync_global_audit_pack_to_hotel: {
        Args: { p_pack_id: string; p_target_hotel_id: string }
        Returns: number
      }
      update_corrective_action_status_atomic: {
        Args: {
          p_action_id: string
          p_actor_user_id: string
          p_hotel_id: string
          p_next_status: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

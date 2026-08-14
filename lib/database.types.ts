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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_responses: {
        Row: {
          audit_id: string
          created_at: string
          id: string
          importance_score: number
          life_area_id: string
          next_point_move: string | null
          note: string | null
          priority_score: number | null
          satisfaction_score: number
          updated_at: string
          whats_not_working: string | null
          whats_working: string | null
          why_this_score: string | null
        }
        Insert: {
          audit_id: string
          created_at?: string
          id?: string
          importance_score: number
          life_area_id: string
          next_point_move?: string | null
          note?: string | null
          priority_score?: number | null
          satisfaction_score: number
          updated_at?: string
          whats_not_working?: string | null
          whats_working?: string | null
          why_this_score?: string | null
        }
        Update: {
          audit_id?: string
          created_at?: string
          id?: string
          importance_score?: number
          life_area_id?: string
          next_point_move?: string | null
          note?: string | null
          priority_score?: number | null
          satisfaction_score?: number
          updated_at?: string
          whats_not_working?: string | null
          whats_working?: string | null
          why_this_score?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_responses_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_responses_life_area_id_fkey"
            columns: ["life_area_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          leverage_area_id: string | null
          recommended_focus_area_id: string | null
          recommended_focus_rationale: string | null
          sequence_number: number
          status: Database["public"]["Enums"]["audit_status"]
          total_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          leverage_area_id?: string | null
          recommended_focus_area_id?: string | null
          recommended_focus_rationale?: string | null
          sequence_number?: number
          status?: Database["public"]["Enums"]["audit_status"]
          total_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          leverage_area_id?: string | null
          recommended_focus_area_id?: string | null
          recommended_focus_rationale?: string | null
          sequence_number?: number
          status?: Database["public"]["Enums"]["audit_status"]
          total_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_leverage_area_id_fkey"
            columns: ["leverage_area_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_recommended_focus_area_id_fkey"
            columns: ["recommended_focus_area_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          action_completed: boolean
          checkin_date: string
          confidence_score: number | null
          created_at: string
          goal_id: string
          id: string
          note: string | null
          self_trust_score: number | null
          updated_at: string
        }
        Insert: {
          action_completed?: boolean
          checkin_date?: string
          confidence_score?: number | null
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          self_trust_score?: number | null
          updated_at?: string
        }
        Update: {
          action_completed?: boolean
          checkin_date?: string
          confidence_score?: number | null
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          self_trust_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      clear_plans: {
        Row: {
          audit_id: string
          completed_at: string | null
          created_at: string
          current_reality_look_like: string | null
          current_reality_pattern: string | null
          current_reality_pressure: string | null
          current_step: number
          emotional_block_belief: string | null
          emotional_block_emotion: string | null
          emotional_block_response: string | null
          goal_id: string | null
          id: string
          life_area_id: string
          life_vision_becoming: string | null
          life_vision_feel: string | null
          life_vision_thriving: string | null
          roadmap_checkin_rhythm: string | null
          roadmap_obstacles: string | null
          roadmap_weekly_action: string | null
          status: Database["public"]["Enums"]["audit_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_id: string
          completed_at?: string | null
          created_at?: string
          current_reality_look_like?: string | null
          current_reality_pattern?: string | null
          current_reality_pressure?: string | null
          current_step?: number
          emotional_block_belief?: string | null
          emotional_block_emotion?: string | null
          emotional_block_response?: string | null
          goal_id?: string | null
          id?: string
          life_area_id: string
          life_vision_becoming?: string | null
          life_vision_feel?: string | null
          life_vision_thriving?: string | null
          roadmap_checkin_rhythm?: string | null
          roadmap_obstacles?: string | null
          roadmap_weekly_action?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_id?: string
          completed_at?: string | null
          created_at?: string
          current_reality_look_like?: string | null
          current_reality_pattern?: string | null
          current_reality_pressure?: string | null
          current_step?: number
          emotional_block_belief?: string | null
          emotional_block_emotion?: string | null
          emotional_block_response?: string | null
          goal_id?: string | null
          id?: string
          life_area_id?: string
          life_vision_becoming?: string | null
          life_vision_feel?: string | null
          life_vision_thriving?: string | null
          roadmap_checkin_rhythm?: string | null
          roadmap_obstacles?: string | null
          roadmap_weekly_action?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clear_plans_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clear_plans_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clear_plans_life_area_id_fkey"
            columns: ["life_area_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          action_text: string
          clear_plan_id: string | null
          created_at: string
          frequency: Database["public"]["Enums"]["goal_frequency"]
          frequency_custom: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          life_area_id: string
          motivation_text: string
          review_date: string | null
          role: Database["public"]["Enums"]["goal_role"]
          start_date: string
          status: Database["public"]["Enums"]["goal_status"]
          success_criteria: string
          track_metric: Database["public"]["Enums"]["goal_track_metric"]
          track_metric_custom: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_text: string
          clear_plan_id?: string | null
          created_at?: string
          frequency: Database["public"]["Enums"]["goal_frequency"]
          frequency_custom?: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          life_area_id: string
          motivation_text: string
          review_date?: string | null
          role: Database["public"]["Enums"]["goal_role"]
          start_date?: string
          status?: Database["public"]["Enums"]["goal_status"]
          success_criteria: string
          track_metric: Database["public"]["Enums"]["goal_track_metric"]
          track_metric_custom?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_text?: string
          clear_plan_id?: string | null
          created_at?: string
          frequency?: Database["public"]["Enums"]["goal_frequency"]
          frequency_custom?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          life_area_id?: string
          motivation_text?: string
          review_date?: string | null
          role?: Database["public"]["Enums"]["goal_role"]
          start_date?: string
          status?: Database["public"]["Enums"]["goal_status"]
          success_criteria?: string
          track_metric?: Database["public"]["Enums"]["goal_track_metric"]
          track_metric_custom?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_clear_plan_id_fkey"
            columns: ["clear_plan_id"]
            isOneToOne: false
            referencedRelation: "clear_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_life_area_id_fkey"
            columns: ["life_area_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      life_areas: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_anonymous: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_anonymous?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_anonymous?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_status: "in_progress" | "completed"
      goal_frequency: "daily" | "three_per_week" | "weekly" | "custom"
      goal_role: "primary" | "supporting"
      goal_status: "active" | "completed" | "abandoned"
      goal_track_metric:
        | "action_completed"
        | "habit_done"
        | "confidence_score"
        | "self_trust_score"
        | "custom"
      goal_type:
        | "take_action"
        | "build_habit"
        | "have_conversation"
        | "set_boundary"
        | "create_consistency"
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
    Enums: {
      audit_status: ["in_progress", "completed"],
      goal_frequency: ["daily", "three_per_week", "weekly", "custom"],
      goal_role: ["primary", "supporting"],
      goal_status: ["active", "completed", "abandoned"],
      goal_track_metric: [
        "action_completed",
        "habit_done",
        "confidence_score",
        "self_trust_score",
        "custom",
      ],
      goal_type: [
        "take_action",
        "build_habit",
        "have_conversation",
        "set_boundary",
        "create_consistency",
      ],
    },
  },
} as const

// ============================================================================
// Convenience aliases — hand-added, not part of the Supabase-generated output
// above. Re-add these after every `generate_typescript_types` regeneration.
// ============================================================================

export type AuditStatus = Database["public"]["Enums"]["audit_status"]
export type GoalRole = Database["public"]["Enums"]["goal_role"]
export type GoalType = Database["public"]["Enums"]["goal_type"]
export type GoalFrequency = Database["public"]["Enums"]["goal_frequency"]
export type GoalTrackMetric = Database["public"]["Enums"]["goal_track_metric"]
export type GoalStatus = Database["public"]["Enums"]["goal_status"]

export type LifeArea = Database["public"]["Tables"]["life_areas"]["Row"]
export type Audit = Database["public"]["Tables"]["audits"]["Row"]
export type AuditResponse = Database["public"]["Tables"]["audit_responses"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ClearPlan = Database["public"]["Tables"]["clear_plans"]["Row"]
export type Goal = Database["public"]["Tables"]["goals"]["Row"]
export type Checkin = Database["public"]["Tables"]["checkins"]["Row"]

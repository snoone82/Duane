/**
 * Hand-written to match supabase/migrations/0001_aligned_phase_one.sql.
 * Regenerate with the Supabase CLI once available:
 *   supabase gen types typescript --project-id <ref> > lib/database.types.ts
 */

export type AuditStatus = "in_progress" | "completed";

export interface Database {
  public: {
    Tables: {
      life_areas: {
        Row: {
          id: string;
          name: string;
          description: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // content-managed from the dashboard, not the app
        Update: never;
      };
      audits: {
        Row: {
          id: string;
          user_id: string;
          status: AuditStatus;
          sequence_number: number;
          leverage_area_id: string | null;
          total_score: number | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: AuditStatus;
          // sequence_number is assigned by a trigger — never provide it.
          leverage_area_id?: string | null;
          total_score?: number | null;
          completed_at?: string | null;
        };
        Update: Partial<{
          status: AuditStatus;
          leverage_area_id: string | null;
          total_score: number | null;
          completed_at: string | null;
        }>;
      };
      audit_responses: {
        Row: {
          id: string;
          audit_id: string;
          life_area_id: string;
          satisfaction_score: number;
          importance_score: number;
          priority_score: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          audit_id: string;
          life_area_id: string;
          satisfaction_score: number;
          importance_score: number;
          note?: string | null;
        };
        Update: Partial<{
          satisfaction_score: number;
          importance_score: number;
          note: string | null;
        }>;
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // created by trigger only
        Update: never;
      };
    };
  };
}

export type LifeArea = Database["public"]["Tables"]["life_areas"]["Row"];
export type Audit = Database["public"]["Tables"]["audits"]["Row"];
export type AuditResponse = Database["public"]["Tables"]["audit_responses"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

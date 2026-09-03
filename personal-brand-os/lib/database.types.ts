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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          checklist: Json
          client_id: string
          completed_at: string | null
          consultation_id: string | null
          content_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          owner_name: string | null
          owner_user_id: string | null
          portal_notes: string
          priority: string
          sales_opportunity_id: string | null
          source: string
          status: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          checklist?: Json
          client_id: string
          completed_at?: string | null
          consultation_id?: string | null
          content_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          owner_name?: string | null
          owner_user_id?: string | null
          portal_notes?: string
          priority?: string
          sales_opportunity_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          checklist?: Json
          client_id?: string
          completed_at?: string | null
          consultation_id?: string | null
          content_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          owner_name?: string | null
          owner_user_id?: string | null
          portal_notes?: string
          priority?: string
          sales_opportunity_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "portal_meeting_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_sales_opportunity_id_fkey"
            columns: ["sales_opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          client_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audiences: {
        Row: {
          client_id: string
          content_interests: string
          created_at: string
          demographics: string
          description: string
          goals: string
          id: string
          name: string
          notes: string
          pain_points: string
          sort_order: number
          stage: string
          target_action: string
          target_belief: string
          updated_at: string
          where_they_are: string
        }
        Insert: {
          client_id: string
          content_interests?: string
          created_at?: string
          demographics?: string
          description?: string
          goals?: string
          id?: string
          name: string
          notes?: string
          pain_points?: string
          sort_order?: number
          stage?: string
          target_action?: string
          target_belief?: string
          updated_at?: string
          where_they_are?: string
        }
        Update: {
          client_id?: string
          content_interests?: string
          created_at?: string
          demographics?: string
          description?: string
          goals?: string
          id?: string
          name?: string
          notes?: string
          pain_points?: string
          sort_order?: number
          stage?: string
          target_action?: string
          target_belief?: string
          updated_at?: string
          where_they_are?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          client_id: string | null
          id: string
          record_id: string
          summary: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          client_id?: string | null
          id?: string
          record_id: string
          summary?: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          client_id?: string | null
          id?: string
          record_id?: string
          summary?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authority_opportunities: {
        Row: {
          audience_size: number | null
          client_id: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          host: string | null
          id: string
          notes: string
          opportunity_date: string | null
          published_url: string | null
          status: Database["public"]["Enums"]["authority_status"]
          type: string
          updated_at: string
        }
        Insert: {
          audience_size?: number | null
          client_id: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          host?: string | null
          id?: string
          notes?: string
          opportunity_date?: string | null
          published_url?: string | null
          status?: Database["public"]["Enums"]["authority_status"]
          type: string
          updated_at?: string
        }
        Update: {
          audience_size?: number | null
          client_id?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          host?: string | null
          id?: string
          notes?: string
          opportunity_date?: string | null
          published_url?: string | null
          status?: Database["public"]["Enums"]["authority_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authority_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ayrshare_profiles: {
        Row: {
          client_id: string
          created_at: string
          id: string
          profile_key: string
          ref_id: string
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          profile_key: string
          ref_id?: string
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          profile_key?: string
          ref_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ayrshare_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_pillars: {
        Row: {
          associated_stories: string
          calls_to_action: string
          client_id: string
          created_at: string
          description: string
          example_topics: string
          id: string
          key_messages: string
          name: string
          purpose: string
          relevant_expertise: string
          sort_order: number
          target_audience: string
          updated_at: string
        }
        Insert: {
          associated_stories?: string
          calls_to_action?: string
          client_id: string
          created_at?: string
          description?: string
          example_topics?: string
          id?: string
          key_messages?: string
          name: string
          purpose?: string
          relevant_expertise?: string
          sort_order?: number
          target_audience?: string
          updated_at?: string
        }
        Update: {
          associated_stories?: string
          calls_to_action?: string
          client_id?: string
          created_at?: string
          description?: string
          example_topics?: string
          id?: string
          key_messages?: string
          name?: string
          purpose?: string
          relevant_expertise?: string
          sort_order?: number
          target_audience?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_pillars_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_vision: {
        Row: {
          authority_goal: string
          client_id: string
          commercial_goal: string
          desired_positioning: string
          impact_goal: string
          legacy_contribution: string
          long_term_goal: string
          updated_at: string
        }
        Insert: {
          authority_goal?: string
          client_id: string
          commercial_goal?: string
          desired_positioning?: string
          impact_goal?: string
          legacy_contribution?: string
          long_term_goal?: string
          updated_at?: string
        }
        Update: {
          authority_goal?: string
          client_id?: string
          commercial_goal?: string
          desired_positioning?: string
          impact_goal?: string
          legacy_contribution?: string
          long_term_goal?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_vision_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          assigned_at: string
          client_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          client_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          client_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          category: Database["public"]["Enums"]["file_category"]
          client_id: string
          created_at: string
          file_name: string
          id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["file_category"]
          client_id: string
          created_at?: string
          file_name: string
          id?: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["file_category"]
          client_id?: string
          created_at?: string
          file_name?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          can_be_assigned: boolean
          client_id: string
          created_at: string
          email: string
          id: string
          job_title: string
          member_role: string
          name: string
          organisation: string
          permissions: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_be_assigned?: boolean
          client_id: string
          created_at?: string
          email?: string
          id?: string
          job_title?: string
          member_role?: string
          name: string
          organisation?: string
          permissions?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_be_assigned?: boolean
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          job_title?: string
          member_role?: string
          name?: string
          organisation?: string
          permissions?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          industry: string | null
          job_title: string | null
          location: string | null
          name: string
          north_star: string
          notes: string | null
          package: string | null
          phone: string | null
          photo_url: string | null
          portal_user_id: string | null
          retainer_amount: number | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          location?: string | null
          name: string
          north_star?: string
          notes?: string | null
          package?: string | null
          phone?: string | null
          photo_url?: string | null
          portal_user_id?: string | null
          retainer_amount?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          location?: string | null
          name?: string
          north_star?: string
          notes?: string | null
          package?: string | null
          phone?: string | null
          photo_url?: string | null
          portal_user_id?: string | null
          retainer_amount?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_outcomes: {
        Row: {
          client_id: string
          created_at: string
          description: string
          id: string
          notes: string
          outcome_date: string
          source: string | null
          value: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          id?: string
          notes?: string
          outcome_date?: string
          source?: string | null
          value?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string
          outcome_date?: string
          source?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_outcomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_snapshots: {
        Row: {
          client_id: string
          created_at: string
          enquiries: number | null
          id: string
          leads_generated: number | null
          new_customers: number | null
          notes: string
          opportunities_generated: number | null
          period_date: string
          revenue_attributed: number | null
          sales_calls: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          enquiries?: number | null
          id?: string
          leads_generated?: number | null
          new_customers?: number | null
          notes?: string
          opportunities_generated?: number | null
          period_date?: string
          revenue_attributed?: number | null
          sales_calls?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          enquiries?: number | null
          id?: string
          leads_generated?: number | null
          new_customers?: number | null
          notes?: string
          opportunities_generated?: number | null
          period_date?: string
          revenue_attributed?: number | null
          sales_calls?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          attendees: string
          challenges: string
          client_id: string
          client_updates: string
          commercial_opportunities: string
          content_discussed: string
          created_at: string
          created_by: string | null
          decisions_made: string
          id: string
          meeting_date: string
          meeting_type: string | null
          next_meeting_date: string | null
          strategic_observations: string
          summary: string
          updated_at: string
          wins: string
        }
        Insert: {
          attendees?: string
          challenges?: string
          client_id: string
          client_updates?: string
          commercial_opportunities?: string
          content_discussed?: string
          created_at?: string
          created_by?: string | null
          decisions_made?: string
          id?: string
          meeting_date?: string
          meeting_type?: string | null
          next_meeting_date?: string | null
          strategic_observations?: string
          summary?: string
          updated_at?: string
          wins?: string
        }
        Update: {
          attendees?: string
          challenges?: string
          client_id?: string
          client_updates?: string
          commercial_opportunities?: string
          content_discussed?: string
          created_at?: string
          created_by?: string | null
          decisions_made?: string
          id?: string
          meeting_date?: string
          meeting_type?: string | null
          next_meeting_date?: string | null
          strategic_observations?: string
          summary?: string
          updated_at?: string
          wins?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ideas: {
        Row: {
          action_id: string | null
          approval_comments: string
          approver_user_id: string | null
          audience_id: string | null
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          hook: string
          id: string
          media_path: string | null
          media_source_url: string
          media_url: string | null
          notes: string
          pillar_id: string | null
          priority: Database["public"]["Enums"]["content_priority"]
          production_due_date: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          target_publish_date: string | null
          thumbnail_path: string | null
          thumbnail_source_url: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          approval_comments?: string
          approver_user_id?: string | null
          audience_id?: string | null
          body?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          hook?: string
          id?: string
          media_path?: string | null
          media_source_url?: string
          media_url?: string | null
          notes?: string
          pillar_id?: string | null
          priority?: Database["public"]["Enums"]["content_priority"]
          production_due_date?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          target_publish_date?: string | null
          thumbnail_path?: string | null
          thumbnail_source_url?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          approval_comments?: string
          approver_user_id?: string | null
          audience_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          hook?: string
          id?: string
          media_path?: string | null
          media_source_url?: string
          media_url?: string | null
          notes?: string
          pillar_id?: string | null
          priority?: Database["public"]["Enums"]["content_priority"]
          production_due_date?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          target_publish_date?: string | null
          thumbnail_path?: string | null
          thumbnail_source_url?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "brand_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      content_outputs: {
        Row: {
          alt_text: string
          ayrshare_post_id: string
          caption: string
          client_id: string
          content_id: string
          created_at: string
          cta: string
          destination_link: string
          engagement: number | null
          format: string
          hashtags: string
          id: string
          live_url: string
          media_path: string | null
          media_source_url: string
          media_url: string | null
          notes: string
          platform: string
          publish_error: string
          published_at: string | null
          reach: number | null
          scheduled_at: string | null
          social_account_id: string | null
          sort_order: number
          status: string
          thumbnail_path: string | null
          thumbnail_source_url: string
          thumbnail_url: string | null
          updated_at: string
          views: number | null
        }
        Insert: {
          alt_text?: string
          ayrshare_post_id?: string
          caption?: string
          client_id: string
          content_id: string
          created_at?: string
          cta?: string
          destination_link?: string
          engagement?: number | null
          format?: string
          hashtags?: string
          id?: string
          live_url?: string
          media_path?: string | null
          media_source_url?: string
          media_url?: string | null
          notes?: string
          platform: string
          publish_error?: string
          published_at?: string | null
          reach?: number | null
          scheduled_at?: string | null
          social_account_id?: string | null
          sort_order?: number
          status?: string
          thumbnail_path?: string | null
          thumbnail_source_url?: string
          thumbnail_url?: string | null
          updated_at?: string
          views?: number | null
        }
        Update: {
          alt_text?: string
          ayrshare_post_id?: string
          caption?: string
          client_id?: string
          content_id?: string
          created_at?: string
          cta?: string
          destination_link?: string
          engagement?: number | null
          format?: string
          hashtags?: string
          id?: string
          live_url?: string
          media_path?: string | null
          media_source_url?: string
          media_url?: string | null
          notes?: string
          platform?: string
          publish_error?: string
          published_at?: string | null
          reach?: number | null
          scheduled_at?: string | null
          social_account_id?: string | null
          sort_order?: number
          status?: string
          thumbnail_path?: string | null
          thumbnail_source_url?: string
          thumbnail_url?: string | null
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_outputs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_outputs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_outputs_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          client_id: string
          comments: number | null
          created_at: string
          engagement: number | null
          follower_growth: number | null
          followers: number
          id: string
          impressions: number | null
          notes: string
          platform: string
          profile_visits: number | null
          reach: number | null
          saves: number | null
          shares: number | null
          snapshot_date: string
          video_views: number | null
        }
        Insert: {
          client_id: string
          comments?: number | null
          created_at?: string
          engagement?: number | null
          follower_growth?: number | null
          followers: number
          id?: string
          impressions?: number | null
          notes?: string
          platform: string
          profile_visits?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          snapshot_date: string
          video_views?: number | null
        }
        Update: {
          client_id?: string
          comments?: number | null
          created_at?: string
          engagement?: number | null
          follower_growth?: number | null
          followers?: number
          id?: string
          impressions?: number | null
          notes?: string
          platform?: string
          profile_visits?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          snapshot_date?: string
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_targets: {
        Row: {
          baseline_value: number | null
          client_id: string
          created_at: string
          id: string
          platform: string
          target_date: string | null
          target_value: number | null
          updated_at: string
        }
        Insert: {
          baseline_value?: number | null
          client_id: string
          created_at?: string
          id?: string
          platform: string
          target_date?: string | null
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          baseline_value?: number | null
          client_id?: string
          created_at?: string
          id?: string
          platform?: string
          target_date?: string | null
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          client_id: string
          created_at: string
          description: string
          id: string
          is_highlighted: boolean
          milestone_date: string
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string
          id?: string
          is_highlighted?: boolean
          milestone_date: string
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          is_highlighted?: boolean
          milestone_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      positioning: {
        Row: {
          client_id: string
          contrarian_opinions: string
          core_beliefs: string
          current_positioning: string
          desired_positioning: string
          differentiators: string
          expertise: string
          positioning_statement: string
          unique_story: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contrarian_opinions?: string
          core_beliefs?: string
          current_positioning?: string
          desired_positioning?: string
          differentiators?: string
          expertise?: string
          positioning_statement?: string
          unique_story?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contrarian_opinions?: string
          core_beliefs?: string
          current_positioning?: string
          desired_positioning?: string
          differentiators?: string
          expertise?: string
          positioning_statement?: string
          unique_story?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positioning_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_opportunities: {
        Row: {
          client_id: string
          closed_at: string | null
          contact_name: string
          created_at: string
          estimated_value: number | null
          expected_close: string | null
          id: string
          notes: string
          owner_name: string
          owner_user_id: string | null
          probability: number
          source: string
          stage: string
          stage_history: Json
          title: string
          updated_at: string
          value_type: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          contact_name?: string
          created_at?: string
          estimated_value?: number | null
          expected_close?: string | null
          id?: string
          notes?: string
          owner_name?: string
          owner_user_id?: string | null
          probability?: number
          source?: string
          stage?: string
          stage_history?: Json
          title: string
          updated_at?: string
          value_type?: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          contact_name?: string
          created_at?: string
          estimated_value?: number | null
          expected_close?: string | null
          id?: string
          notes?: string
          owner_name?: string
          owner_user_id?: string | null
          probability?: number
          source?: string
          stage?: string
          stage_history?: Json
          title?: string
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_strategy: {
        Row: {
          calls_to_action: string
          client_id: string
          enquiry_process: string
          ideal_clients: string
          lead_generation_approach: string
          lead_magnets: string
          offers: string
          referral_opportunities: string
          sales_conversations: string
          sales_messaging: string
          services_products: string
          target_customers: string
          updated_at: string
        }
        Insert: {
          calls_to_action?: string
          client_id: string
          enquiry_process?: string
          ideal_clients?: string
          lead_generation_approach?: string
          lead_magnets?: string
          offers?: string
          referral_opportunities?: string
          sales_conversations?: string
          sales_messaging?: string
          services_products?: string
          target_customers?: string
          updated_at?: string
        }
        Update: {
          calls_to_action?: string
          client_id?: string
          enquiry_process?: string
          ideal_clients?: string
          lead_generation_approach?: string
          lead_magnets?: string
          offers?: string
          referral_opportunities?: string
          sales_conversations?: string
          sales_messaging?: string
          services_products?: string
          target_customers?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_strategy_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_entries: {
        Row: {
          category: string
          client_id: string
          created_at: string
          id: string
          notes: string
          score: number
          scored_at: string
        }
        Insert: {
          category: string
          client_id: string
          created_at?: string
          id?: string
          notes?: string
          score: number
          scored_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          notes?: string
          score?: number
          scored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_strategies: {
        Row: {
          account_name: string
          account_status: string
          account_type: string
          ai_instructions: string
          audience: string
          ayrshare_platform: string
          ayrshare_profile_id: string | null
          cadence_period: string
          cadence_target: number
          client_id: string
          commercial_ratio: string
          content_length: string
          content_types: string
          created_at: string
          cross_post_rule: string
          cta_strategy: string
          engagement_strategy: string
          growth_strategy: string
          hook_guidance: string
          id: string
          is_primary: boolean
          objective: string
          owner_brand: string
          platform: string
          platform_exclusions: string
          platform_role: string
          posting_frequency: string
          preferred_formats: string
          primary_audience_id: string | null
          publishing_enabled: boolean
          repurposing_rules: string
          secondary_audience_id: string | null
          show_on_overview: boolean
          sort_order: number
          tone_voice: string
          updated_at: string
          url: string
        }
        Insert: {
          account_name?: string
          account_status?: string
          account_type?: string
          ai_instructions?: string
          audience?: string
          ayrshare_platform?: string
          ayrshare_profile_id?: string | null
          cadence_period?: string
          cadence_target?: number
          client_id: string
          commercial_ratio?: string
          content_length?: string
          content_types?: string
          created_at?: string
          cross_post_rule?: string
          cta_strategy?: string
          engagement_strategy?: string
          growth_strategy?: string
          hook_guidance?: string
          id?: string
          is_primary?: boolean
          objective?: string
          owner_brand?: string
          platform: string
          platform_exclusions?: string
          platform_role?: string
          posting_frequency?: string
          preferred_formats?: string
          primary_audience_id?: string | null
          publishing_enabled?: boolean
          repurposing_rules?: string
          secondary_audience_id?: string | null
          show_on_overview?: boolean
          sort_order?: number
          tone_voice?: string
          updated_at?: string
          url?: string
        }
        Update: {
          account_name?: string
          account_status?: string
          account_type?: string
          ai_instructions?: string
          audience?: string
          ayrshare_platform?: string
          ayrshare_profile_id?: string | null
          cadence_period?: string
          cadence_target?: number
          client_id?: string
          commercial_ratio?: string
          content_length?: string
          content_types?: string
          created_at?: string
          cross_post_rule?: string
          cta_strategy?: string
          engagement_strategy?: string
          growth_strategy?: string
          hook_guidance?: string
          id?: string
          is_primary?: boolean
          objective?: string
          owner_brand?: string
          platform?: string
          platform_exclusions?: string
          platform_role?: string
          posting_frequency?: string
          preferred_formats?: string
          primary_audience_id?: string | null
          publishing_enabled?: boolean
          repurposing_rules?: string
          secondary_audience_id?: string | null
          show_on_overview?: boolean
          sort_order?: number
          tone_voice?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_strategies_ayrshare_profile_id_fkey"
            columns: ["ayrshare_profile_id"]
            isOneToOne: false
            referencedRelation: "ayrshare_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_strategies_primary_audience_id_fkey"
            columns: ["primary_audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_strategies_secondary_audience_id_fkey"
            columns: ["secondary_audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_signoffs: {
        Row: {
          approved_at: string | null
          approved_by_name: string
          client_comments: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string
          client_comments?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot: Json
          status?: string
          title?: string
          updated_at?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string
          client_comments?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_signoffs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_signoffs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          id: boolean
          monthly_sales_target: number | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          monthly_sales_target?: number | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          monthly_sales_target?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      global_search: {
        Row: {
          body: string | null
          client_id: string | null
          id: string | null
          kind: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      portal_meeting_summaries: {
        Row: {
          client_id: string | null
          id: string | null
          meeting_date: string | null
          meeting_type: string | null
          next_meeting_date: string | null
          summary: string | null
          wins: string | null
        }
        Insert: {
          client_id?: string | null
          id?: string | null
          meeting_date?: string | null
          meeting_type?: string | null
          next_meeting_date?: string | null
          summary?: string | null
          wins?: string | null
        }
        Update: {
          client_id?: string | null
          id?: string | null
          meeting_date?: string | null
          meeting_type?: string | null
          next_meeting_date?: string | null
          summary?: string | null
          wins?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_client_access: {
        Args: { target_client_id: string }
        Returns: boolean
      }
      has_strategic_access: {
        Args: { target_client_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_portal_client_of: {
        Args: { target_client_id: string }
        Returns: boolean
      }
      is_team_member: { Args: never; Returns: boolean }
      portal_can: {
        Args: { perm: string; target_client_id: string }
        Returns: boolean
      }
    }
    Enums: {
      action_status: "not_started" | "in_progress" | "completed" | "waiting"
      authority_status:
        | "identified"
        | "pitched"
        | "in_conversation"
        | "booked"
        | "completed"
        | "published"
        | "declined"
      client_status: "prospect" | "active" | "paused" | "offboarded"
      content_priority: "low" | "medium" | "high"
      content_status:
        | "idea"
        | "approved"
        | "drafted"
        | "created"
        | "edited"
        | "scheduled"
        | "published"
        | "measured"
        | "approved_production"
        | "in_production"
        | "ready_for_approval"
        | "changes_requested"
        | "ready_to_schedule"
      file_category:
        | "headshot"
        | "presentation"
        | "case_study"
        | "contract"
        | "brand_guideline"
        | "other"
        | "brand_photography"
        | "video"
        | "podcast_footage"
        | "logo"
        | "strategy_document"
        | "script"
        | "content_calendar"
        | "press_kit"
        | "bio"
        | "testimonial"
      profile_role: "admin" | "member" | "contractor" | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      action_status: ["not_started", "in_progress", "completed", "waiting"],
      authority_status: [
        "identified",
        "pitched",
        "in_conversation",
        "booked",
        "completed",
        "published",
        "declined",
      ],
      client_status: ["prospect", "active", "paused", "offboarded"],
      content_priority: ["low", "medium", "high"],
      content_status: [
        "idea",
        "approved",
        "drafted",
        "created",
        "edited",
        "scheduled",
        "published",
        "measured",
        "approved_production",
        "in_production",
        "ready_for_approval",
        "changes_requested",
        "ready_to_schedule",
      ],
      file_category: [
        "headshot",
        "presentation",
        "case_study",
        "contract",
        "brand_guideline",
        "other",
        "brand_photography",
        "video",
        "podcast_footage",
        "logo",
        "strategy_document",
        "script",
        "content_calendar",
        "press_kit",
        "bio",
        "testimonial",
      ],
      profile_role: ["admin", "member", "contractor", "client"],
    },
  },
} as const

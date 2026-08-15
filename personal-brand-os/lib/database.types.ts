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
      actions: {
        Row: {
          client_id: string
          completed_at: string | null
          consultation_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          owner_name: string | null
          owner_user_id: string | null
          status: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          owner_name?: string | null
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          owner_name?: string | null
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          updated_at?: string
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
            foreignKeyName: "actions_owner_user_id_fkey"
            columns: ["owner_user_id"]
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
      clients: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          industry: string | null
          instagram_url: string | null
          job_title: string | null
          linkedin_url: string | null
          location: string | null
          name: string
          notes: string | null
          package: string | null
          phone: string | null
          photo_url: string | null
          portal_user_id: string | null
          retainer_amount: number | null
          status: Database["public"]["Enums"]["client_status"]
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          location?: string | null
          name: string
          notes?: string | null
          package?: string | null
          phone?: string | null
          photo_url?: string | null
          portal_user_id?: string | null
          retainer_amount?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          instagram_url?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          package?: string | null
          phone?: string | null
          photo_url?: string | null
          portal_user_id?: string | null
          retainer_amount?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
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
          audience_id: string | null
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          engagement: number | null
          format: string | null
          id: string
          notes: string
          pillar_id: string | null
          platform: string | null
          priority: Database["public"]["Enums"]["content_priority"]
          published_url: string | null
          reach: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience_id?: string | null
          body?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          engagement?: number | null
          format?: string | null
          id?: string
          notes?: string
          pillar_id?: string | null
          platform?: string | null
          priority?: Database["public"]["Enums"]["content_priority"]
          published_url?: string | null
          reach?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          engagement?: number | null
          format?: string | null
          id?: string
          notes?: string
          pillar_id?: string | null
          platform?: string | null
          priority?: Database["public"]["Enums"]["content_priority"]
          published_url?: string | null
          reach?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
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
          audience: string
          client_id: string
          content_types: string
          created_at: string
          cta_strategy: string
          engagement_strategy: string
          growth_strategy: string
          id: string
          objective: string
          platform: string
          posting_frequency: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          audience?: string
          client_id: string
          content_types?: string
          created_at?: string
          cta_strategy?: string
          engagement_strategy?: string
          growth_strategy?: string
          id?: string
          objective?: string
          platform: string
          posting_frequency?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          audience?: string
          client_id?: string
          content_types?: string
          created_at?: string
          cta_strategy?: string
          engagement_strategy?: string
          growth_strategy?: string
          id?: string
          objective?: string
          platform?: string
          posting_frequency?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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

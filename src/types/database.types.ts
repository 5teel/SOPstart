export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      organisation_members: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          trial_ends_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          trial_ends_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          trial_ends_at?: string
        }
        Relationships: []
      }
      parse_jobs: {
        Row: {
          ai_review_results: Json
          completed_at: string | null
          created_at: string
          current_stage: string | null
          error_message: string | null
          file_path: string
          file_type: string
          id: string
          input_type: string | null
          organisation_id: string
          pipeline_run_id: string | null
          prompt_text: string | null
          retry_count: number
          sop_id: string
          started_at: string | null
          status: string
          transcript_segments: Json | null
          transcript_text: string | null
          updated_at: string | null
          verification_flags: Json | null
          youtube_url: string | null
        }
        Insert: {
          ai_review_results?: Json
          completed_at?: string | null
          created_at?: string
          current_stage?: string | null
          error_message?: string | null
          file_path: string
          file_type: string
          id?: string
          input_type?: string | null
          organisation_id: string
          pipeline_run_id?: string | null
          prompt_text?: string | null
          retry_count?: number
          sop_id: string
          started_at?: string | null
          status?: string
          transcript_segments?: Json | null
          transcript_text?: string | null
          updated_at?: string | null
          verification_flags?: Json | null
          youtube_url?: string | null
        }
        Update: {
          ai_review_results?: Json
          completed_at?: string | null
          created_at?: string
          current_stage?: string | null
          error_message?: string | null
          file_path?: string
          file_type?: string
          id?: string
          input_type?: string | null
          organisation_id?: string
          pipeline_run_id?: string | null
          prompt_text?: string | null
          retry_count?: number
          sop_id?: string
          started_at?: string | null
          status?: string
          transcript_segments?: Json | null
          transcript_text?: string | null
          updated_at?: string | null
          verification_flags?: Json | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parse_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parse_jobs_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_images: {
        Row: {
          alt_text: string | null
          content_type: string
          created_at: string
          id: string
          section_id: string | null
          sop_id: string
          sort_order: number
          step_id: string | null
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          content_type: string
          created_at?: string
          id?: string
          section_id?: string | null
          sop_id: string
          sort_order?: number
          step_id?: string | null
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          content_type?: string
          created_at?: string
          id?: string
          section_id?: string | null
          sop_id?: string
          sort_order?: number
          step_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_images_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sop_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_images_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_images_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sop_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_image_annotations: {
        Row: {
          baked_at: string | null
          baked_storage_path: string | null
          created_at: string
          id: string
          natural_height: number | null
          natural_width: number | null
          organisation_id: string
          scene: Json
          sop_image_id: string
          updated_at: string
        }
        Insert: {
          baked_at?: string | null
          baked_storage_path?: string | null
          created_at?: string
          id?: string
          natural_height?: number | null
          natural_width?: number | null
          organisation_id: string
          scene: Json
          sop_image_id: string
          updated_at?: string
        }
        Update: {
          baked_at?: string | null
          baked_storage_path?: string | null
          created_at?: string
          id?: string
          natural_height?: number | null
          natural_width?: number | null
          organisation_id?: string
          scene?: Json
          sop_image_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_image_annotations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_image_annotations_sop_image_id_fkey"
            columns: ["sop_image_id"]
            isOneToOne: false
            referencedRelation: "sop_images"
            referencedColumns: ["id"]
          },
        ]
      }
      // Plan 26.5-02: manually extended per CLAUDE.md learning (type regen unavailable).
      // Source: migration 00040_agent_metadata_schema.sql.
      sop_agent_metadata: {
        Row: {
          assessment: string
          created_at: string
          entities: Json
          id: string
          last_synthesis_error: string | null
          last_synthesis_status: string | null
          links: Json
          organisation_id: string
          regenerated_at: string | null
          sop_id: string
          summary: string | null
          tags: string[]
          updated_at: string
          embedding: string | null
        }
        Insert: {
          assessment?: string
          created_at?: string
          entities?: Json
          id?: string
          last_synthesis_error?: string | null
          last_synthesis_status?: string | null
          links?: Json
          organisation_id: string
          regenerated_at?: string | null
          sop_id: string
          summary?: string | null
          tags?: string[]
          updated_at?: string
          embedding?: string | null
        }
        Update: {
          assessment?: string
          created_at?: string
          entities?: Json
          id?: string
          last_synthesis_error?: string | null
          last_synthesis_status?: string | null
          links?: Json
          organisation_id?: string
          regenerated_at?: string | null
          sop_id?: string
          summary?: string | null
          tags?: string[]
          updated_at?: string
          embedding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_agent_metadata_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_agent_metadata_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: true
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      block_agent_metadata: {
        Row: {
          created_at: string
          block_id: string
          embedding: string | null
          entities: Json | null
          id: string
          organisation_id: string
          regenerated_at: string | null
          sop_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          block_id: string
          embedding?: string | null
          entities?: Json | null
          id?: string
          organisation_id: string
          regenerated_at?: string | null
          sop_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          block_id?: string
          embedding?: string | null
          entities?: Json | null
          id?: string
          organisation_id?: string
          regenerated_at?: string | null
          sop_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_agent_metadata_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_agent_metadata_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: true
            referencedRelation: "sop_section_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_agent_metadata_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          observation: string
          organisation_id: string
          scope: string
          signal_source: string | null
          sop_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          observation: string
          organisation_id: string
          scope: string
          signal_source?: string | null
          sop_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          observation?: string
          organisation_id?: string
          scope?: string
          signal_source?: string | null
          sop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memory_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learning_proposals: {
        Row: {
          created_at: string
          description: string
          evidence: Json
          id: string
          kind: string
          organisation_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sop_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          evidence?: Json
          id?: string
          kind: string
          organisation_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sop_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          evidence?: Json
          id?: string
          kind?: string
          organisation_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sop_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_learning_proposals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_learning_proposals_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_learning_proposals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_voice_qa_log: {
        Row: {
          answer: string | null
          citations: Json
          created_at: string
          id: string
          organisation_id: string
          question: string
          sop_id: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          citations?: Json
          created_at?: string
          id?: string
          organisation_id: string
          question: string
          sop_id: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          citations?: Json
          created_at?: string
          id?: string
          organisation_id?: string
          question?: string
          sop_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_voice_qa_log_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_voice_qa_log_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_voice_qa_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_sections: {
        Row: {
          approved: boolean
          confidence: number | null
          content: string | null
          created_at: string
          id: string
          // Plan 21-05: manually extended per CLAUDE.md learning (type regen unavailable).
          // Source: migration 00020_section_layout_data.sql.
          layout_data: Json | null
          layout_version: number | null
          section_kind_id: string | null
          section_type: string
          sop_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          confidence?: number | null
          content?: string | null
          created_at?: string
          id?: string
          layout_data?: Json | null
          layout_version?: number | null
          section_kind_id?: string | null
          section_type: string
          sop_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          confidence?: number | null
          content?: string | null
          created_at?: string
          id?: string
          layout_data?: Json | null
          layout_version?: number | null
          section_kind_id?: string | null
          section_type?: string
          sop_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_sections_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_sections_section_kind_id_fkey"
            columns: ["section_kind_id"]
            isOneToOne: false
            referencedRelation: "section_kinds"
            referencedColumns: ["id"]
          },
        ]
      }
      section_kinds: {
        Row: {
          color_family: string | null
          created_at: string
          description: string | null
          display_name: string
          icon: string | null
          id: string
          organisation_id: string | null
          render_family: string
          render_priority: number
          slug: string
          updated_at: string
        }
        Insert: {
          color_family?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          organisation_id?: string | null
          render_family: string
          render_priority?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color_family?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          organisation_id?: string | null
          render_family?: string
          render_priority?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_kinds_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          archived_at: string | null
          category: string | null
          category_tags: string[]
          created_at: string
          created_by: string | null
          current_version_id: string | null
          free_text_tags: string[]
          id: string
          kind_slug: string
          name: string
          organisation_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          category_tags?: string[]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          free_text_tags?: string[]
          id?: string
          kind_slug: string
          name: string
          organisation_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          category_tags?: string[]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          free_text_tags?: string[]
          id?: string
          kind_slug?: string
          name?: string
          organisation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "block_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      block_versions: {
        Row: {
          block_id: string
          change_note: string | null
          content: Json
          created_at: string
          created_by: string | null
          id: string
          version_number: number
        }
        Insert: {
          block_id: string
          change_note?: string | null
          content: Json
          created_at?: string
          created_by?: string | null
          id?: string
          version_number: number
        }
        Update: {
          block_id?: string
          change_note?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "block_versions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_section_blocks: {
        Row: {
          block_id: string
          block_provenance: Json | null
          created_at: string
          id: string
          overridden_at: string | null
          pin_mode: string
          pinned_version_id: string | null
          snapshot_content: Json
          sop_section_id: string
          sort_order: number
          update_available: boolean
          updated_at: string
          verified_at: string | null
          verified_by_admin_id: string | null
        }
        Insert: {
          block_id: string
          block_provenance?: Json | null
          created_at?: string
          id?: string
          overridden_at?: string | null
          pin_mode?: string
          pinned_version_id?: string | null
          snapshot_content: Json
          sop_section_id: string
          sort_order?: number
          update_available?: boolean
          updated_at?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
        }
        Update: {
          block_id?: string
          block_provenance?: Json | null
          created_at?: string
          id?: string
          overridden_at?: string | null
          pin_mode?: string
          pinned_version_id?: string | null
          snapshot_content?: Json
          sop_section_id?: string
          sort_order?: number
          update_available?: boolean
          updated_at?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_section_blocks_sop_section_id_fkey"
            columns: ["sop_section_id"]
            isOneToOne: false
            referencedRelation: "sop_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_section_blocks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_section_blocks_pinned_version_id_fkey"
            columns: ["pinned_version_id"]
            isOneToOne: false
            referencedRelation: "block_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_section_blocks_verified_by_admin_id_fkey"
            columns: ["verified_by_admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_anthropic_spend: {
        Row: {
          cap_cents: number | null
          month_start: string
          organisation_id: string
          spend_cents: number
          updated_at: string
        }
        Insert: {
          cap_cents?: number | null
          month_start: string
          organisation_id: string
          spend_cents?: number
          updated_at?: string
        }
        Update: {
          cap_cents?: number | null
          month_start?: string
          organisation_id?: string
          spend_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_anthropic_spend_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_review_rate_limits: {
        Row: {
          sop_id: string
          runs_today: number
          runs_today_reset_at: string
        }
        Insert: {
          sop_id: string
          runs_today?: number
          runs_today_reset_at?: string
        }
        Update: {
          sop_id?: string
          runs_today?: number
          runs_today_reset_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_review_rate_limits_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: true
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          user_id: string
          granted_at: string
          granted_by: string | null
          notes: string | null
        }
        Insert: {
          user_id: string
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
        }
        Update: {
          user_id?: string
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      block_categories: {
        Row: {
          slug: string
          display_name: string
          category_group: 'hazard' | 'area' | 'ppe' | 'procedure'
          sort_order: number
          created_at: string
        }
        Insert: {
          slug: string
          display_name: string
          category_group: 'hazard' | 'area' | 'ppe' | 'procedure'
          sort_order?: number
          created_at?: string
        }
        Update: {
          slug?: string
          display_name?: string
          category_group?: 'hazard' | 'area' | 'ppe' | 'procedure'
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      block_suggestions: {
        Row: {
          id: string
          source_block_id: string
          suggested_by_org_id: string
          suggested_by_user: string | null
          snapshot: Json
          status: 'pending' | 'promoted' | 'rejected'
          decided_by: string | null
          decided_at: string | null
          decision_note: string | null
          promoted_block_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          source_block_id: string
          suggested_by_org_id: string
          suggested_by_user?: string | null
          snapshot: Json
          status?: 'pending' | 'promoted' | 'rejected'
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          promoted_block_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          source_block_id?: string
          suggested_by_org_id?: string
          suggested_by_user?: string | null
          snapshot?: Json
          status?: 'pending' | 'promoted' | 'rejected'
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          promoted_block_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sop_block_update_decisions: {
        Row: {
          id: string
          sop_section_block_id: string
          block_version_id: string
          decision: 'accept' | 'decline'
          decided_by: string | null
          decided_at: string
          note: string | null
        }
        Insert: {
          id?: string
          sop_section_block_id: string
          block_version_id: string
          decision: 'accept' | 'decline'
          decided_by?: string | null
          decided_at?: string
          note?: string | null
        }
        Update: {
          id?: string
          sop_section_block_id?: string
          block_version_id?: string
          decision?: 'accept' | 'decline'
          decided_by?: string | null
          decided_at?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_block_update_decisions_sop_section_block_id_fkey"
            columns: ["sop_section_block_id"]
            isOneToOne: false
            referencedRelation: "sop_section_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_block_update_decisions_block_version_id_fkey"
            columns: ["block_version_id"]
            isOneToOne: false
            referencedRelation: "block_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_steps: {
        Row: {
          caution: string | null
          created_at: string
          id: string
          photo_required: boolean
          required_tools: string[] | null
          section_id: string
          step_number: number
          text: string
          time_estimate_minutes: number | null
          tip: string | null
          updated_at: string
          warning: string | null
        }
        Insert: {
          caution?: string | null
          created_at?: string
          id?: string
          photo_required?: boolean
          required_tools?: string[] | null
          section_id: string
          step_number: number
          text: string
          time_estimate_minutes?: number | null
          tip?: string | null
          updated_at?: string
          warning?: string | null
        }
        Update: {
          caution?: string | null
          created_at?: string
          id?: string
          photo_required?: boolean
          required_tools?: string[] | null
          section_id?: string
          step_number?: number
          text?: string
          time_estimate_minutes?: number | null
          tip?: string | null
          updated_at?: string
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_steps_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sop_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_pipeline_runs: {
        Row: {
          id: string
          organisation_id: string
          requested_video_format: 'narrated_slideshow' | 'screen_recording'
          status: 'active' | 'completed' | 'failed' | 'cancelled'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          requested_video_format: 'narrated_slideshow' | 'screen_recording'
          status?: 'active' | 'completed' | 'failed' | 'cancelled'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          requested_video_format?: 'narrated_slideshow' | 'screen_recording'
          status?: 'active' | 'completed' | 'failed' | 'cancelled'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_pipeline_runs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          applicable_equipment: string[] | null
          approval_snapshot: Json | null
          approval_state: string | null
          author: string | null
          category: string | null
          category_tag: string | null
          created_at: string
          department: string | null
          flow_graph: Json | null
          id: string
          is_ocr: boolean
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          organisation_id: string
          overall_confidence: number | null
          owner_user_id: string | null
          parent_sop_id: string | null
          parse_notes: string | null
          pipeline_run_id: string | null
          published_at: string | null
          refresher_interval_months: number | null
          related_sops: string[] | null
          required_certifications: string[] | null
          review_due_at: string | null
          revision_date: string | null
          sop_number: string | null
          source_file_name: string
          source_file_path: string
          source_file_type: string
          status: Database["public"]["Enums"]["sop_status"]
          superseded_by: string | null
          title: string | null
          updated_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          applicable_equipment?: string[] | null
          approval_snapshot?: Json | null
          approval_state?: string | null
          author?: string | null
          category?: string | null
          category_tag?: string | null
          created_at?: string
          department?: string | null
          flow_graph?: Json | null
          id?: string
          is_ocr?: boolean
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          organisation_id: string
          overall_confidence?: number | null
          owner_user_id?: string | null
          parent_sop_id?: string | null
          parse_notes?: string | null
          pipeline_run_id?: string | null
          published_at?: string | null
          refresher_interval_months?: number | null
          related_sops?: string[] | null
          required_certifications?: string[] | null
          review_due_at?: string | null
          revision_date?: string | null
          sop_number?: string | null
          source_file_name: string
          source_file_path: string
          source_file_type: string
          status?: Database["public"]["Enums"]["sop_status"]
          superseded_by?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          applicable_equipment?: string[] | null
          approval_snapshot?: Json | null
          approval_state?: string | null
          author?: string | null
          category?: string | null
          category_tag?: string | null
          created_at?: string
          department?: string | null
          flow_graph?: Json | null
          id?: string
          is_ocr?: boolean
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          organisation_id?: string
          overall_confidence?: number | null
          owner_user_id?: string | null
          parent_sop_id?: string | null
          parse_notes?: string | null
          pipeline_run_id?: string | null
          published_at?: string | null
          refresher_interval_months?: number | null
          related_sops?: string[] | null
          required_certifications?: string[] | null
          review_due_at?: string | null
          revision_date?: string | null
          sop_number?: string | null
          source_file_name?: string
          source_file_path?: string
          source_file_type?: string
          status?: Database["public"]["Enums"]["sop_status"]
          superseded_by?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sops_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      // ------------------------------------------------------------
      // Phase 15: sub-trade controlled vocab + junctions (migration 00030)
      // ------------------------------------------------------------
      sub_trades: {
        Row: {
          id: string
          slug: string
          label: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          label: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          label?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      users_sub_trades: {
        Row: {
          user_id: string
          sub_trade_id: string
          assigned_at: string
          assigned_by: string | null
        }
        Insert: {
          user_id: string
          sub_trade_id: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Update: {
          user_id?: string
          sub_trade_id?: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_sub_trades_sub_trade_id_fkey"
            columns: ["sub_trade_id"]
            isOneToOne: false
            referencedRelation: "sub_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      sops_sub_trades: {
        Row: {
          sop_id: string
          sub_trade_id: string
        }
        Insert: {
          sop_id: string
          sub_trade_id: string
        }
        Update: {
          sop_id?: string
          sub_trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sops_sub_trades_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sops_sub_trades_sub_trade_id_fkey"
            columns: ["sub_trade_id"]
            isOneToOne: false
            referencedRelation: "sub_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_notifications: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          read: boolean
          sop_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          read?: boolean
          sop_id: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          read?: boolean
          sop_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_notifications_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_assignments: {
        Row: {
          id: string
          organisation_id: string
          sop_id: string
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
          assigned_by: string
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          sop_id: string
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
          assigned_by: string
          created_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          sop_id?: string
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
          assigned_by?: string
          created_at?: string
        }
        Relationships: []
      }
      supervisor_assignments: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          supervisor_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          supervisor_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          supervisor_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_assignments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_voice_notes: {
        Row: {
          id: string
          organisation_id: string
          sop_id: string
          section_id: string | null
          step_id: string | null
          completion_id: string | null
          block_type: 'measurement' | 'note'
          transcript: string
          audio_storage_path: string
          confidence: number | null
          language: 'en-NZ' | 'en-AU' | 'en-US'
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          sop_id: string
          section_id?: string | null
          step_id?: string | null
          completion_id?: string | null
          block_type: 'measurement' | 'note'
          transcript: string
          audio_storage_path: string
          confidence?: number | null
          language?: 'en-NZ' | 'en-AU' | 'en-US'
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          sop_id?: string
          section_id?: string | null
          step_id?: string | null
          completion_id?: string | null
          block_type?: 'measurement' | 'note'
          transcript?: string
          audio_storage_path?: string
          confidence?: number | null
          language?: 'en-NZ' | 'en-AU' | 'en-US'
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      escalation_reports: {
        Row: {
          id: string
          organisation_id: string
          sop_id: string
          section_id: string | null
          step_id: string | null
          completion_id: string | null
          escalation_mode: 'alert' | 'lock' | 'form'
          reason: string | null
          photos: string[] | null
          measurements: Json | null
          status: 'open' | 'acknowledged' | 'resolved'
          submitted_by: string
          submitted_at: string
          acknowledged_by: string | null
          acknowledged_at: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          sop_id: string
          section_id?: string | null
          step_id?: string | null
          completion_id?: string | null
          escalation_mode: 'alert' | 'lock' | 'form'
          reason?: string | null
          photos?: string[] | null
          measurements?: Json | null
          status?: 'open' | 'acknowledged' | 'resolved'
          submitted_by: string
          submitted_at?: string
          acknowledged_by?: string | null
          acknowledged_at?: string | null
        }
        Update: {
          id?: string
          organisation_id?: string
          sop_id?: string
          section_id?: string | null
          step_id?: string | null
          completion_id?: string | null
          escalation_mode?: 'alert' | 'lock' | 'form'
          reason?: string | null
          photos?: string[] | null
          measurements?: Json | null
          status?: 'open' | 'acknowledged' | 'resolved'
          submitted_by?: string
          submitted_at?: string
          acknowledged_by?: string | null
          acknowledged_at?: string | null
        }
        Relationships: []
      }
      walkthrough_progress: {
        Row: {
          sop_id: string
          user_id: string
          step_id: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          sop_id: string
          user_id: string
          step_id?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          sop_id?: string
          user_id?: string
          step_id?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sop_completions: {
        Row: {
          id: string
          organisation_id: string
          sop_id: string
          worker_id: string
          sop_version: number
          content_hash: string
          status: Database["public"]["Enums"]["completion_status"]
          step_data: Json
          submitted_at: string
          created_at: string
          // Phase 15 D-21: ordered ack-button click trace
          step_ack_trace: Json
          // Phase 23 D-11: roster attribution FK, distinct from worker_id (shared-device uid for RLS)
          roster_worker_id: string | null
        }
        Insert: {
          id: string
          organisation_id: string
          sop_id: string
          worker_id: string
          sop_version: number
          content_hash: string
          status?: Database["public"]["Enums"]["completion_status"]
          step_data: Json
          submitted_at?: string
          created_at?: string
          step_ack_trace?: Json | null
          // Phase 23 D-11: roster attribution FK
          roster_worker_id?: string | null
        }
        Update: {
          id?: string
          organisation_id?: string
          sop_id?: string
          worker_id?: string
          sop_version?: number
          content_hash?: string
          status?: Database["public"]["Enums"]["completion_status"]
          step_data?: Json
          submitted_at?: string
          created_at?: string
          step_ack_trace?: Json | null
          // Phase 23 D-11: roster attribution FK
          roster_worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_completions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_completions_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_photos: {
        Row: {
          id: string
          organisation_id: string
          completion_id: string
          step_id: string
          storage_path: string
          content_type: string
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          completion_id: string
          step_id: string
          storage_path: string
          content_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          completion_id?: string
          step_id?: string
          storage_path?: string
          content_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_photos_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_photos_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "sop_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_sign_offs: {
        Row: {
          id: string
          organisation_id: string
          completion_id: string
          supervisor_id: string
          decision: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          completion_id: string
          supervisor_id: string
          decision: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          completion_id?: string
          supervisor_id?: string
          decision?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_sign_offs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_sign_offs_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "sop_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      // Phase 23 AFL-VER-05: append-only sign-off chain (migration 00038)
      sop_completion_signatures: {
        Row: {
          id: string
          organisation_id: string
          completion_id: string
          role: string  // 'worker' | 'supervisor'
          roster_user_id: string
          signed_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          completion_id: string
          role: string
          roster_user_id: string
          signed_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          completion_id?: string
          role?: string
          roster_user_id?: string
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_completion_signatures_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_completion_signatures_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "sop_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      // Phase 23 X-03: AI field write proposals pending admin approval (migration 00038)
      ai_field_proposals: {
        Row: {
          id: string
          organisation_id: string
          field_id: string
          field_label: string
          context: Json
          current_value: Json | null
          proposed_value: Json | null
          status: string  // 'pending' | 'applied' | 'rejected'
          sop_version: number | null
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          field_id: string
          field_label: string
          context?: Json
          current_value?: Json | null
          proposed_value?: Json | null
          status?: string
          sop_version?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          organisation_id?: string
          field_id?: string
          field_label?: string
          context?: Json
          current_value?: Json | null
          proposed_value?: Json | null
          status?: string
          sop_version?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_field_proposals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_generation_jobs: {
        Row: {
          id: string
          organisation_id: string
          sop_id: string
          sop_version: number
          format: "narrated_slideshow" | "screen_recording"
          status: "queued" | "analyzing" | "generating_audio" | "rendering" | "ready" | "failed"
          current_stage: string | null
          shotstack_render_id: string | null
          video_url: string | null
          chapter_markers: Json | null
          error_message: string | null
          published: boolean
          pipeline_run_id: string | null
          created_by: string
          completed_at: string | null
          created_at: string
          updated_at: string
          // Phase 10: multi-version support (migration 00016)
          version_number: number
          label: string | null
          archived: boolean
        }
        Insert: {
          id?: string
          organisation_id: string
          sop_id: string
          sop_version: number
          format: "narrated_slideshow" | "screen_recording"
          status?: "queued" | "analyzing" | "generating_audio" | "rendering" | "ready" | "failed"
          current_stage?: string | null
          shotstack_render_id?: string | null
          video_url?: string | null
          chapter_markers?: Json | null
          error_message?: string | null
          published?: boolean
          pipeline_run_id?: string | null
          created_by: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          // Phase 10: multi-version support (migration 00016)
          version_number?: number
          label?: string | null
          archived?: boolean
        }
        Update: {
          id?: string
          organisation_id?: string
          sop_id?: string
          sop_version?: number
          format?: "narrated_slideshow" | "screen_recording"
          status?: "queued" | "analyzing" | "generating_audio" | "rendering" | "ready" | "failed"
          current_stage?: string | null
          shotstack_render_id?: string | null
          video_url?: string | null
          chapter_markers?: Json | null
          error_message?: string | null
          published?: boolean
          pipeline_run_id?: string | null
          created_by?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          // Phase 10: multi-version support (migration 00016)
          version_number?: number
          label?: string | null
          archived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "video_generation_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_generation_jobs_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organisation_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_platform_admin: { Args: Record<string, never>; Returns: boolean }
      accept_block_update: {
        Args: {
          p_sop_section_block_id: string
          p_new_version_id: string
          p_note?: string | null
        }
        Returns: void
      }
      decline_block_update: {
        Args: {
          p_sop_section_block_id: string
          p_new_version_id: string
          p_note?: string | null
        }
        Returns: void
      }
      // Trigger function — never directly callable from client; declared so
      // schema-aware tooling does not consider it missing.
      propagate_block_update: { Args: Record<string, never>; Returns: unknown }
      // Phase 15: sub-trade RLS helpers (migration 00030)
      current_user_sub_trades: { Args: Record<string, never>; Returns: string[] }
      sub_trade_id_intersects: { Args: { p_sop_id: string }; Returns: boolean }
      // Phase 26.5 D-03: pgvector similarity RPC (migration 00040) — PostgREST
      // cannot express the <=> operator, so this wraps it; SECURITY DEFINER,
      // self-enforces organisation_id inside the function body.
      match_sop_agent_metadata: {
        Args: { p_organisation_id: string; query_embedding: string; match_count?: number }
        Returns: { sop_id: string; similarity: number }[]
      }
    }
    Enums: {
      app_role: "worker" | "supervisor" | "admin" | "safety_manager"
      assignment_type: "role" | "individual"
      completion_status: "pending_sign_off" | "signed_off" | "rejected"
      sop_status: "uploading" | "parsing" | "draft" | "published"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["worker", "supervisor", "admin", "safety_manager"],
      completion_status: ["pending_sign_off", "signed_off", "rejected"],
      sop_status: ["uploading", "parsing", "draft", "published"],
    },
  },
} as const


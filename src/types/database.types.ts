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
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string
          file_type: string
          id: string
          organisation_id: string
          retry_count: number
          sop_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path: string
          file_type: string
          id?: string
          organisation_id: string
          retry_count?: number
          sop_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string
          file_type?: string
          id?: string
          organisation_id?: string
          retry_count?: number
          sop_id?: string
          started_at?: string | null
          status?: string
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
      sop_sections: {
        Row: {
          approved: boolean
          confidence: number | null
          content: string | null
          created_at: string
          id: string
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
      sops: {
        Row: {
          applicable_equipment: string[] | null
          author: string | null
          category: string | null
          created_at: string
          department: string | null
          id: string
          is_ocr: boolean
          organisation_id: string
          overall_confidence: number | null
          parent_sop_id: string | null
          parse_notes: string | null
          published_at: string | null
          related_sops: string[] | null
          required_certifications: string[] | null
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
          author?: string | null
          category?: string | null
          created_at?: string
          department?: string | null
          id?: string
          is_ocr?: boolean
          organisation_id: string
          overall_confidence?: number | null
          parent_sop_id?: string | null
          parse_notes?: string | null
          published_at?: string | null
          related_sops?: string[] | null
          required_certifications?: string[] | null
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
          author?: string | null
          category?: string | null
          created_at?: string
          department?: string | null
          id?: string
          is_ocr?: boolean
          organisation_id?: string
          overall_confidence?: number | null
          parent_sop_id?: string | null
          parse_notes?: string | null
          published_at?: string | null
          related_sops?: string[] | null
          required_certifications?: string[] | null
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


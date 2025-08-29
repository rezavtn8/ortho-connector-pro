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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      monthly_patients: {
        Row: {
          created_at: string | null
          id: string
          last_modified_by: string | null
          patient_count: number
          source_id: string | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_modified_by?: string | null
          patient_count?: number
          source_id?: string | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_modified_by?: string | null
          patient_count?: number
          source_id?: string | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_patients_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_changes_log: {
        Row: {
          change_type: string | null
          changed_at: string | null
          changed_by: string | null
          id: string
          new_count: number | null
          old_count: number | null
          reason: string | null
          source_id: string | null
          year_month: string
        }
        Insert: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_count?: number | null
          old_count?: number | null
          reason?: string | null
          source_id?: string | null
          year_month: string
        }
        Update: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_count?: number | null
          old_count?: number | null
          reason?: string | null
          source_id?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_changes_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_sources: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          office_hours: string | null
          phone: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          office_hours?: string | null
          phone?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          office_hours?: string | null
          phone?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      source_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          source_id: string | null
          tag_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          source_id?: string | null
          tag_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          source_id?: string | null
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_tags_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          clinic_address: string | null
          clinic_latitude: number | null
          clinic_longitude: number | null
          clinic_name: string | null
          created_at: string
          email: string
          id: string
          pin_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clinic_address?: string | null
          clinic_latitude?: number | null
          clinic_longitude?: number | null
          clinic_name?: string | null
          created_at?: string
          email: string
          id?: string
          pin_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clinic_address?: string | null
          clinic_latitude?: number | null
          clinic_longitude?: number | null
          clinic_name?: string | null
          created_at?: string
          email?: string
          id?: string
          pin_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_office_referral: {
        Args: {
          office_id_param: string
          referral_count_param?: number
          referral_date?: string
        }
        Returns: undefined
      }
      add_patient_with_period: {
        Args: {
          p_increment?: number
          p_office_id: string
          p_period_type: string
        }
        Returns: Json
      }
      adjust_patient_count: {
        Args: { p_delta: number; p_source_id: string; p_year_month: string }
        Returns: number
      }
      calculate_office_score: {
        Args: { office_id_param: string }
        Returns: string
      }
      calculate_source_score: {
        Args: { source_id_param: string }
        Returns: string
      }
      get_current_month_patients: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_month_patients: number
          is_office: boolean
          month_year: string
          source_id: string
          source_name: string
          source_type: string
        }[]
      }
      get_current_month_sources: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_month_patients: number
          month_year: string
          source_id: string
          source_name: string
          source_type: string
        }[]
      }
      get_office_metrics: {
        Args: {
          end_date?: string
          office_id_param: string
          start_date?: string
        }
        Returns: {
          metric_date: string
          patient_count: number
          referral_count: number
        }[]
      }
      get_office_period_stats: {
        Args: { p_office_id: string; p_period_type: string }
        Returns: Json
      }
      get_patient_load_trend: {
        Args: { days_back?: number; office_id_param: string }
        Returns: {
          current_count: number
          last_updated: string
          previous_count: number
          trend_direction: string
        }[]
      }
      set_patient_count: {
        Args: {
          p_count: number
          p_reason?: string
          p_source_id: string
          p_year_month: string
        }
        Returns: number
      }
      update_patient_count: {
        Args: { p_count: number; p_source_id: string }
        Returns: Json
      }
      update_source_patient_count: {
        Args: { p_new_count: number; p_source_id: string }
        Returns: Json
      }
    }
    Enums: {
      source_type:
        | "Office"
        | "Google"
        | "Yelp"
        | "Website"
        | "Word of Mouth"
        | "Insurance"
        | "Social Media"
        | "Other"
      user_role: "Owner" | "Front Desk" | "Marketing Rep"
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
      source_type: [
        "Office",
        "Google",
        "Yelp",
        "Website",
        "Word of Mouth",
        "Insurance",
        "Social Media",
        "Other",
      ],
      user_role: ["Owner", "Front Desk", "Marketing Rep"],
    },
  },
} as const

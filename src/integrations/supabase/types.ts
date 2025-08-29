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
<<<<<<< HEAD
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
=======
          interaction_date: string
          interaction_type: string
          notes: string | null
          source_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          interaction_type: string
          notes?: string | null
          source_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          notes?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_current_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_incentives: {
        Row: {
          actual_sent_date: string | null
          assigned_staff: string | null
          cost_amount: number | null
          created_at: string
          created_by: string | null
          delivery_method: string | null
          description: string | null
          id: string
          incentive_type: string
          notes: string | null
          personalized_message: string | null
          scheduled_date: string | null
          source_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_sent_date?: string | null
          assigned_staff?: string | null
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string | null
          description?: string | null
          id?: string
          incentive_type: string
          notes?: string | null
          personalized_message?: string | null
          scheduled_date?: string | null
          source_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_sent_date?: string | null
          assigned_staff?: string | null
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string | null
          description?: string | null
          id?: string
          incentive_type?: string
          notes?: string | null
          personalized_message?: string | null
          scheduled_date?: string | null
          source_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_incentives_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_incentives_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_current_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_visits: {
        Row: {
          approach_used: string[] | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          rating: number | null
          source_id: string
          updated_at: string
          visit_date: string
          visit_group: string | null
          visit_time: string | null
          visited: boolean | null
          visited_by: string | null
        }
        Insert: {
          approach_used?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          source_id: string
          updated_at?: string
          visit_date?: string
          visit_group?: string | null
          visit_time?: string | null
          visited?: boolean | null
          visited_by?: string | null
        }
        Update: {
          approach_used?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          source_id?: string
          updated_at?: string
          visit_date?: string
          visit_group?: string | null
          visit_time?: string | null
          visited?: boolean | null
          visited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_visits_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_visits_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_current_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_patient_data: {
        Row: {
          created_at: string
          id: string
          month_year: string
          patient_count: number
          source_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_year: string
          patient_count?: number
          source_id: string
          updated_at?: string
>>>>>>> f210630 (WIP before rebase)
        }
        Update: {
          created_at?: string | null
          id?: string
<<<<<<< HEAD
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
=======
          month_year?: string
          patient_count?: number
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_patient_data_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_patient_data_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_current_stats"
>>>>>>> f210630 (WIP before rebase)
            referencedColumns: ["id"]
          },
        ]
      }
<<<<<<< HEAD
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
=======
      office_tags: {
        Row: {
          created_at: string
          id: string
          source_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          source_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_tags_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_tags_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_current_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_sources: {
        Row: {
          address: string | null
          created_at: string
          distance_from_clinic: number | null
          email: string | null
          google_rating: number | null
          id: string
          is_office: boolean | null
>>>>>>> f210630 (WIP before rebase)
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          office_hours: string | null
          phone: string | null
<<<<<<< HEAD
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at: string | null
=======
          source: string | null
          source_type: string | null
          updated_at: string
>>>>>>> f210630 (WIP before rebase)
          website: string | null
        }
        Insert: {
          address?: string | null
<<<<<<< HEAD
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
=======
          created_at?: string
          distance_from_clinic?: number | null
>>>>>>> f210630 (WIP before rebase)
          email?: string | null
          id?: string
<<<<<<< HEAD
          is_active?: boolean | null
=======
          is_office?: boolean | null
>>>>>>> f210630 (WIP before rebase)
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          office_hours?: string | null
          phone?: string | null
<<<<<<< HEAD
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
=======
          source?: string | null
          source_type?: string | null
          updated_at?: string
>>>>>>> f210630 (WIP before rebase)
          website?: string | null
        }
        Update: {
          address?: string | null
<<<<<<< HEAD
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
=======
          created_at?: string
          distance_from_clinic?: number | null
>>>>>>> f210630 (WIP before rebase)
          email?: string | null
          id?: string
<<<<<<< HEAD
          is_active?: boolean | null
=======
          is_office?: boolean | null
>>>>>>> f210630 (WIP before rebase)
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          office_hours?: string | null
          phone?: string | null
<<<<<<< HEAD
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
=======
          source?: string | null
          source_type?: string | null
          updated_at?: string
>>>>>>> f210630 (WIP before rebase)
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
      source_current_stats: {
        Row: {
          current_month_patients: number | null
          id: string | null
          is_office: boolean | null
          last_3_months_patients: number | null
          last_patient_date: string | null
          name: string | null
          source_type: string | null
          total_patients: number | null
        }
        Insert: {
          current_month_patients?: never
          id?: string | null
          is_office?: boolean | null
          last_3_months_patients?: never
          last_patient_date?: never
          name?: string | null
          source_type?: string | null
          total_patients?: never
        }
        Update: {
          current_month_patients?: never
          id?: string | null
          is_office?: boolean | null
          last_3_months_patients?: never
          last_patient_date?: never
          name?: string | null
          source_type?: string | null
          total_patients?: never
        }
        Relationships: []
      }
    }
    Functions: {
      add_office_referral: {
        Args: {
          office_id_param: string
<<<<<<< HEAD
          referral_count_param?: number
=======
          patient_count_param?: number
>>>>>>> f210630 (WIP before rebase)
          referral_date?: string
        }
        Returns: undefined
      }
      add_patient_with_period: {
        Args: {
          p_increment?: number
<<<<<<< HEAD
          p_office_id: string
=======
          p_source_id: string
>>>>>>> f210630 (WIP before rebase)
          p_period_type: string
        }
        Returns: Json
      }
      adjust_patient_count: {
<<<<<<< HEAD
        Args: { p_delta: number; p_source_id: string; p_year_month: string }
        Returns: number
=======
        Args: { p_adjustment: number; p_source_id: string }
        Returns: Json
>>>>>>> f210630 (WIP before rebase)
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
      get_office_metrics: {
        Args: {
          end_date?: string
          office_id_param: string
          start_date?: string
        }
        Returns: {
          metric_date: string
          patient_count: number
<<<<<<< HEAD
          referral_count: number
        }[]
      }
      get_office_period_stats: {
        Args: { p_office_id: string; p_period_type: string }
=======
          patient_count: number
        }[]
      }
      get_office_period_stats: {
        Args: { p_source_id: string; p_period_type: string }
>>>>>>> f210630 (WIP before rebase)
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
<<<<<<< HEAD
      set_patient_count: {
        Args: {
          p_count: number
          p_reason?: string
          p_source_id: string
          p_year_month: string
        }
        Returns: number
      }
=======
>>>>>>> f210630 (WIP before rebase)
      update_patient_count: {
        Args: { p_count: number; p_source_id: string }
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

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
      campaign_deliveries: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_notes: string | null
          delivery_status: string
          id: string
          office_id: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string
          id?: string
          office_id: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string
          id?: string
          office_id?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          assigned_rep_id: string | null
          campaign_type: string
          clinic_id: string | null
          created_at: string
          created_by: string
          delivery_method: string
          id: string
          materials_checklist: string[] | null
          name: string
          notes: string | null
          planned_delivery_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_rep_id?: string | null
          campaign_type: string
          clinic_id?: string | null
          created_at?: string
          created_by: string
          delivery_method: string
          id?: string
          materials_checklist?: string[] | null
          name: string
          notes?: string | null
          planned_delivery_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_rep_id?: string | null
          campaign_type?: string
          clinic_id?: string | null
          created_at?: string
          created_by?: string
          delivery_method?: string
          id?: string
          materials_checklist?: string[] | null
          name?: string
          notes?: string | null
          planned_delivery_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          google_place_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      discovered_offices: {
        Row: {
          address: string | null
          clinic_id: string | null
          created_at: string
          discovered_by: string
          discovery_session_id: string | null
          fetched_at: string
          id: string
          imported: boolean
          lat: number | null
          lng: number | null
          name: string
          office_type: string | null
          phone: string | null
          place_id: string
          rating: number | null
          search_distance: number | null
          search_location_lat: number | null
          search_location_lng: number | null
          source: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          clinic_id?: string | null
          created_at?: string
          discovered_by: string
          discovery_session_id?: string | null
          fetched_at?: string
          id?: string
          imported?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          office_type?: string | null
          phone?: string | null
          place_id: string
          rating?: number | null
          search_distance?: number | null
          search_location_lat?: number | null
          search_location_lng?: number | null
          source?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          clinic_id?: string | null
          created_at?: string
          discovered_by?: string
          discovery_session_id?: string | null
          fetched_at?: string
          id?: string
          imported?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          office_type?: string | null
          phone?: string | null
          place_id?: string
          rating?: number | null
          search_distance?: number | null
          search_location_lat?: number | null
          search_location_lng?: number | null
          source?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_discovered_offices_discovery_session_id"
            columns: ["discovery_session_id"]
            isOneToOne: false
            referencedRelation: "discovery_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sessions: {
        Row: {
          api_call_made: boolean | null
          clinic_id: string | null
          created_at: string
          id: string
          office_type_filter: string | null
          results_count: number | null
          search_distance: number
          search_lat: number
          search_lng: number
          updated_at: string
          user_id: string
          zip_code_override: string | null
        }
        Insert: {
          api_call_made?: boolean | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          office_type_filter?: string | null
          results_count?: number | null
          search_distance: number
          search_lat: number
          search_lng: number
          updated_at?: string
          user_id: string
          zip_code_override?: string | null
        }
        Update: {
          api_call_made?: boolean | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          office_type_filter?: string | null
          results_count?: number | null
          search_distance?: number
          search_lat?: number
          search_lng?: number
          updated_at?: string
          user_id?: string
          zip_code_override?: string | null
        }
        Relationships: []
      }
      marketing_visits: {
        Row: {
          clinic_id: string | null
          contact_person: string | null
          created_at: string
          follow_up_notes: string | null
          group_tag: string | null
          id: string
          materials_handed_out: string[] | null
          office_id: string
          photo_url: string | null
          rep_name: string
          star_rating: number | null
          updated_at: string
          user_id: string
          visit_date: string
          visit_type: string
          visited: boolean
        }
        Insert: {
          clinic_id?: string | null
          contact_person?: string | null
          created_at?: string
          follow_up_notes?: string | null
          group_tag?: string | null
          id?: string
          materials_handed_out?: string[] | null
          office_id: string
          photo_url?: string | null
          rep_name: string
          star_rating?: number | null
          updated_at?: string
          user_id: string
          visit_date: string
          visit_type: string
          visited?: boolean
        }
        Update: {
          clinic_id?: string | null
          contact_person?: string | null
          created_at?: string
          follow_up_notes?: string | null
          group_tag?: string | null
          id?: string
          materials_handed_out?: string[] | null
          office_id?: string
          photo_url?: string | null
          rep_name?: string
          star_rating?: number | null
          updated_at?: string
          user_id?: string
          visit_date?: string
          visit_type?: string
          visited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_marketing_visits_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketing_visits_office"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_patients: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          last_modified_by: string | null
          patient_count: number
          source_id: string | null
          updated_at: string | null
          user_id: string
          year_month: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          last_modified_by?: string | null
          patient_count?: number
          source_id?: string | null
          updated_at?: string | null
          user_id: string
          year_month: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          last_modified_by?: string | null
          patient_count?: number
          source_id?: string | null
          updated_at?: string | null
          user_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_monthly_patients_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
          clinic_id: string | null
          id: string
          new_count: number | null
          old_count: number | null
          reason: string | null
          source_id: string | null
          user_id: string
          year_month: string
        }
        Insert: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          clinic_id?: string | null
          id?: string
          new_count?: number | null
          old_count?: number | null
          reason?: string | null
          source_id?: string | null
          user_id: string
          year_month: string
        }
        Update: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          clinic_id?: string | null
          id?: string
          new_count?: number | null
          old_count?: number | null
          reason?: string | null
          source_id?: string | null
          user_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_changes_log_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
          clinic_id: string | null
          created_at: string | null
          created_by: string
          distance_miles: number | null
          email: string | null
          google_place_id: string | null
          google_rating: number | null
          id: string
          is_active: boolean | null
          last_updated_from_google: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          opening_hours: string | null
          phone: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at: string | null
          website: string | null
          yelp_rating: number | null
        }
        Insert: {
          address?: string | null
          clinic_id?: string | null
          created_at?: string | null
          created_by: string
          distance_miles?: number | null
          email?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          id?: string
          is_active?: boolean | null
          last_updated_from_google?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          opening_hours?: string | null
          phone?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
          website?: string | null
          yelp_rating?: number | null
        }
        Update: {
          address?: string | null
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string
          distance_miles?: number | null
          email?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          id?: string
          is_active?: boolean | null
          last_updated_from_google?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          opening_hours?: string | null
          phone?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
          website?: string | null
          yelp_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_sources_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      review_status: {
        Row: {
          clinic_id: string | null
          created_at: string
          google_review_id: string
          id: string
          needs_attention: boolean
          notes: string | null
          place_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          google_review_id: string
          id?: string
          needs_attention?: boolean
          notes?: string | null
          place_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          google_review_id?: string
          id?: string
          needs_attention?: boolean
          notes?: string | null
          place_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      source_tags: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          source_id: string | null
          tag_name: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          source_id?: string | null
          tag_name: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          source_id?: string | null
          tag_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_source_tags_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_tags_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "patient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          token: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          clinic_address: string | null
          clinic_id: string | null
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
          clinic_id?: string | null
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
          clinic_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_clinic"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string }
        Returns: Json
      }
      adjust_patient_count: {
        Args: { p_delta: number; p_source_id: string; p_year_month: string }
        Returns: number
      }
      calculate_source_score: {
        Args: { source_id_param: string }
        Returns: string
      }
      create_clinic_for_user: {
        Args: {
          p_address?: string
          p_latitude?: number
          p_longitude?: number
          p_name: string
        }
        Returns: Json
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
      get_user_clinic_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      user_has_clinic_admin_access: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validate_auth_context: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      source_type:
        | "Google"
        | "Yelp"
        | "Website"
        | "Word of Mouth"
        | "Insurance"
        | "Social Media"
        | "Other"
        | "Office"
      user_role: "Owner" | "Front Desk" | "Marketing Rep" | "Manager"
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
        "Google",
        "Yelp",
        "Website",
        "Word of Mouth",
        "Insurance",
        "Social Media",
        "Other",
        "Office",
      ],
      user_role: ["Owner", "Front Desk", "Marketing Rep", "Manager"],
    },
  },
} as const

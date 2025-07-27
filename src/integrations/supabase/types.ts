export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      engagement_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interaction_date: string
          interaction_type: string
          notes: string | null
          office_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          interaction_type: string
          notes?: string | null
          office_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          notes?: string | null
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "referring_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_tags: {
        Row: {
          created_at: string
          id: string
          office_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          office_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          office_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_tags_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "referring_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_data: {
        Row: {
          created_at: string
          id: string
          month_year: string
          office_id: string
          referral_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_year: string
          office_id: string
          referral_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month_year?: string
          office_id?: string
          referral_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_data_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "referring_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      referring_offices: {
        Row: {
          address: string
          created_at: string
          distance_from_clinic: number | null
          email: string | null
          google_rating: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          office_hours: string | null
          phone: string | null
          source: string | null
          updated_at: string
          website: string | null
          yelp_rating: number | null
        }
        Insert: {
          address: string
          created_at?: string
          distance_from_clinic?: number | null
          email?: string | null
          google_rating?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          office_hours?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
          yelp_rating?: number | null
        }
        Update: {
          address?: string
          created_at?: string
          distance_from_clinic?: number | null
          email?: string | null
          google_rating?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          office_hours?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
          yelp_rating?: number | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          pin_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          pin_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
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
      calculate_office_score: {
        Args: { office_id_param: string }
        Returns: string
      }
    }
    Enums: {
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
      user_role: ["Owner", "Front Desk", "Marketing Rep"],
    },
  },
} as const

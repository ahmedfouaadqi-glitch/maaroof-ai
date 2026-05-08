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
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_addons: {
        Row: {
          active: boolean
          created_at: string
          daily_task_cap: number
          description: string | null
          features: Json
          id: string
          max_targets: number
          monthly_tasks: number
          name: string
          price_iqd: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_task_cap?: number
          description?: string | null
          features?: Json
          id?: string
          max_targets?: number
          monthly_tasks?: number
          name: string
          price_iqd?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_task_cap?: number
          description?: string | null
          features?: Json
          id?: string
          max_targets?: number
          monthly_tasks?: number
          name?: string
          price_iqd?: number
          sort_order?: number
        }
        Relationships: []
      }
      agent_targets: {
        Row: {
          active: boolean
          created_at: string
          id: string
          notes: string | null
          topic: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          topic?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          topic?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_tasks: {
        Row: {
          created_at: string
          error: string | null
          id: string
          input: string | null
          result: Json | null
          status: string
          target_id: string | null
          task_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          input?: string | null
          result?: Json | null
          status?: string
          target_id?: string | null
          task_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          input?: string | null
          result?: Json | null
          status?: string
          target_id?: string | null
          task_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "agent_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          authority: number | null
          cached: boolean
          citation: number | null
          created_at: string
          id: string
          input_hash: string
          input_text: string
          lang: string
          local_relevance: number | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          authority?: number | null
          cached?: boolean
          citation?: number | null
          created_at?: string
          id?: string
          input_hash: string
          input_text: string
          lang?: string
          local_relevance?: number | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          authority?: number | null
          cached?: boolean
          citation?: number | null
          created_at?: string
          id?: string
          input_hash?: string
          input_text?: string
          lang?: string
          local_relevance?: number | null
          score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      analysis_cache: {
        Row: {
          created_at: string
          hits: number
          input_hash: string
          lang: string
          result: Json
        }
        Insert: {
          created_at?: string
          hits?: number
          input_hash: string
          lang: string
          result: Json
        }
        Update: {
          created_at?: string
          hits?: number
          input_hash?: string
          lang?: string
          result?: Json
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_subscribed: boolean
          monthly_analyses_used: number
          monthly_suggestions_used: number
          subscription_expires_at: string | null
          subscription_tier: string | null
          usage_period_start: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_subscribed?: boolean
          monthly_analyses_used?: number
          monthly_suggestions_used?: number
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          usage_period_start?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_subscribed?: boolean
          monthly_analyses_used?: number
          monthly_suggestions_used?: number
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          usage_period_start?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          monthly_analyses: number
          monthly_suggestions: number
          name: string
          price_iqd: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          monthly_analyses?: number
          monthly_suggestions?: number
          name: string
          price_iqd?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          monthly_analyses?: number
          monthly_suggestions?: number
          name?: string
          price_iqd?: number
          sort_order?: number
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          agent_addon_id: string | null
          created_at: string
          id: string
          notes: string | null
          plan_id: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          whatsapp_contacted_at: string | null
        }
        Insert: {
          agent_addon_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          whatsapp_contacted_at?: string | null
        }
        Update: {
          agent_addon_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          whatsapp_contacted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_agent_addon_id_fkey"
            columns: ["agent_addon_id"]
            isOneToOne: false
            referencedRelation: "agent_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string
          id: string
          input: string | null
          lang: string
          mode: string
          output: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          input?: string | null
          lang?: string
          mode: string
          output: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          input?: string | null
          lang?: string
          mode?: string
          output?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_agent_subscriptions: {
        Row: {
          addon_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_run_date: string | null
          period_start: string
          status: string
          tasks_used: number
          tasks_used_today: number
          user_id: string
        }
        Insert: {
          addon_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_run_date?: string | null
          period_start?: string
          status?: string
          tasks_used?: number
          tasks_used_today?: number
          user_id: string
        }
        Update: {
          addon_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_run_date?: string | null
          period_start?: string
          status?: string
          tasks_used?: number
          tasks_used_today?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agent_subscriptions_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "agent_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

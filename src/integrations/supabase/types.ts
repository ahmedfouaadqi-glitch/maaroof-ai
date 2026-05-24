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
      brand_authority_packs: {
        Row: {
          brand_keywords: string | null
          brand_name: string
          brand_slug: string
          created_at: string
          html: string
          id: string
          json_ld: Json
          markdown: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_keywords?: string | null
          brand_name: string
          brand_slug: string
          created_at?: string
          html?: string
          id?: string
          json_ld?: Json
          markdown?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_keywords?: string | null
          brand_name?: string
          brand_slug?: string
          created_at?: string
          html?: string
          id?: string
          json_ld?: Json
          markdown?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_boost_jobs: {
        Row: {
          active: boolean
          approved: boolean
          brand_keywords: string | null
          brand_name: string
          config: Json
          created_at: string
          frequency: string
          id: string
          last_run_at: string | null
          next_run_at: string | null
          platforms: string[]
          user_id: string
        }
        Insert: {
          active?: boolean
          approved?: boolean
          brand_keywords?: string | null
          brand_name: string
          config?: Json
          created_at?: string
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          platforms?: string[]
          user_id: string
        }
        Update: {
          active?: boolean
          approved?: boolean
          brand_keywords?: string | null
          brand_name?: string
          config?: Json
          created_at?: string
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          platforms?: string[]
          user_id?: string
        }
        Relationships: []
      }
      brand_boost_runs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          report: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          report?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          report?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_boost_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "brand_boost_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawler_hits: {
        Row: {
          bot_name: string | null
          brand_slug: string
          hit_at: string
          id: string
          ip_hash: string | null
          path: string | null
          user_agent: string
          user_id: string | null
        }
        Insert: {
          bot_name?: string | null
          brand_slug: string
          hit_at?: string
          id?: string
          ip_hash?: string | null
          path?: string | null
          user_agent: string
          user_id?: string | null
        }
        Update: {
          bot_name?: string | null
          brand_slug?: string
          hit_at?: string
          id?: string
          ip_hash?: string | null
          path?: string | null
          user_agent?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          brand_keywords: string | null
          brand_name: string | null
          created_at: string
          daily_analyses_used: number
          daily_suggestions_used: number
          device_fingerprint: string | null
          device_fingerprints: Json
          device_locked_at: string | null
          email: string | null
          extra_device_fee_iqd: number
          full_name: string | null
          geo_scope: Json
          id: string
          is_subscribed: boolean
          max_devices: number
          monthly_analyses_used: number
          monthly_suggestions_used: number
          quota_overrides: Json
          specialty: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          tool_geo_scopes: Json
          usage_day_start: string
          usage_period_start: string
          username: string | null
        }
        Insert: {
          brand_keywords?: string | null
          brand_name?: string | null
          created_at?: string
          daily_analyses_used?: number
          daily_suggestions_used?: number
          device_fingerprint?: string | null
          device_fingerprints?: Json
          device_locked_at?: string | null
          email?: string | null
          extra_device_fee_iqd?: number
          full_name?: string | null
          geo_scope?: Json
          id: string
          is_subscribed?: boolean
          max_devices?: number
          monthly_analyses_used?: number
          monthly_suggestions_used?: number
          quota_overrides?: Json
          specialty?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tool_geo_scopes?: Json
          usage_day_start?: string
          usage_period_start?: string
          username?: string | null
        }
        Update: {
          brand_keywords?: string | null
          brand_name?: string | null
          created_at?: string
          daily_analyses_used?: number
          daily_suggestions_used?: number
          device_fingerprint?: string | null
          device_fingerprints?: Json
          device_locked_at?: string | null
          email?: string | null
          extra_device_fee_iqd?: number
          full_name?: string | null
          geo_scope?: Json
          id?: string
          is_subscribed?: boolean
          max_devices?: number
          monthly_analyses_used?: number
          monthly_suggestions_used?: number
          quota_overrides?: Json
          specialty?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tool_geo_scopes?: Json
          usage_day_start?: string
          usage_period_start?: string
          username?: string | null
        }
        Relationships: []
      }
      publish_channels: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          kind: string
          label: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      publish_log: {
        Row: {
          channel_id: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          status: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          status: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          status?: string
          task_id?: string | null
          user_id?: string
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
      tool_links: {
        Row: {
          created_at: string
          id: string
          source_tool: string
          target_tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_tool: string
          target_tool: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_tool?: string
          target_tool?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_plan_access: {
        Row: {
          created_at: string
          daily_quota: number | null
          enabled: boolean
          id: string
          monthly_quota: number | null
          notes: string | null
          plan_id: string
          tool_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_quota?: number | null
          enabled?: boolean
          id?: string
          monthly_quota?: number | null
          notes?: string | null
          plan_id: string
          tool_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_quota?: number | null
          enabled?: boolean
          id?: string
          monthly_quota?: number | null
          notes?: string | null
          plan_id?: string
          tool_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_plan_access_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
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
      generate_username_from_email: {
        Args: { _email: string }
        Returns: string
      }
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

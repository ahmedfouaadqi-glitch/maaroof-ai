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
          default_currency: string
          description: string | null
          features: Json
          id: string
          max_targets: number
          monthly_tasks: number
          name: string
          price_iqd: number
          prices: Json
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_task_cap?: number
          default_currency?: string
          description?: string | null
          features?: Json
          id?: string
          max_targets?: number
          monthly_tasks?: number
          name: string
          price_iqd?: number
          prices?: Json
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_task_cap?: number
          default_currency?: string
          description?: string | null
          features?: Json
          id?: string
          max_targets?: number
          monthly_tasks?: number
          name?: string
          price_iqd?: number
          prices?: Json
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
          agent_id: string | null
          approval_channel_id: string | null
          approval_status: string | null
          approved_at: string | null
          confidence: Json | null
          created_at: string
          error: string | null
          id: string
          input: string | null
          lifecycle_state: string | null
          parent_agent_id: string | null
          result: Json | null
          run_id: string | null
          run_started_at: string | null
          status: string
          target_id: string | null
          task_type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          approval_channel_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          confidence?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          input?: string | null
          lifecycle_state?: string | null
          parent_agent_id?: string | null
          result?: Json | null
          run_id?: string | null
          run_started_at?: string | null
          status?: string
          target_id?: string | null
          task_type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          approval_channel_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          confidence?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          input?: string | null
          lifecycle_state?: string | null
          parent_agent_id?: string | null
          result?: Json | null
          run_id?: string | null
          run_started_at?: string | null
          status?: string
          target_id?: string | null
          task_type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "maaroof_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_approval_channel_id_fkey"
            columns: ["approval_channel_id"]
            isOneToOne: false
            referencedRelation: "publish_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "maaroof_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "agent_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_benchmarks: {
        Row: {
          accuracy: number | null
          batch_id: string
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          latency_ms: number | null
          model_key: string
          output_sample: string | null
          reasoning_score: number | null
          task: string
          tokens: number
          usd: number
        }
        Insert: {
          accuracy?: number | null
          batch_id?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          latency_ms?: number | null
          model_key: string
          output_sample?: string | null
          reasoning_score?: number | null
          task: string
          tokens?: number
          usd?: number
        }
        Update: {
          accuracy?: number | null
          batch_id?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          latency_ms?: number | null
          model_key?: string
          output_sample?: string | null
          reasoning_score?: number | null
          task?: string
          tokens?: number
          usd?: number
        }
        Relationships: []
      }
      ai_model_health: {
        Row: {
          calls: number
          failures: number
          last_call_at: string | null
          last_error: string | null
          last_status: string | null
          model_key: string
          total_latency_ms: number
          total_tokens: number
          total_usd: number
          updated_at: string
        }
        Insert: {
          calls?: number
          failures?: number
          last_call_at?: string | null
          last_error?: string | null
          last_status?: string | null
          model_key: string
          total_latency_ms?: number
          total_tokens?: number
          total_usd?: number
          updated_at?: string
        }
        Update: {
          calls?: number
          failures?: number
          last_call_at?: string | null
          last_error?: string | null
          last_status?: string | null
          model_key?: string
          total_latency_ms?: number
          total_tokens?: number
          total_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_model_proposals: {
        Row: {
          cons: Json
          created_at: string
          current_cost_usd: number | null
          expected_cost_usd: number | null
          expected_gain_pct: number | null
          id: string
          impact: Json
          kind: string
          migration_plan: string | null
          model_key: string
          pros: Json
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          risks: Json
          rollback_plan: string | null
          status: string
          test_plan: string | null
        }
        Insert: {
          cons?: Json
          created_at?: string
          current_cost_usd?: number | null
          expected_cost_usd?: number | null
          expected_gain_pct?: number | null
          id?: string
          impact?: Json
          kind?: string
          migration_plan?: string | null
          model_key: string
          pros?: Json
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risks?: Json
          rollback_plan?: string | null
          status?: string
          test_plan?: string | null
        }
        Update: {
          cons?: Json
          created_at?: string
          current_cost_usd?: number | null
          expected_cost_usd?: number | null
          expected_gain_pct?: number | null
          id?: string
          impact?: Json
          kind?: string
          migration_plan?: string | null
          model_key?: string
          pros?: Json
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risks?: Json
          rollback_plan?: string | null
          status?: string
          test_plan?: string | null
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          capabilities: Json
          cost_in_usd_per_mtok: number
          cost_out_usd_per_mtok: number
          created_at: string
          id: string
          languages: Json
          last_evaluated_at: string | null
          latency_ms: number | null
          limitations: Json
          model_key: string
          notes: string | null
          provider: string
          recommended_use_cases: Json
          released_at: string | null
          reliability: number
          speed: number
          status: string
          strengths: Json
          supported_mcp: Json
          supported_tools: Json
          updated_at: string
          version: string | null
          weaknesses: Json
        }
        Insert: {
          capabilities?: Json
          cost_in_usd_per_mtok?: number
          cost_out_usd_per_mtok?: number
          created_at?: string
          id?: string
          languages?: Json
          last_evaluated_at?: string | null
          latency_ms?: number | null
          limitations?: Json
          model_key: string
          notes?: string | null
          provider: string
          recommended_use_cases?: Json
          released_at?: string | null
          reliability?: number
          speed?: number
          status?: string
          strengths?: Json
          supported_mcp?: Json
          supported_tools?: Json
          updated_at?: string
          version?: string | null
          weaknesses?: Json
        }
        Update: {
          capabilities?: Json
          cost_in_usd_per_mtok?: number
          cost_out_usd_per_mtok?: number
          created_at?: string
          id?: string
          languages?: Json
          last_evaluated_at?: string | null
          latency_ms?: number | null
          limitations?: Json
          model_key?: string
          notes?: string | null
          provider?: string
          recommended_use_cases?: Json
          released_at?: string | null
          reliability?: number
          speed?: number
          status?: string
          strengths?: Json
          supported_mcp?: Json
          supported_tools?: Json
          updated_at?: string
          version?: string | null
          weaknesses?: Json
        }
        Relationships: []
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
      competitor_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          payload: Json | null
          read_at: string | null
          severity: string
          target: string | null
          user_id: string
          watch_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          payload?: Json | null
          read_at?: string | null
          severity?: string
          target?: string | null
          user_id: string
          watch_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          payload?: Json | null
          read_at?: string | null
          severity?: string
          target?: string | null
          user_id?: string
          watch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_alerts_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "competitor_watch"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_watch: {
        Row: {
          active: boolean
          alerts: Json
          baseline: Json | null
          brand: string
          competitors: Json
          created_at: string
          frequency_hours: number
          id: string
          last_run_at: string | null
          scope: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          alerts?: Json
          baseline?: Json | null
          brand: string
          competitors?: Json
          created_at?: string
          frequency_hours?: number
          id?: string
          last_run_at?: string | null
          scope?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          alerts?: Json
          baseline?: Json | null
          brand?: string
          competitors?: Json
          created_at?: string
          frequency_hours?: number
          id?: string
          last_run_at?: string | null
          scope?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      country_currency: {
        Row: {
          country_code: string
          currency: string
          updated_at: string
        }
        Insert: {
          country_code: string
          currency: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          currency?: string
          updated_at?: string
        }
        Relationships: []
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
      custom_pages: {
        Row: {
          body_ar: string | null
          body_en: string | null
          body_ku: string | null
          created_at: string
          created_by: string | null
          id: string
          meta_description_ar: string | null
          meta_description_en: string | null
          meta_description_ku: string | null
          published: boolean
          slug: string
          title_ar: string | null
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          body_ku?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_description_ku?: string | null
          published?: boolean
          slug: string
          title_ar?: string | null
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          body_ku?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description_ar?: string | null
          meta_description_en?: string | null
          meta_description_ku?: string | null
          published?: boolean
          slug?: string
          title_ar?: string | null
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decision_traces: {
        Row: {
          alternatives: Json
          capabilities: Json
          confidence: number | null
          cost_usd: number
          created_at: string
          duration_ms: number | null
          experts: Json
          id: string
          mcp: Json
          models: Json
          payload: Json
          risk: number | null
          run_id: string | null
          score: number | null
          seq: number
          stage: string
          summary: string | null
          tools: Json
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          alternatives?: Json
          capabilities?: Json
          confidence?: number | null
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          experts?: Json
          id?: string
          mcp?: Json
          models?: Json
          payload?: Json
          risk?: number | null
          run_id?: string | null
          score?: number | null
          seq?: number
          stage: string
          summary?: string | null
          tools?: Json
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          alternatives?: Json
          capabilities?: Json
          confidence?: number | null
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          experts?: Json
          id?: string
          mcp?: Json
          models?: Json
          payload?: Json
          risk?: number | null
          run_id?: string | null
          score?: number | null
          seq?: number
          stage?: string
          summary?: string | null
          tools?: Json
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      expert_learning_sessions: {
        Row: {
          budget_source: string
          confidence: number | null
          created_at: string
          created_by: string | null
          diff: Json | null
          duration_ms: number | null
          error: string | null
          expert_key: string
          extracted: Json
          id: string
          input_tokens: number
          model: string | null
          output_tokens: number
          status: string
          tokens: number
          transcript: Json
          trigger: string
          understanding_score: number | null
          usd: number
          version: number
          zero_cost_reason: string | null
        }
        Insert: {
          budget_source?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          diff?: Json | null
          duration_ms?: number | null
          error?: string | null
          expert_key: string
          extracted?: Json
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          status?: string
          tokens?: number
          transcript?: Json
          trigger?: string
          understanding_score?: number | null
          usd?: number
          version?: number
          zero_cost_reason?: string | null
        }
        Update: {
          budget_source?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          diff?: Json | null
          duration_ms?: number | null
          error?: string | null
          expert_key?: string
          extracted?: Json
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          status?: string
          tokens?: number
          transcript?: Json
          trigger?: string
          understanding_score?: number | null
          usd?: number
          version?: number
          zero_cost_reason?: string | null
        }
        Relationships: []
      }
      expert_profiles: {
        Row: {
          capability_graph: Json
          confidence: number
          cooperation: Json
          coverage: Json
          created_at: string
          decision_style: string | null
          dna: Json
          expert_key: string
          failure_indicators: Json
          fingerprint: string | null
          improvement_suggestions: Json
          knowledge_graph: Json
          last_learned_at: string | null
          limitations: Json
          policies: Json
          preferred_mcp: Json
          preferred_models: Json
          reasoning_style: string | null
          risks: Json
          sessions_count: number
          status: string
          strengths: Json
          success_indicators: Json
          thinking_style: string | null
          understanding_score: number
          updated_at: string
          version: number
          weaknesses: Json
        }
        Insert: {
          capability_graph?: Json
          confidence?: number
          cooperation?: Json
          coverage?: Json
          created_at?: string
          decision_style?: string | null
          dna?: Json
          expert_key: string
          failure_indicators?: Json
          fingerprint?: string | null
          improvement_suggestions?: Json
          knowledge_graph?: Json
          last_learned_at?: string | null
          limitations?: Json
          policies?: Json
          preferred_mcp?: Json
          preferred_models?: Json
          reasoning_style?: string | null
          risks?: Json
          sessions_count?: number
          status?: string
          strengths?: Json
          success_indicators?: Json
          thinking_style?: string | null
          understanding_score?: number
          updated_at?: string
          version?: number
          weaknesses?: Json
        }
        Update: {
          capability_graph?: Json
          confidence?: number
          cooperation?: Json
          coverage?: Json
          created_at?: string
          decision_style?: string | null
          dna?: Json
          expert_key?: string
          failure_indicators?: Json
          fingerprint?: string | null
          improvement_suggestions?: Json
          knowledge_graph?: Json
          last_learned_at?: string | null
          limitations?: Json
          policies?: Json
          preferred_mcp?: Json
          preferred_models?: Json
          reasoning_style?: string | null
          risks?: Json
          sessions_count?: number
          status?: string
          strengths?: Json
          success_indicators?: Json
          thinking_style?: string | null
          understanding_score?: number
          updated_at?: string
          version?: number
          weaknesses?: Json
        }
        Relationships: []
      }
      expert_snapshots: {
        Row: {
          approved: boolean
          created_at: string
          expert_key: string
          id: string
          payload: Json
          session_id: string | null
          version: number
        }
        Insert: {
          approved?: boolean
          created_at?: string
          expert_key: string
          id?: string
          payload?: Json
          session_id?: string | null
          version: number
        }
        Update: {
          approved?: boolean
          created_at?: string
          expert_key?: string
          id?: string
          payload?: Json
          session_id?: string | null
          version?: number
        }
        Relationships: []
      }
      firecrawl_cache: {
        Row: {
          cache_key: string
          created_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          payload?: Json
        }
        Relationships: []
      }
      firecrawl_usage: {
        Row: {
          cache_hit: boolean
          created_at: string
          id: string
          latency_ms: number | null
          op: string
          query_hash: string | null
          status: number | null
          tool_key: string | null
          units: number
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          created_at?: string
          id?: string
          latency_ms?: number | null
          op: string
          query_hash?: string | null
          status?: number | null
          tool_key?: string | null
          units?: number
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          created_at?: string
          id?: string
          latency_ms?: number | null
          op?: string
          query_hash?: string | null
          status?: number | null
          tool_key?: string | null
          units?: number
          user_id?: string | null
        }
        Relationships: []
      }
      geo_strategies: {
        Row: {
          brand: string
          created_at: string
          goals: Json
          id: string
          recommendations: Json
          scope: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          goals?: Json
          id?: string
          recommendations?: Json
          scope?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          goals?: Json
          id?: string
          recommendations?: Json
          scope?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      governorates: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name_ar: string
          name_en: string
          name_ku: string
          population_base: number | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_ar: string
          name_en: string
          name_ku: string
          population_base?: number | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_ar?: string
          name_en?: string
          name_ku?: string
          population_base?: number | null
          slug?: string
        }
        Relationships: []
      }
      hermes_conversations: {
        Row: {
          created_at: string
          id: string
          language: string
          title: string
          total_tokens: number
          total_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          title?: string
          total_tokens?: number
          total_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          title?: string
          total_tokens?: number
          total_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hermes_discoveries: {
        Row: {
          business_impact: string | null
          category: string
          cost_note: string | null
          created_at: string
          id: string
          migration_complexity: string | null
          recommendation: string | null
          risk: string | null
          source: string | null
          status: string
          title: string
          why_it_matters: string | null
        }
        Insert: {
          business_impact?: string | null
          category: string
          cost_note?: string | null
          created_at?: string
          id?: string
          migration_complexity?: string | null
          recommendation?: string | null
          risk?: string | null
          source?: string | null
          status?: string
          title: string
          why_it_matters?: string | null
        }
        Update: {
          business_impact?: string | null
          category?: string
          cost_note?: string | null
          created_at?: string
          id?: string
          migration_complexity?: string | null
          recommendation?: string | null
          risk?: string | null
          source?: string | null
          status?: string
          title?: string
          why_it_matters?: string | null
        }
        Relationships: []
      }
      hermes_founder_dna: {
        Row: {
          approved_count: number
          architecture_preferences: Json
          business_strategy: Json
          confidence: number
          cost_philosophy: Json
          created_at: string
          founder_key: string
          growth_strategy: Json
          id: string
          innovation_style: Json
          language_preferences: Json
          product_philosophy: Json
          quality_expectations: Json
          reasoning_style: Json
          rejected_count: number
          revenue_strategy: Json
          risk_tolerance: number
          security_priorities: Json
          signals: Json
          updated_at: string
          vision: Json
        }
        Insert: {
          approved_count?: number
          architecture_preferences?: Json
          business_strategy?: Json
          confidence?: number
          cost_philosophy?: Json
          created_at?: string
          founder_key?: string
          growth_strategy?: Json
          id?: string
          innovation_style?: Json
          language_preferences?: Json
          product_philosophy?: Json
          quality_expectations?: Json
          reasoning_style?: Json
          rejected_count?: number
          revenue_strategy?: Json
          risk_tolerance?: number
          security_priorities?: Json
          signals?: Json
          updated_at?: string
          vision?: Json
        }
        Update: {
          approved_count?: number
          architecture_preferences?: Json
          business_strategy?: Json
          confidence?: number
          cost_philosophy?: Json
          created_at?: string
          founder_key?: string
          growth_strategy?: Json
          id?: string
          innovation_style?: Json
          language_preferences?: Json
          product_philosophy?: Json
          quality_expectations?: Json
          reasoning_style?: Json
          rejected_count?: number
          revenue_strategy?: Json
          risk_tolerance?: number
          security_priorities?: Json
          signals?: Json
          updated_at?: string
          vision?: Json
        }
        Relationships: []
      }
      hermes_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          evidence: Json
          id: string
          model: string | null
          role: string
          tokens: number
          usd: number
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          evidence?: Json
          id?: string
          model?: string | null
          role: string
          tokens?: number
          usd?: number
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          model?: string | null
          role?: string
          tokens?: number
          usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hermes_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hermes_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      hermes_proposals: {
        Row: {
          affected_components: Json
          alternatives: Json
          auto_rejected_reason: string | null
          business_value: string | null
          confidence: number | null
          cost_analysis: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          estimated_roi: number | null
          estimated_runtime_ms: number | null
          estimated_tokens: number | null
          evidence: Json
          executive_summary: string
          expected_cost_usd: number | null
          expected_gains: Json
          expected_value_usd: number | null
          founder_note: string | null
          id: string
          kind: string
          maintenance_note: string | null
          priority: number
          problem: string | null
          required_approval: string
          revenue_potential: Json
          risk_analysis: Json
          rollback_plan: string | null
          status: string
          technical_analysis: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_components?: Json
          alternatives?: Json
          auto_rejected_reason?: string | null
          business_value?: string | null
          confidence?: number | null
          cost_analysis?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          estimated_roi?: number | null
          estimated_runtime_ms?: number | null
          estimated_tokens?: number | null
          evidence?: Json
          executive_summary: string
          expected_cost_usd?: number | null
          expected_gains?: Json
          expected_value_usd?: number | null
          founder_note?: string | null
          id?: string
          kind: string
          maintenance_note?: string | null
          priority?: number
          problem?: string | null
          required_approval?: string
          revenue_potential?: Json
          risk_analysis?: Json
          rollback_plan?: string | null
          status?: string
          technical_analysis?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_components?: Json
          alternatives?: Json
          auto_rejected_reason?: string | null
          business_value?: string | null
          confidence?: number | null
          cost_analysis?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          estimated_roi?: number | null
          estimated_runtime_ms?: number | null
          estimated_tokens?: number | null
          evidence?: Json
          executive_summary?: string
          expected_cost_usd?: number | null
          expected_gains?: Json
          expected_value_usd?: number | null
          founder_note?: string | null
          id?: string
          kind?: string
          maintenance_note?: string | null
          priority?: number
          problem?: string | null
          required_approval?: string
          revenue_potential?: Json
          risk_analysis?: Json
          rollback_plan?: string | null
          status?: string
          technical_analysis?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_edges: {
        Row: {
          created_at: string
          from_node: string
          id: string
          relation: string
          to_node: string
          weight: number
        }
        Insert: {
          created_at?: string
          from_node: string
          id?: string
          relation: string
          to_node: string
          weight?: number
        }
        Update: {
          created_at?: string
          from_node?: string
          id?: string
          relation?: string
          to_node?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_edges_from_node_fkey"
            columns: ["from_node"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_edges_to_node_fkey"
            columns: ["to_node"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_nodes: {
        Row: {
          confidence: number
          created_at: string
          evidence_score: number
          freshness_at: string
          id: string
          importance: number
          layer: string
          node_key: string
          payload: Json
          quality: number
          reliability: number
          scope: string
          sources: Json
          status: string
          summary: string | null
          title: string
          updated_at: string
          usage_count: number
          user_id: string | null
          version: number
          workspace_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_score?: number
          freshness_at?: string
          id?: string
          importance?: number
          layer: string
          node_key: string
          payload?: Json
          quality?: number
          reliability?: number
          scope?: string
          sources?: Json
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          usage_count?: number
          user_id?: string | null
          version?: number
          workspace_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_score?: number
          freshness_at?: string
          id?: string
          importance?: number
          layer?: string
          node_key?: string
          payload?: Json
          quality?: number
          reliability?: number
          scope?: string
          sources?: Json
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          usage_count?: number
          user_id?: string | null
          version?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      learning_budget_ledger: {
        Row: {
          budget_source: string
          cache_hit: boolean
          created_at: string
          expert_key: string | null
          id: string
          input_tokens: number
          latency_ms: number | null
          meta: Json
          model: string | null
          output_tokens: number
          purpose: string
          session_id: string | null
          tokens: number
          usd: number
          zero_cost_reason: string | null
        }
        Insert: {
          budget_source?: string
          cache_hit?: boolean
          created_at?: string
          expert_key?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          meta?: Json
          model?: string | null
          output_tokens?: number
          purpose: string
          session_id?: string | null
          tokens?: number
          usd?: number
          zero_cost_reason?: string | null
        }
        Update: {
          budget_source?: string
          cache_hit?: boolean
          created_at?: string
          expert_key?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          meta?: Json
          model?: string | null
          output_tokens?: number
          purpose?: string
          session_id?: string | null
          tokens?: number
          usd?: number
          zero_cost_reason?: string | null
        }
        Relationships: []
      }
      maaroof_agents: {
        Row: {
          confidence: Json
          cost_breakdown: Json
          created_at: string
          dna: Json
          id: string
          last_run_id: string | null
          lifecycle_state: string
          mission: string | null
          parent_agent_id: string | null
          personality: Json
          personality_version: number
          role: string
          runs_count: number
          success_rate: number | null
          updated_at: string
          user_id: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          confidence?: Json
          cost_breakdown?: Json
          created_at?: string
          dna?: Json
          id?: string
          last_run_id?: string | null
          lifecycle_state?: string
          mission?: string | null
          parent_agent_id?: string | null
          personality?: Json
          personality_version?: number
          role: string
          runs_count?: number
          success_rate?: number | null
          updated_at?: string
          user_id: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          confidence?: Json
          cost_breakdown?: Json
          created_at?: string
          dna?: Json
          id?: string
          last_run_id?: string | null
          lifecycle_state?: string
          mission?: string | null
          parent_agent_id?: string | null
          personality?: Json
          personality_version?: number
          role?: string
          runs_count?: number
          success_rate?: number | null
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maaroof_agents_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "maaroof_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maaroof_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      maaroof_evolution_reports: {
        Row: {
          created_at: string
          id: string
          payload: Json
          period: string
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          period: string
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          period?: string
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      maaroof_memory: {
        Row: {
          capability: string | null
          confidence: number | null
          consent_level: string
          content: string
          created_at: string
          decision_impact: number | null
          freshness_at: string | null
          id: string
          importance: number
          kind: string
          last_accessed_at: string
          learning_score: number | null
          links: Json
          reliability: number | null
          run_id: string | null
          scope: string
          source: string | null
          source_run_id: string | null
          usage_count: number
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          capability?: string | null
          confidence?: number | null
          consent_level?: string
          content: string
          created_at?: string
          decision_impact?: number | null
          freshness_at?: string | null
          id?: string
          importance?: number
          kind: string
          last_accessed_at?: string
          learning_score?: number | null
          links?: Json
          reliability?: number | null
          run_id?: string | null
          scope?: string
          source?: string | null
          source_run_id?: string | null
          usage_count?: number
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          capability?: string | null
          confidence?: number | null
          consent_level?: string
          content?: string
          created_at?: string
          decision_impact?: number | null
          freshness_at?: string | null
          id?: string
          importance?: number
          kind?: string
          last_accessed_at?: string
          learning_score?: number | null
          links?: Json
          reliability?: number | null
          run_id?: string | null
          scope?: string
          source?: string | null
          source_run_id?: string | null
          usage_count?: number
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maaroof_memory_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "maaroof_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maaroof_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      maaroof_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          run_id: string
          tokens: number
          usd: number
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          run_id: string
          tokens?: number
          usd?: number
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          run_id?: string
          tokens?: number
          usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "maaroof_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "maaroof_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      maaroof_runs: {
        Row: {
          attempts: number
          auto_run: boolean
          compliance: Json | null
          created_at: string
          decision_log: Json
          depends_on_run_id: string | null
          detected_geo: Json | null
          error: string | null
          execution_mode: string
          finished_at: string | null
          geo_scope: Json | null
          goal: string
          id: string
          language: string | null
          model: string | null
          next_attempt_at: string | null
          parent_run_id: string | null
          plan: Json
          priority: number
          quality_score: Json | null
          queue_state: string
          schedule_id: string | null
          started_at: string
          status: string
          steps_count: number
          timing: Json | null
          total_tokens: number
          total_usd: number
          trust: Json | null
          user_id: string
          workflow_state: string | null
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          auto_run?: boolean
          compliance?: Json | null
          created_at?: string
          decision_log?: Json
          depends_on_run_id?: string | null
          detected_geo?: Json | null
          error?: string | null
          execution_mode?: string
          finished_at?: string | null
          geo_scope?: Json | null
          goal: string
          id?: string
          language?: string | null
          model?: string | null
          next_attempt_at?: string | null
          parent_run_id?: string | null
          plan?: Json
          priority?: number
          quality_score?: Json | null
          queue_state?: string
          schedule_id?: string | null
          started_at?: string
          status?: string
          steps_count?: number
          timing?: Json | null
          total_tokens?: number
          total_usd?: number
          trust?: Json | null
          user_id: string
          workflow_state?: string | null
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          auto_run?: boolean
          compliance?: Json | null
          created_at?: string
          decision_log?: Json
          depends_on_run_id?: string | null
          detected_geo?: Json | null
          error?: string | null
          execution_mode?: string
          finished_at?: string | null
          geo_scope?: Json | null
          goal?: string
          id?: string
          language?: string | null
          model?: string | null
          next_attempt_at?: string | null
          parent_run_id?: string | null
          plan?: Json
          priority?: number
          quality_score?: Json | null
          queue_state?: string
          schedule_id?: string | null
          started_at?: string
          status?: string
          steps_count?: number
          timing?: Json | null
          total_tokens?: number
          total_usd?: number
          trust?: Json | null
          user_id?: string
          workflow_state?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maaroof_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "maaroof_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maaroof_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      maaroof_schedules: {
        Row: {
          approval_mode: string
          approval_rules: Json | null
          cadence: string
          capabilities: Json | null
          conditions: Json | null
          cost_limit_usd: number | null
          created_at: string
          cron_expr: string | null
          ends_at: string | null
          force_tools: string[]
          id: string
          language: string
          last_run_at: string | null
          max_runs: number
          meta: Json
          name: string
          next_run_at: string | null
          prompt: string
          retry_rules: Json | null
          runs_done: number
          starts_at: string
          status: string
          token_limit: number | null
          updated_at: string
          user_id: string
          workflow_graph: Json | null
          workspace_id: string | null
        }
        Insert: {
          approval_mode?: string
          approval_rules?: Json | null
          cadence?: string
          capabilities?: Json | null
          conditions?: Json | null
          cost_limit_usd?: number | null
          created_at?: string
          cron_expr?: string | null
          ends_at?: string | null
          force_tools?: string[]
          id?: string
          language?: string
          last_run_at?: string | null
          max_runs?: number
          meta?: Json
          name: string
          next_run_at?: string | null
          prompt: string
          retry_rules?: Json | null
          runs_done?: number
          starts_at?: string
          status?: string
          token_limit?: number | null
          updated_at?: string
          user_id: string
          workflow_graph?: Json | null
          workspace_id?: string | null
        }
        Update: {
          approval_mode?: string
          approval_rules?: Json | null
          cadence?: string
          capabilities?: Json | null
          conditions?: Json | null
          cost_limit_usd?: number | null
          created_at?: string
          cron_expr?: string | null
          ends_at?: string | null
          force_tools?: string[]
          id?: string
          language?: string
          last_run_at?: string | null
          max_runs?: number
          meta?: Json
          name?: string
          next_run_at?: string | null
          prompt?: string
          retry_rules?: Json | null
          runs_done?: number
          starts_at?: string
          status?: string
          token_limit?: number | null
          updated_at?: string
          user_id?: string
          workflow_graph?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maaroof_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      maaroof_settings: {
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
      mcp_providers: {
        Row: {
          auth_kind: string
          avg_cost_usd: number | null
          avg_latency_ms: number | null
          capabilities: Json
          created_at: string
          description: string | null
          enabled: boolean
          endpoint: string | null
          id: string
          limits: Json
          name: string
          policies: Json
          reliability: number | null
          scopes: string[]
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          auth_kind?: string
          avg_cost_usd?: number | null
          avg_latency_ms?: number | null
          capabilities?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          limits?: Json
          name: string
          policies?: Json
          reliability?: number | null
          scopes?: string[]
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          auth_kind?: string
          avg_cost_usd?: number | null
          avg_latency_ms?: number | null
          capabilities?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          limits?: Json
          name?: string
          policies?: Json
          reliability?: number | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_providers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_dna: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          source_run_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          source_run_id?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          source_run_id?: string | null
          weight?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          brand_keywords: string | null
          brand_name: string | null
          cognitive_consent: string
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
          hide_usage_counter: boolean
          id: string
          is_subscribed: boolean
          max_devices: number
          monthly_analyses_used: number
          monthly_suggestions_used: number
          notify_onboarded: boolean
          per_user_tool_overrides: Json
          preferred_notify_channel: string
          quota_overrides: Json
          specialty: string | null
          subscription_expires_at: string | null
          subscription_tier: string | null
          tokens_balance: number
          tokens_daily_limit: number | null
          tokens_monthly_limit: number | null
          tokens_used_month: number
          tokens_used_today: number
          tool_geo_scopes: Json
          ui_visibility: Json
          usage_day_start: string
          usage_period_start: string
          username: string | null
        }
        Insert: {
          brand_keywords?: string | null
          brand_name?: string | null
          cognitive_consent?: string
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
          hide_usage_counter?: boolean
          id: string
          is_subscribed?: boolean
          max_devices?: number
          monthly_analyses_used?: number
          monthly_suggestions_used?: number
          notify_onboarded?: boolean
          per_user_tool_overrides?: Json
          preferred_notify_channel?: string
          quota_overrides?: Json
          specialty?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tokens_balance?: number
          tokens_daily_limit?: number | null
          tokens_monthly_limit?: number | null
          tokens_used_month?: number
          tokens_used_today?: number
          tool_geo_scopes?: Json
          ui_visibility?: Json
          usage_day_start?: string
          usage_period_start?: string
          username?: string | null
        }
        Update: {
          brand_keywords?: string | null
          brand_name?: string | null
          cognitive_consent?: string
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
          hide_usage_counter?: boolean
          id?: string
          is_subscribed?: boolean
          max_devices?: number
          monthly_analyses_used?: number
          monthly_suggestions_used?: number
          notify_onboarded?: boolean
          per_user_tool_overrides?: Json
          preferred_notify_channel?: string
          quota_overrides?: Json
          specialty?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          tokens_balance?: number
          tokens_daily_limit?: number | null
          tokens_monthly_limit?: number | null
          tokens_used_month?: number
          tokens_used_today?: number
          tool_geo_scopes?: Json
          ui_visibility?: Json
          usage_day_start?: string
          usage_period_start?: string
          username?: string | null
        }
        Relationships: []
      }
      provider_rates: {
        Row: {
          id: string
          model: string | null
          notes: string | null
          provider: string
          unit: string
          updated_at: string
          usd_per_unit: number
        }
        Insert: {
          id?: string
          model?: string | null
          notes?: string | null
          provider: string
          unit: string
          updated_at?: string
          usd_per_unit?: number
        }
        Update: {
          id?: string
          model?: string | null
          notes?: string | null
          provider?: string
          unit?: string
          updated_at?: string
          usd_per_unit?: number
        }
        Relationships: []
      }
      publication_metrics: {
        Row: {
          ai_visibility: number | null
          clicks: number
          collected_at: string
          comments: number
          conversions: number
          created_at: string
          id: string
          impressions: number
          likes: number
          publication_id: string
          reach: number
          search_visibility: number | null
          shares: number
          signals: Json
          user_id: string
        }
        Insert: {
          ai_visibility?: number | null
          clicks?: number
          collected_at?: string
          comments?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          likes?: number
          publication_id: string
          reach?: number
          search_visibility?: number | null
          shares?: number
          signals?: Json
          user_id: string
        }
        Update: {
          ai_visibility?: number | null
          clicks?: number
          collected_at?: string
          comments?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          likes?: number
          publication_id?: string
          reach?: number
          search_visibility?: number | null
          shares?: number
          signals?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_metrics_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          approval_status: string
          campaign_id: string | null
          channel_id: string | null
          compliance: Json
          content: string
          cost_usd: number
          created_at: string
          error: string | null
          expert_review: Json
          external_ref: string | null
          id: string
          language: string
          media: Json
          platform_key: string
          published_at: string | null
          risk: Json
          scheduled_at: string | null
          stage: string
          status: string
          strategy: Json
          title: string | null
          tokens: number
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          approval_status?: string
          campaign_id?: string | null
          channel_id?: string | null
          compliance?: Json
          content?: string
          cost_usd?: number
          created_at?: string
          error?: string | null
          expert_review?: Json
          external_ref?: string | null
          id?: string
          language?: string
          media?: Json
          platform_key: string
          published_at?: string | null
          risk?: Json
          scheduled_at?: string | null
          stage?: string
          status?: string
          strategy?: Json
          title?: string | null
          tokens?: number
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          approval_status?: string
          campaign_id?: string | null
          channel_id?: string | null
          compliance?: Json
          content?: string
          cost_usd?: number
          created_at?: string
          error?: string | null
          expert_review?: Json
          external_ref?: string | null
          id?: string
          language?: string
          media?: Json
          platform_key?: string
          published_at?: string | null
          risk?: Json
          scheduled_at?: string | null
          stage?: string
          status?: string
          strategy?: Json
          title?: string | null
          tokens?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "publishing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_channels: {
        Row: {
          account_label: string | null
          active: boolean
          approval_mode: string
          config: Json
          connected_via: string
          connection_id: string | null
          created_at: string
          external_account_id: string | null
          id: string
          kind: string
          label: string | null
          scopes: Json
          user_id: string
          verified_at: string | null
        }
        Insert: {
          account_label?: string | null
          active?: boolean
          approval_mode?: string
          config?: Json
          connected_via?: string
          connection_id?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          kind: string
          label?: string | null
          scopes?: Json
          user_id: string
          verified_at?: string | null
        }
        Update: {
          account_label?: string | null
          active?: boolean
          approval_mode?: string
          config?: Json
          connected_via?: string
          connection_id?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          kind?: string
          label?: string | null
          scopes?: Json
          user_id?: string
          verified_at?: string | null
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
      publishing_campaigns: {
        Row: {
          approval_mode: string
          brand: string | null
          budget_usd: number
          created_at: string
          ends_at: string | null
          goal: string | null
          id: string
          language: string
          name: string
          platforms: string[]
          spent_usd: number
          starts_at: string | null
          status: string
          strategy: Json
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          approval_mode?: string
          brand?: string | null
          budget_usd?: number
          created_at?: string
          ends_at?: string | null
          goal?: string | null
          id?: string
          language?: string
          name: string
          platforms?: string[]
          spent_usd?: number
          starts_at?: string | null
          status?: string
          strategy?: Json
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          approval_mode?: string
          brand?: string | null
          budget_usd?: number
          created_at?: string
          ends_at?: string | null
          goal?: string | null
          id?: string
          language?: string
          name?: string
          platforms?: string[]
          spent_usd?: number
          starts_at?: string | null
          status?: string
          strategy?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      publishing_platforms: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          label_ar: string
          label_en: string
          label_ku: string | null
          limits: Json
          platform_key: string
          profile: Json
          requires_connection: boolean
          risk_rules: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label_ar: string
          label_en: string
          label_ku?: string | null
          limits?: Json
          platform_key: string
          profile?: Json
          requires_connection?: boolean
          risk_rules?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label_ar?: string
          label_en?: string
          label_ku?: string | null
          limits?: Json
          platform_key?: string
          profile?: Json
          requires_connection?: boolean
          risk_rules?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      report_drafts: {
        Row: {
          created_at: string
          id: string
          lang: string
          payload: Json
          title: string | null
          tool_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lang?: string
          payload?: Json
          title?: string | null
          tool_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lang?: string
          payload?: Json
          title?: string | null
          tool_key?: string
          user_id?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          ar: string | null
          created_at: string
          en: string | null
          key: string
          ku: string | null
          namespace: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ar?: string | null
          created_at?: string
          en?: string | null
          key: string
          ku?: string | null
          namespace?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ar?: string | null
          created_at?: string
          en?: string | null
          key?: string
          ku?: string | null
          namespace?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      state_anchors: {
        Row: {
          approval_status: string
          budget: Json
          constraints: Json
          created_at: string
          current_goal: string | null
          dna: Json
          drift: Json
          future_goal: string | null
          geo: Json | null
          health: Json
          health_score: number | null
          id: string
          label: string | null
          language: string | null
          last_validated_at: string | null
          level: string
          mission: string | null
          parent_anchor_id: string | null
          policies: Json
          priority: number
          quality_target: number | null
          risk_target: number | null
          run_id: string | null
          scope_id: string
          status: string
          updated_at: string
          user_id: string | null
          version: number
          workspace_id: string | null
        }
        Insert: {
          approval_status?: string
          budget?: Json
          constraints?: Json
          created_at?: string
          current_goal?: string | null
          dna?: Json
          drift?: Json
          future_goal?: string | null
          geo?: Json | null
          health?: Json
          health_score?: number | null
          id?: string
          label?: string | null
          language?: string | null
          last_validated_at?: string | null
          level: string
          mission?: string | null
          parent_anchor_id?: string | null
          policies?: Json
          priority?: number
          quality_target?: number | null
          risk_target?: number | null
          run_id?: string | null
          scope_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
          version?: number
          workspace_id?: string | null
        }
        Update: {
          approval_status?: string
          budget?: Json
          constraints?: Json
          created_at?: string
          current_goal?: string | null
          dna?: Json
          drift?: Json
          future_goal?: string | null
          geo?: Json | null
          health?: Json
          health_score?: number | null
          id?: string
          label?: string | null
          language?: string | null
          last_validated_at?: string | null
          level?: string
          mission?: string | null
          parent_anchor_id?: string | null
          policies?: Json
          priority?: number
          quality_target?: number | null
          risk_target?: number | null
          run_id?: string | null
          scope_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "state_anchors_parent_anchor_id_fkey"
            columns: ["parent_anchor_id"]
            isOneToOne: false
            referencedRelation: "state_anchors"
            referencedColumns: ["id"]
          },
        ]
      }
      state_timeline: {
        Row: {
          affected: Json
          anchor_id: string | null
          change_kind: string
          cost_usd: number
          created_at: string
          drift: Json | null
          id: string
          initiated_by: string
          level: string
          new_state: Json | null
          old_state: Json | null
          reason: string | null
          rollback_point: boolean
          run_id: string | null
          scope_id: string
          tokens: number
          user_id: string | null
        }
        Insert: {
          affected?: Json
          anchor_id?: string | null
          change_kind: string
          cost_usd?: number
          created_at?: string
          drift?: Json | null
          id?: string
          initiated_by?: string
          level: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string | null
          rollback_point?: boolean
          run_id?: string | null
          scope_id: string
          tokens?: number
          user_id?: string | null
        }
        Update: {
          affected?: Json
          anchor_id?: string | null
          change_kind?: string
          cost_usd?: number
          created_at?: string
          drift?: Json | null
          id?: string
          initiated_by?: string
          level?: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string | null
          rollback_point?: boolean
          run_id?: string | null
          scope_id?: string
          tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "state_timeline_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "state_anchors"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          agent_daily_cap: number | null
          agent_max_targets: number | null
          agent_monthly_cap: number | null
          created_at: string
          daily_tokens: number
          default_currency: string
          description: string | null
          discount_badge_enabled: boolean
          discount_badge_text: string | null
          duration_days: number
          features: Json
          id: string
          monthly_analyses: number
          monthly_suggestions: number
          monthly_tokens: number
          name: string
          price_iqd: number
          price_usd: number
          prices: Json
          sort_order: number
        }
        Insert: {
          active?: boolean
          agent_daily_cap?: number | null
          agent_max_targets?: number | null
          agent_monthly_cap?: number | null
          created_at?: string
          daily_tokens?: number
          default_currency?: string
          description?: string | null
          discount_badge_enabled?: boolean
          discount_badge_text?: string | null
          duration_days?: number
          features?: Json
          id?: string
          monthly_analyses?: number
          monthly_suggestions?: number
          monthly_tokens?: number
          name: string
          price_iqd?: number
          price_usd?: number
          prices?: Json
          sort_order?: number
        }
        Update: {
          active?: boolean
          agent_daily_cap?: number | null
          agent_max_targets?: number | null
          agent_monthly_cap?: number | null
          created_at?: string
          daily_tokens?: number
          default_currency?: string
          description?: string | null
          discount_badge_enabled?: boolean
          discount_badge_text?: string | null
          duration_days?: number
          features?: Json
          id?: string
          monthly_analyses?: number
          monthly_suggestions?: number
          monthly_tokens?: number
          name?: string
          price_iqd?: number
          price_usd?: number
          prices?: Json
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
      token_ledger: {
        Row: {
          created_at: string
          id: string
          meta: Json
          run_id: string | null
          tokens: number
          tool_key: string
          usd_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          run_id?: string | null
          tokens: number
          tool_key: string
          usd_cost?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          run_id?: string | null
          tokens?: number
          tool_key?: string
          usd_cost?: number
          user_id?: string
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
          default_currency: string
          enabled: boolean
          id: string
          monthly_quota: number | null
          notes: string | null
          plan_id: string
          prices: Json
          tokens_per_use: number
          tool_key: string
          updated_at: string
          usd_per_use: number
        }
        Insert: {
          created_at?: string
          daily_quota?: number | null
          default_currency?: string
          enabled?: boolean
          id?: string
          monthly_quota?: number | null
          notes?: string | null
          plan_id: string
          prices?: Json
          tokens_per_use?: number
          tool_key: string
          updated_at?: string
          usd_per_use?: number
        }
        Update: {
          created_at?: string
          daily_quota?: number | null
          default_currency?: string
          enabled?: boolean
          id?: string
          monthly_quota?: number | null
          notes?: string | null
          plan_id?: string
          prices?: Json
          tokens_per_use?: number
          tool_key?: string
          updated_at?: string
          usd_per_use?: number
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
      tool_pricing_catalog: {
        Row: {
          default_tokens: number
          default_usd: number
          model: string | null
          notes: string | null
          tool_key: string
          updated_at: string
        }
        Insert: {
          default_tokens?: number
          default_usd?: number
          model?: string | null
          notes?: string | null
          tool_key: string
          updated_at?: string
        }
        Update: {
          default_tokens?: number
          default_usd?: number
          model?: string | null
          notes?: string | null
          tool_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      trust_events: {
        Row: {
          created_at: string
          delta: number
          entity_key: string
          entity_type: string
          evidence: Json
          id: string
          reason: string
          run_id: string | null
          score_after: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delta?: number
          entity_key: string
          entity_type: string
          evidence?: Json
          id?: string
          reason: string
          run_id?: string | null
          score_after?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          entity_key?: string
          entity_type?: string
          evidence?: Json
          id?: string
          reason?: string
          run_id?: string | null
          score_after?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      trust_profiles: {
        Row: {
          avg_confidence: number | null
          avg_cost_usd: number | null
          avg_latency_ms: number | null
          contradictions: number
          created_at: string
          dimensions: Json
          entity_key: string
          entity_type: string
          evidence: Json
          failures: number
          history: Json
          id: string
          last_evaluated_at: string | null
          prediction_accuracy: number | null
          samples: number
          scope: string
          successes: number
          trust_score: number
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          avg_confidence?: number | null
          avg_cost_usd?: number | null
          avg_latency_ms?: number | null
          contradictions?: number
          created_at?: string
          dimensions?: Json
          entity_key: string
          entity_type: string
          evidence?: Json
          failures?: number
          history?: Json
          id?: string
          last_evaluated_at?: string | null
          prediction_accuracy?: number | null
          samples?: number
          scope?: string
          successes?: number
          trust_score?: number
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          avg_confidence?: number | null
          avg_cost_usd?: number | null
          avg_latency_ms?: number | null
          contradictions?: number
          created_at?: string
          dimensions?: Json
          entity_key?: string
          entity_type?: string
          evidence?: Json
          failures?: number
          history?: Json
          id?: string
          last_evaluated_at?: string | null
          prediction_accuracy?: number | null
          samples?: number
          scope?: string
          successes?: number
          trust_score?: number
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
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
      user_intent_profile: {
        Row: {
          context_summary: string | null
          detected_intent: Json
          last_signals: Json
          signal_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          context_summary?: string | null
          detected_intent?: Json
          last_signals?: Json
          signal_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          context_summary?: string | null
          detected_intent?: Json
          last_signals?: Json
          signal_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
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
      whatif_scenarios: {
        Row: {
          axes: Json | null
          brand: string
          changes: Json
          created_at: string
          id: string
          kind: string
          projection: Json
          user_id: string
        }
        Insert: {
          axes?: Json | null
          brand: string
          changes?: Json
          created_at?: string
          id?: string
          kind?: string
          projection?: Json
          user_id: string
        }
        Update: {
          axes?: Json | null
          brand?: string
          changes?: Json
          created_at?: string
          id?: string
          kind?: string
          projection?: Json
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          brand_summary: string | null
          brand_url: string | null
          budget: Json
          city: string | null
          country: string | null
          created_at: string
          goals: Json
          id: string
          keywords: string[]
          kind: string
          language: string
          meta: Json
          name: string
          owner_id: string
          policies: Json
          preferred_experts: Json
          preferred_mcp: Json
          preferred_models: Json
          profile: Json
          risk_level: string | null
          success_metrics: Json
          updated_at: string
        }
        Insert: {
          brand_summary?: string | null
          brand_url?: string | null
          budget?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          goals?: Json
          id?: string
          keywords?: string[]
          kind?: string
          language?: string
          meta?: Json
          name: string
          owner_id: string
          policies?: Json
          preferred_experts?: Json
          preferred_mcp?: Json
          preferred_models?: Json
          profile?: Json
          risk_level?: string | null
          success_metrics?: Json
          updated_at?: string
        }
        Update: {
          brand_summary?: string | null
          brand_url?: string | null
          budget?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          goals?: Json
          id?: string
          keywords?: string[]
          kind?: string
          language?: string
          meta?: Json
          name?: string
          owner_id?: string
          policies?: Json
          preferred_experts?: Json
          preferred_mcp?: Json
          preferred_models?: Json
          profile?: Json
          risk_level?: string | null
          success_metrics?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      capability_scores_v: {
        Row: {
          avg_duration_s: number | null
          avg_usd: number | null
          capability: string | null
          error_runs: number | null
          invocations: number | null
          ok_runs: number | null
          runs: number | null
          success_rate: number | null
          total_tokens: number | null
          total_usd: number | null
        }
        Relationships: []
      }
      executive_quality_index_v: {
        Row: {
          avg_usd: number | null
          capability: number | null
          cost_efficiency: number | null
          day: string | null
          decision: number | null
          execution: number | null
          expert: number | null
          learning: number | null
          memory: number | null
          planning: number | null
          reflection: number | null
          runs: number | null
          simulation: number | null
          user_satisfaction: number | null
        }
        Relationships: []
      }
      expert_scores_v: {
        Row: {
          avg_tokens: number | null
          avg_usd: number | null
          expert: string | null
          last_used_at: string | null
          runs: number | null
        }
        Relationships: []
      }
      expert_understanding_v: {
        Row: {
          capability_coverage: number | null
          confidence: number | null
          cooperation_score: number | null
          decision_coverage: number | null
          expert_key: string | null
          knowledge_coverage: number | null
          last_learned_at: string | null
          memory_coverage: number | null
          reasoning_coverage: number | null
          sessions_count: number | null
          status: string | null
          total_sessions: number | null
          total_usd: number | null
          understanding_score: number | null
          version: number | null
        }
        Insert: {
          capability_coverage?: never
          confidence?: number | null
          cooperation_score?: never
          decision_coverage?: never
          expert_key?: string | null
          knowledge_coverage?: never
          last_learned_at?: string | null
          memory_coverage?: never
          reasoning_coverage?: never
          sessions_count?: number | null
          status?: string | null
          total_sessions?: never
          total_usd?: never
          understanding_score?: number | null
          version?: number | null
        }
        Update: {
          capability_coverage?: never
          confidence?: number | null
          cooperation_score?: never
          decision_coverage?: never
          expert_key?: string | null
          knowledge_coverage?: never
          last_learned_at?: string | null
          memory_coverage?: never
          reasoning_coverage?: never
          sessions_count?: number | null
          status?: string | null
          total_sessions?: never
          total_usd?: never
          understanding_score?: number | null
          version?: number | null
        }
        Relationships: []
      }
      knowledge_health_v: {
        Row: {
          avg_confidence: number | null
          avg_quality: number | null
          avg_reliability: number | null
          conflicts: number | null
          last_updated_at: string | null
          layer: string | null
          nodes: number | null
          stale: number | null
          total_usage: number | null
        }
        Relationships: []
      }
      law_compliance_v: {
        Row: {
          day: string | null
          law_ar: string | null
          law_id: number | null
          law_key: string | null
          severity: string | null
          violations: number | null
        }
        Relationships: []
      }
      learning_budget_v: {
        Row: {
          day: string | null
          free_ops: number | null
          ops: number | null
          purpose: string | null
          tokens: number | null
          usd: number | null
        }
        Relationships: []
      }
      mcp_scores_v: {
        Row: {
          avg_cost_usd: number | null
          avg_latency_ms: number | null
          capabilities: Json | null
          enabled: boolean | null
          id: string | null
          name: string | null
          reliability: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          avg_cost_usd?: never
          avg_latency_ms?: never
          capabilities?: Json | null
          enabled?: boolean | null
          id?: string | null
          name?: string | null
          reliability?: never
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          avg_cost_usd?: never
          avg_latency_ms?: never
          capabilities?: Json | null
          enabled?: boolean | null
          id?: string | null
          name?: string | null
          reliability?: never
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_providers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_scores_v: {
        Row: {
          avg_tokens: number | null
          avg_usd: number | null
          calls: number | null
          last_used_at: string | null
          model: string | null
        }
        Relationships: []
      }
      platform_intelligence_v: {
        Row: {
          avg_decisions: number | null
          avg_steps: number | null
          avg_tokens: number | null
          avg_usd: number | null
          day: string | null
          runs: number | null
          runs_done: number | null
          runs_error: number | null
        }
        Relationships: []
      }
      policy_scores_v: {
        Row: {
          last_updated_at: string | null
          policy: string | null
          workspaces: number | null
        }
        Relationships: []
      }
      run_quality_v: {
        Row: {
          avg_capability: number | null
          avg_cost_efficiency: number | null
          avg_decision: number | null
          avg_execution: number | null
          avg_expert: number | null
          avg_learning: number | null
          avg_memory: number | null
          avg_planning: number | null
          avg_reflection: number | null
          avg_simulation: number | null
          avg_user_satisfaction: number | null
          scored_runs: number | null
        }
        Relationships: []
      }
      v_user_tool_spend: {
        Row: {
          last_used_at: string | null
          tokens_month: number | null
          tokens_today: number | null
          tool_key: string | null
          total_tokens: number | null
          total_usd: number | null
          usd_month: number | null
          user_id: string | null
          uses: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      charge_tokens: {
        Args: {
          _meta?: Json
          _run_id?: string
          _tokens: number
          _tool_key: string
          _usd: number
          _user_id: string
        }
        Returns: Json
      }
      ensure_trial_subscription: { Args: never; Returns: string }
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

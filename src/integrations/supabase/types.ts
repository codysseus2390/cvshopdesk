export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_actions: {
        Row: {
          after_values: Json | null;
          args: Json;
          before_values: Json | null;
          confirmation_required: boolean;
          confirmed: boolean;
          created_at: string;
          error: string | null;
          id: string;
          proposal: Json | null;
          shop_id: string;
          source_type: string | null;
          status: string;
          target_id: string | null;
          target_table: string | null;
          tool: string;
          user_id: string;
        };
        Insert: {
          after_values?: Json | null;
          args?: Json;
          before_values?: Json | null;
          confirmation_required?: boolean;
          confirmed?: boolean;
          created_at?: string;
          error?: string | null;
          id?: string;
          proposal?: Json | null;
          shop_id: string;
          source_type?: string | null;
          status: string;
          target_id?: string | null;
          target_table?: string | null;
          tool: string;
          user_id: string;
        };
        Update: {
          after_values?: Json | null;
          args?: Json;
          before_values?: Json | null;
          confirmation_required?: boolean;
          confirmed?: boolean;
          created_at?: string;
          error?: string | null;
          id?: string;
          proposal?: Json | null;
          shop_id?: string;
          source_type?: string | null;
          status?: string;
          target_id?: string | null;
          target_table?: string | null;
          tool?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_actions_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_settings: {
        Row: {
          assistant_name: string;
          avatar_url: string | null;
          casual_language: boolean;
          created_at: string;
          customer_facing_professional: boolean;
          disabled_tools: string[];
          humor: boolean;
          mild_profanity: boolean;
          model_tier: string;
          personality: string;
          shop_banter: boolean;
          shop_id: string;
          subtitle: string;
          updated_at: string;
          updated_by: string | null;
          vision_enabled: boolean;
          voice_auto_listen: boolean;
          voice_auto_speak: boolean;
          voice_enabled: boolean;
          voice_id: string | null;
          voice_input_mode: string;
          voice_name: string | null;
          voice_similarity: number;
          voice_speaker_boost: boolean;
          voice_speed: number;
          voice_stability: number;
          voice_style: number;
          voice_wake_enabled: boolean;
          voice_wake_phrase: string;
          voice_wake_response: boolean;
          voice_wake_sound: boolean;
          voice_wake_timeout_seconds: number;
        };
        Insert: {
          assistant_name?: string;
          avatar_url?: string | null;
          casual_language?: boolean;
          created_at?: string;
          customer_facing_professional?: boolean;
          disabled_tools?: string[];
          humor?: boolean;
          mild_profanity?: boolean;
          model_tier?: string;
          personality?: string;
          shop_banter?: boolean;
          shop_id: string;
          subtitle?: string;
          updated_at?: string;
          updated_by?: string | null;
          vision_enabled?: boolean;
          voice_auto_listen?: boolean;
          voice_auto_speak?: boolean;
          voice_enabled?: boolean;
          voice_id?: string | null;
          voice_input_mode?: string;
          voice_name?: string | null;
          voice_similarity?: number;
          voice_speaker_boost?: boolean;
          voice_speed?: number;
          voice_stability?: number;
          voice_style?: number;
          voice_wake_enabled?: boolean;
          voice_wake_phrase?: string;
          voice_wake_response?: boolean;
          voice_wake_sound?: boolean;
          voice_wake_timeout_seconds?: number;
        };
        Update: {
          assistant_name?: string;
          avatar_url?: string | null;
          casual_language?: boolean;
          created_at?: string;
          customer_facing_professional?: boolean;
          disabled_tools?: string[];
          humor?: boolean;
          mild_profanity?: boolean;
          model_tier?: string;
          personality?: string;
          shop_banter?: boolean;
          shop_id?: string;
          subtitle?: string;
          updated_at?: string;
          updated_by?: string | null;
          vision_enabled?: boolean;
          voice_auto_listen?: boolean;
          voice_auto_speak?: boolean;
          voice_enabled?: boolean;
          voice_id?: string | null;
          voice_input_mode?: string;
          voice_name?: string | null;
          voice_similarity?: number;
          voice_speaker_boost?: boolean;
          voice_speed?: number;
          voice_stability?: number;
          voice_style?: number;
          voice_wake_enabled?: boolean;
          voice_wake_phrase?: string;
          voice_wake_response?: boolean;
          voice_wake_sound?: boolean;
          voice_wake_timeout_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ai_settings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          shop_id: string;
          sources: Json | null;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          shop_id: string;
          sources?: Json | null;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          shop_id?: string;
          sources?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_messages_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          detail: Json;
          id: string;
          shop_id: string;
          target: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          id?: string;
          shop_id: string;
          target?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          detail?: Json;
          id?: string;
          shop_id?: string;
          target?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          email: string | null;
          external_id: string | null;
          first_seen_at: string;
          flags: Json;
          id: string;
          identity_key: string | null;
          import_id: string | null;
          name: string;
          needs_review: boolean;
          phone: string | null;
          shop_id: string;
        };
        Insert: {
          email?: string | null;
          external_id?: string | null;
          first_seen_at?: string;
          flags?: Json;
          id?: string;
          identity_key?: string | null;
          import_id?: string | null;
          name: string;
          needs_review?: boolean;
          phone?: string | null;
          shop_id: string;
        };
        Update: {
          email?: string | null;
          external_id?: string | null;
          first_seen_at?: string;
          flags?: Json;
          id?: string;
          identity_key?: string | null;
          import_id?: string | null;
          name?: string;
          needs_review?: boolean;
          phone?: string | null;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          captured_at: string | null;
          error_message: string | null;
          extraction: Json | null;
          extraction_notes: string | null;
          file_hash: string;
          file_name: string;
          file_size: number | null;
          id: string;
          mime_type: string | null;
          period_end: string | null;
          period_start: string | null;
          report_scope: Database["public"]["Enums"]["report_scope"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          shop_id: string;
          status: Database["public"]["Enums"]["import_status"];
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
        };
        Insert: {
          captured_at?: string | null;
          error_message?: string | null;
          extraction?: Json | null;
          extraction_notes?: string | null;
          file_hash: string;
          file_name: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          report_scope?: Database["public"]["Enums"]["report_scope"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          shop_id: string;
          status?: Database["public"]["Enums"]["import_status"];
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
        };
        Update: {
          captured_at?: string | null;
          error_message?: string | null;
          extraction?: Json | null;
          extraction_notes?: string | null;
          file_hash?: string;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          report_scope?: Database["public"]["Enums"]["report_scope"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          shop_id?: string;
          status?: Database["public"]["Enums"]["import_status"];
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imports_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          brand: string | null;
          cost: number | null;
          created_at: string;
          description: string;
          external_id: string | null;
          flags: Json;
          id: string;
          identity_key: string | null;
          import_id: string | null;
          needs_review: boolean;
          price: number | null;
          quantity: number | null;
          shop_id: string;
          size: string | null;
          snapshot_date: string;
        };
        Insert: {
          brand?: string | null;
          cost?: number | null;
          created_at?: string;
          description: string;
          external_id?: string | null;
          flags?: Json;
          id?: string;
          identity_key?: string | null;
          import_id?: string | null;
          needs_review?: boolean;
          price?: number | null;
          quantity?: number | null;
          shop_id: string;
          size?: string | null;
          snapshot_date: string;
        };
        Update: {
          brand?: string | null;
          cost?: number | null;
          created_at?: string;
          description?: string;
          external_id?: string | null;
          flags?: Json;
          id?: string;
          identity_key?: string | null;
          import_id?: string | null;
          needs_review?: boolean;
          price?: number | null;
          quantity?: number | null;
          shop_id?: string;
          size?: string | null;
          snapshot_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      metric_corrections: {
        Row: {
          business_date: string;
          corrected_at: string;
          corrected_by: string;
          field: string;
          id: string;
          new_snapshot_id: string | null;
          new_value: string | null;
          note: string | null;
          previous_snapshot_id: string | null;
          previous_value: string | null;
          scope: Database["public"]["Enums"]["report_scope"];
          shop_id: string;
        };
        Insert: {
          business_date: string;
          corrected_at?: string;
          corrected_by: string;
          field: string;
          id?: string;
          new_snapshot_id?: string | null;
          new_value?: string | null;
          note?: string | null;
          previous_snapshot_id?: string | null;
          previous_value?: string | null;
          scope: Database["public"]["Enums"]["report_scope"];
          shop_id: string;
        };
        Update: {
          business_date?: string;
          corrected_at?: string;
          corrected_by?: string;
          field?: string;
          id?: string;
          new_snapshot_id?: string | null;
          new_value?: string | null;
          note?: string | null;
          previous_snapshot_id?: string | null;
          previous_value?: string | null;
          scope?: Database["public"]["Enums"]["report_scope"];
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metric_corrections_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      metric_snapshots: {
        Row: {
          business_date: string;
          car_count: number | null;
          created_at: string;
          entered_by: string;
          flags: Json;
          gross_profit: number | null;
          id: string;
          import_id: string | null;
          is_current: boolean;
          note: string | null;
          sales: number | null;
          scope: Database["public"]["Enums"]["report_scope"];
          shop_id: string;
          source: Database["public"]["Enums"]["metric_source"];
          superseded_at: string | null;
          superseded_by: string | null;
          tires_sold: number | null;
        };
        Insert: {
          business_date: string;
          car_count?: number | null;
          created_at?: string;
          entered_by: string;
          flags?: Json;
          gross_profit?: number | null;
          id?: string;
          import_id?: string | null;
          is_current?: boolean;
          note?: string | null;
          sales?: number | null;
          scope?: Database["public"]["Enums"]["report_scope"];
          shop_id: string;
          source?: Database["public"]["Enums"]["metric_source"];
          superseded_at?: string | null;
          superseded_by?: string | null;
          tires_sold?: number | null;
        };
        Update: {
          business_date?: string;
          car_count?: number | null;
          created_at?: string;
          entered_by?: string;
          flags?: Json;
          gross_profit?: number | null;
          id?: string;
          import_id?: string | null;
          is_current?: boolean;
          note?: string | null;
          sales?: number | null;
          scope?: Database["public"]["Enums"]["report_scope"];
          shop_id?: string;
          source?: Database["public"]["Enums"]["metric_source"];
          superseded_at?: string | null;
          superseded_by?: string | null;
          tires_sold?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metric_snapshots_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_recipients: {
        Row: {
          created_at: string;
          id: string;
          notification_id: string;
          read_at: string | null;
          shop_id: string;
          target: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notification_id: string;
          read_at?: string | null;
          shop_id: string;
          target: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          notification_id?: string;
          read_at?: string | null;
          shop_id?: string;
          target?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_recipients_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          audience: string;
          channels: Json;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          message: string;
          priority: string;
          published_at: string | null;
          shop_id: string;
          title: string;
        };
        Insert: {
          audience: string;
          channels?: Json;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          message: string;
          priority?: string;
          published_at?: string | null;
          shop_id: string;
          title: string;
        };
        Update: {
          audience?: string;
          channels?: Json;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          message?: string;
          priority?: string;
          published_at?: string | null;
          shop_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          allowed: boolean;
          id: string;
          permission: string;
          role: string;
          shop_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allowed: boolean;
          id?: string;
          permission: string;
          role: string;
          shop_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allowed?: boolean;
          id?: string;
          permission?: string;
          role?: string;
          shop_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_jobs: {
        Row: {
          appointment_at: string | null;
          arrival_at: string | null;
          customer_name: string | null;
          disposition: string | null;
          external_id: string | null;
          flags: Json;
          id: string;
          identity_key: string | null;
          import_id: string | null;
          is_current: boolean;
          job_status: string | null;
          local_note: string | null;
          local_status: string | null;
          local_updated_at: string | null;
          local_updated_by: string | null;
          needs_review: boolean;
          record_kind: string;
          requested_service: string | null;
          shop_id: string;
          snapshot_at: string;
          superseded_at: string | null;
          superseded_by: string | null;
          technician: string | null;
          vehicle_label: string | null;
        };
        Insert: {
          appointment_at?: string | null;
          arrival_at?: string | null;
          customer_name?: string | null;
          disposition?: string | null;
          external_id?: string | null;
          flags?: Json;
          id?: string;
          identity_key?: string | null;
          import_id?: string | null;
          is_current?: boolean;
          job_status?: string | null;
          local_note?: string | null;
          local_status?: string | null;
          local_updated_at?: string | null;
          local_updated_by?: string | null;
          needs_review?: boolean;
          record_kind?: string;
          requested_service?: string | null;
          shop_id: string;
          snapshot_at?: string;
          superseded_at?: string | null;
          superseded_by?: string | null;
          technician?: string | null;
          vehicle_label?: string | null;
        };
        Update: {
          appointment_at?: string | null;
          arrival_at?: string | null;
          customer_name?: string | null;
          disposition?: string | null;
          external_id?: string | null;
          flags?: Json;
          id?: string;
          identity_key?: string | null;
          import_id?: string | null;
          is_current?: boolean;
          job_status?: string | null;
          local_note?: string | null;
          local_status?: string | null;
          local_updated_at?: string | null;
          local_updated_by?: string | null;
          needs_review?: boolean;
          record_kind?: string;
          requested_service?: string | null;
          shop_id?: string;
          snapshot_at?: string;
          superseded_at?: string | null;
          superseded_by?: string | null;
          technician?: string | null;
          vehicle_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shop_jobs_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_jobs_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_members: {
        Row: {
          decided_at: string | null;
          decided_by: string | null;
          email: string | null;
          id: string;
          requested_at: string;
          role: Database["public"]["Enums"]["member_role"];
          shop_id: string;
          status: Database["public"]["Enums"]["member_status"];
          user_id: string;
        };
        Insert: {
          decided_at?: string | null;
          decided_by?: string | null;
          email?: string | null;
          id?: string;
          requested_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          shop_id: string;
          status?: Database["public"]["Enums"]["member_status"];
          user_id: string;
        };
        Update: {
          decided_at?: string | null;
          decided_by?: string | null;
          email?: string | null;
          id?: string;
          requested_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          shop_id?: string;
          status?: Database["public"]["Enums"]["member_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_settings: {
        Row: {
          goal_rules: Json;
          hidden_widgets: Json;
          shop_id: string;
          targets: Json;
          technician_goals: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          goal_rules?: Json;
          hidden_widgets?: Json;
          shop_id: string;
          targets?: Json;
          technician_goals?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          goal_rules?: Json;
          hidden_widgets?: Json;
          shop_id?: string;
          targets?: Json;
          technician_goals?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shop_settings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      staff_invites: {
        Row: {
          claimed_at: string | null;
          created_at: string;
          created_by: string;
          email: string;
          id: string;
          role: Database["public"]["Enums"]["member_role"];
          shop_id: string;
        };
        Insert: {
          claimed_at?: string | null;
          created_at?: string;
          created_by: string;
          email: string;
          id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          shop_id: string;
        };
        Update: {
          claimed_at?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string;
          id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_invites_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      technician_productivity: {
        Row: {
          business_date: string;
          cars: number | null;
          created_at: string;
          entered_by: string;
          hours_billed: number | null;
          hours_worked: number | null;
          id: string;
          note: string | null;
          period_scope: string | null;
          productivity_pct: number | null;
          shop_id: string;
          technician: string;
          updated_at: string;
        };
        Insert: {
          business_date: string;
          cars?: number | null;
          created_at?: string;
          entered_by: string;
          hours_billed?: number | null;
          hours_worked?: number | null;
          id?: string;
          note?: string | null;
          period_scope?: string | null;
          productivity_pct?: number | null;
          shop_id: string;
          technician: string;
          updated_at?: string;
        };
        Update: {
          business_date?: string;
          cars?: number | null;
          created_at?: string;
          entered_by?: string;
          hours_billed?: number | null;
          hours_worked?: number | null;
          id?: string;
          note?: string | null;
          period_scope?: string | null;
          productivity_pct?: number | null;
          shop_id?: string;
          technician?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "technician_productivity_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      tire_orders: {
        Row: {
          brand: string | null;
          created_at: string;
          created_by: string;
          customer_id: string | null;
          customer_name: string;
          external_ref: string | null;
          id: string;
          model: string | null;
          notes: string | null;
          phone: string | null;
          price_each: number | null;
          quantity: number;
          received_at: string | null;
          shop_id: string;
          size: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_label: string | null;
          vendor: string | null;
        };
        Insert: {
          brand?: string | null;
          created_at?: string;
          created_by: string;
          customer_id?: string | null;
          customer_name: string;
          external_ref?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          phone?: string | null;
          price_each?: number | null;
          quantity?: number;
          received_at?: string | null;
          shop_id: string;
          size?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_label?: string | null;
          vendor?: string | null;
        };
        Update: {
          brand?: string | null;
          created_at?: string;
          created_by?: string;
          customer_id?: string | null;
          customer_name?: string;
          external_ref?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          phone?: string | null;
          price_each?: number | null;
          quantity?: number;
          received_at?: string | null;
          shop_id?: string;
          size?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_label?: string | null;
          vendor?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tire_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tire_orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          created_at: string;
          customer_id: string | null;
          external_id: string | null;
          id: string;
          identity_key: string | null;
          make: string | null;
          model: string | null;
          needs_review: boolean;
          plate: string | null;
          shop_id: string;
          vin: string | null;
          year: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          external_id?: string | null;
          id?: string;
          identity_key?: string | null;
          make?: string | null;
          model?: string | null;
          needs_review?: boolean;
          plate?: string | null;
          shop_id: string;
          vin?: string | null;
          year?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          external_id?: string | null;
          id?: string;
          identity_key?: string | null;
          make?: string | null;
          model?: string | null;
          needs_review?: boolean;
          plate?: string | null;
          shop_id?: string;
          vin?: string | null;
          year?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_import_metrics: {
        Args: { p_import_id: string; p_note?: string; p_rows: Json };
        Returns: number;
      };
      accept_import_records: {
        Args: {
          p_import_id: string;
          p_kind: string;
          p_rows: Json;
          p_snapshot_date: string;
        };
        Returns: Json;
      };
      add_staff_member: {
        Args: {
          p_email: string;
          p_role?: Database["public"]["Enums"]["member_role"];
        };
        Returns: Json;
      };
      bootstrap_shop: {
        Args: { p_name: string; p_timezone?: string };
        Returns: string;
      };
      has_shop_access: {
        Args: { _shop_id: string; _user_id?: string };
        Returns: boolean;
      };
      is_owner_email: { Args: never; Returns: boolean };
      is_shop_manager: {
        Args: { _shop_id: string; _user_id?: string };
        Returns: boolean;
      };
      is_shop_owner: {
        Args: { _shop_id: string; _user_id?: string };
        Returns: boolean;
      };
      log_audit_event: {
        Args: { p_action: string; p_detail?: Json; p_target?: string };
        Returns: string;
      };
      request_shop_access: { Args: never; Returns: Json };
      save_metric_snapshot: {
        Args: {
          p_business_date: string;
          p_car_count: number;
          p_correction_note?: string;
          p_flags: Json;
          p_gross_profit: number;
          p_import_id: string;
          p_note: string;
          p_scope: Database["public"]["Enums"]["report_scope"];
          p_shop_id: string;
          p_source: Database["public"]["Enums"]["metric_source"];
          p_tires_sold: number;
        };
        Returns: string;
      };
      save_period_productivity: {
        Args: {
          p_business_date: string;
          p_correction_scope: Database["public"]["Enums"]["report_scope"];
          p_note?: string;
          p_period_scope: string;
          p_productivity_pct: number;
          p_shop_id: string;
          p_technician: string;
        };
        Returns: string;
      };
      save_shop_metrics: {
        Args: {
          p_business_date: string;
          p_car_count: number;
          p_correction_note?: string;
          p_flags: Json;
          p_gross_profit: number;
          p_import_id: string;
          p_note: string;
          p_sales: number;
          p_scope: Database["public"]["Enums"]["report_scope"];
          p_shop_id: string;
          p_source: Database["public"]["Enums"]["metric_source"];
          p_tires_sold: number;
        };
        Returns: string;
      };
    };
    Enums: {
      import_status: "uploaded" | "extracting" | "extracted" | "failed" | "accepted" | "rejected";
      member_role: "owner" | "manager" | "staff" | "display";
      member_status: "pending" | "approved" | "revoked";
      metric_source: "manual" | "import" | "api";
      report_scope: "daily" | "mtd" | "ytd" | "invoice" | "inventory" | "jobs" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      import_status: ["uploaded", "extracting", "extracted", "failed", "accepted", "rejected"],
      member_role: ["owner", "manager", "staff", "display"],
      member_status: ["pending", "approved", "revoked"],
      metric_source: ["manual", "import", "api"],
      report_scope: ["daily", "mtd", "ytd", "invoice", "inventory", "jobs", "other"],
    },
  },
} as const;

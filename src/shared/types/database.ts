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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          min_app_version: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          min_app_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          min_app_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_accounts: {
        Row: {
          balance: number
          club_id: string
          game_id: string | null
          id: string
          kind: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance?: number
          club_id: string
          game_id?: string | null
          id?: string
          kind: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance?: number
          club_id?: string
          game_id?: string | null
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chip_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_accounts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_ledger: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          created_by: string | null
          from_account: string
          from_balance_after: number
          game_id: string | null
          id: number
          kind: string
          note: string | null
          to_account: string
          to_balance_after: number
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          created_by?: string | null
          from_account: string
          from_balance_after: number
          game_id?: string | null
          id?: never
          kind: string
          note?: string | null
          to_account: string
          to_balance_after: number
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          created_by?: string | null
          from_account?: string
          from_balance_after?: number
          game_id?: string | null
          id?: never
          kind?: string
          note?: string | null
          to_account?: string
          to_balance_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "chip_ledger_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_ledger_from_account_fkey"
            columns: ["from_account"]
            isOneToOne: false
            referencedRelation: "chip_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_ledger_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_ledger_to_account_fkey"
            columns: ["to_account"]
            isOneToOne: false
            referencedRelation: "chip_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          club_id: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          club_id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          owner_id: string
          platform_share_pct: number
          rake_cap: number | null
          rake_pct: number
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          platform_share_pct?: number
          rake_cap?: number | null
          rake_pct?: number
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          platform_share_pct?: number
          rake_cap?: number | null
          rake_pct?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          consecutive_timeouts: number
          game_id: string
          payout: number
          refunded: boolean
          seat: number
          team: number | null
          user_id: string
        }
        Insert: {
          consecutive_timeouts?: number
          game_id: string
          payout?: number
          refunded?: boolean
          seat: number
          team?: number | null
          user_id: string
        }
        Update: {
          consecutive_timeouts?: number
          game_id?: string
          payout?: number
          refunded?: boolean
          seat?: number
          team?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_tables: {
        Row: {
          club_id: string
          created_at: string
          current_game_id: string | null
          id: string
          status: string
          template_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          current_game_id?: string | null
          id?: string
          status?: string
          template_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          current_game_id?: string | null
          id?: string
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_tables_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_tables_current_game_fk"
            columns: ["current_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_tables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "table_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          club_id: string
          end_reason: string | null
          entry: number
          finished_at: string | null
          hand_no: number
          id: string
          max_pip: number
          platform_rake: number
          platform_share_pct: number
          players: number
          pot: number
          rake: number
          rake_cap: number | null
          rake_pct: number
          score_team0: number
          score_team1: number
          scoring: string
          started_at: string
          status: string
          table_id: string
          target_points: number
          template_id: string
          turn_seconds: number
          winner_team: number | null
        }
        Insert: {
          club_id: string
          end_reason?: string | null
          entry: number
          finished_at?: string | null
          hand_no?: number
          id?: string
          max_pip: number
          platform_rake?: number
          platform_share_pct: number
          players: number
          pot: number
          rake?: number
          rake_cap?: number | null
          rake_pct: number
          score_team0?: number
          score_team1?: number
          scoring: string
          started_at?: string
          status?: string
          table_id: string
          target_points: number
          template_id: string
          turn_seconds: number
          winner_team?: number | null
        }
        Update: {
          club_id?: string
          end_reason?: string | null
          entry?: number
          finished_at?: string | null
          hand_no?: number
          id?: string
          max_pip?: number
          platform_rake?: number
          platform_share_pct?: number
          players?: number
          pot?: number
          rake?: number
          rake_cap?: number | null
          rake_pct?: number
          score_team0?: number
          score_team1?: number
          scoring?: string
          started_at?: string
          status?: string
          table_id?: string
          target_points?: number
          template_id?: string
          turn_seconds?: number
          winner_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "table_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hand_tiles: {
        Row: {
          hand_id: string
          seat: number
          tiles: Json
        }
        Insert: {
          hand_id: string
          seat: number
          tiles: Json
        }
        Update: {
          hand_id?: string
          seat?: number
          tiles?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hand_tiles_hand_id_fkey"
            columns: ["hand_id"]
            isOneToOne: false
            referencedRelation: "hands"
            referencedColumns: ["id"]
          },
        ]
      }
      hands: {
        Row: {
          board: Json
          finished_at: string | null
          game_id: string
          hand_no: number
          id: string
          left_end: number | null
          passes_in_row: number
          required_opening: Json | null
          result: Json | null
          right_end: number | null
          started_at: string
          starter_seat: number
          status: string
          tile_counts: number[]
          turn_deadline: string | null
          turn_seat: number
          version: number
        }
        Insert: {
          board?: Json
          finished_at?: string | null
          game_id: string
          hand_no: number
          id?: string
          left_end?: number | null
          passes_in_row?: number
          required_opening?: Json | null
          result?: Json | null
          right_end?: number | null
          started_at?: string
          starter_seat: number
          status?: string
          tile_counts: number[]
          turn_deadline?: string | null
          turn_seat: number
          version?: number
        }
        Update: {
          board?: Json
          finished_at?: string | null
          game_id?: string
          hand_no?: number
          id?: string
          left_end?: number | null
          passes_in_row?: number
          required_opening?: Json | null
          result?: Json | null
          right_end?: number | null
          started_at?: string
          starter_seat?: number
          status?: string
          tile_counts?: number[]
          turn_deadline?: string | null
          turn_seat?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hands_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          created_at: string
          hand_id: string
          id: number
          kind: string
          seat: number
          seq: number
          side: string | null
          tile: Json | null
        }
        Insert: {
          created_at?: string
          hand_id: string
          id?: never
          kind: string
          seat: number
          seq: number
          side?: string | null
          tile?: Json | null
        }
        Update: {
          created_at?: string
          hand_id?: string
          id?: never
          kind?: string
          seat?: number
          seq?: number
          side?: string | null
          tile?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "moves_hand_id_fkey"
            columns: ["hand_id"]
            isOneToOne: false
            referencedRelation: "hands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      table_seats: {
        Row: {
          is_ready: boolean
          joined_at: string
          seat: number
          table_id: string
          user_id: string
        }
        Insert: {
          is_ready?: boolean
          joined_at?: string
          seat: number
          table_id: string
          user_id: string
        }
        Update: {
          is_ready?: boolean
          joined_at?: string
          seat?: number
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_seats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      table_templates: {
        Row: {
          club_id: string
          created_at: string
          entry: number
          format: string
          id: string
          is_active: boolean
          max_pip: number
          mode: string
          name: string
          scoring: string
          sort_order: number
          target_points: number
          turn_seconds: number
        }
        Insert: {
          club_id: string
          created_at?: string
          entry: number
          format?: string
          id?: string
          is_active?: boolean
          max_pip?: number
          mode?: string
          name: string
          scoring?: string
          sort_order?: number
          target_points?: number
          turn_seconds?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          entry?: number
          format?: string
          id?: string
          is_active?: boolean
          max_pip?: number
          mode?: string
          name?: string
          scoring?: string
          sort_order?: number
          target_points?: number
          turn_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _cancel_game: {
        Args: {
          p_actor: string
          p_except_user: string
          p_game: string
          p_reason: string
        }
        Returns: undefined
      }
      _club_account: {
        Args: { p_club: string; p_kind: string }
        Returns: string
      }
      _player_account: {
        Args: { p_club: string; p_user: string }
        Returns: string
      }
      _player_balance: {
        Args: { p_club: string; p_user: string }
        Returns: number
      }
      _post_chips: {
        Args: {
          p_actor?: string
          p_amount: number
          p_from: string
          p_game?: string
          p_kind: string
          p_note?: string
          p_to: string
        }
        Returns: number
      }
      assert_active_user: { Args: never; Returns: string }
      assert_club_admin: { Args: { p_club: string }; Returns: string }
      assert_platform: { Args: never; Returns: string }
      cancel_game_first_hand_abandon: {
        Args: { p_game: string; p_leaver: string }
        Returns: undefined
      }
      chip_audit: {
        Args: never
        Returns: {
          account_id: string
          actual: number
          club_id: string
          expected: number
          problem: string
        }[]
      }
      club_adjust_chips: {
        Args: {
          p_amount: number
          p_club: string
          p_note: string
          p_user: string
        }
        Returns: number
      }
      club_assign_chips: {
        Args: {
          p_amount: number
          p_club: string
          p_note?: string
          p_user: string
        }
        Returns: number
      }
      club_cancel_game: { Args: { p_game: string }; Returns: undefined }
      club_report: {
        Args: { p_club: string; p_from: string; p_to: string }
        Returns: {
          cancelled_games: number
          chips_assigned: number
          chips_issued: number
          chips_withdrawn: number
          games: number
          platform_rake_total: number
          pot_total: number
          rake_total: number
        }[]
      }
      club_review_member: {
        Args: { p_approve: boolean; p_club: string; p_user: string }
        Returns: undefined
      }
      club_set_member_role: {
        Args: { p_club: string; p_role: string; p_user: string }
        Returns: undefined
      }
      club_set_member_status: {
        Args: { p_club: string; p_status: string; p_user: string }
        Returns: undefined
      }
      club_update_rake: {
        Args: { p_club: string; p_rake_cap: number; p_rake_pct: number }
        Returns: undefined
      }
      club_withdraw_chips: {
        Args: {
          p_amount: number
          p_club: string
          p_note?: string
          p_user: string
        }
        Returns: number
      }
      find_club: {
        Args: { p_code: string }
        Returns: {
          club_id: string
          club_name: string
          members: number
        }[]
      }
      finish_game: {
        Args: { p_game: string; p_reason: string; p_winner_team: number }
        Returns: boolean
      }
      is_club_admin: { Args: { p_club: string }; Returns: boolean }
      is_club_member: { Args: { p_club: string }; Returns: boolean }
      is_platform: { Args: never; Returns: boolean }
      join_table: {
        Args: { p_template: string }
        Returns: {
          joined_seat: number
          joined_table_id: string
        }[]
      }
      leave_table: { Args: never; Returns: undefined }
      platform_create_club: {
        Args: {
          p_name: string
          p_owner: string
          p_rake_cap?: number
          p_rake_pct?: number
        }
        Returns: string
      }
      platform_find_user: {
        Args: { p_email: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      platform_issue_chips: {
        Args: { p_amount: number; p_club: string; p_note?: string }
        Returns: number
      }
      platform_set_club_status: {
        Args: { p_club: string; p_status: string }
        Returns: undefined
      }
      platform_set_user_status: {
        Args: { p_status: string; p_user: string }
        Returns: undefined
      }
      platform_update_settings: {
        Args: { p_min_app_version: string }
        Returns: undefined
      }
      request_join_club: { Args: { p_code: string }; Returns: string }
      save_move: {
        Args: {
          p_expected_version: number
          p_hand: string
          p_kind: string
          p_seat: number
          p_seat_tiles: Json
          p_side: string
          p_state: Json
          p_tile: Json
          p_timeouts: number
        }
        Returns: boolean
      }
      save_new_hand: {
        Args: {
          p_game: string
          p_required_opening: Json
          p_starter: number
          p_tiles: Json
        }
        Returns: string
      }
      set_ready: { Args: { p_ready: boolean }; Returns: undefined }
      start_game: { Args: { p_table: string }; Returns: string }
      table_capacity: { Args: { p_format: string }; Returns: number }
      update_my_display_name: { Args: { p_name: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

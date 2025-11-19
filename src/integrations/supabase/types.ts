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
    PostgrestVersion: "13.0.5"
  }
  sistemaretiradas: {
    Tables: {
      adiantamentos: {
        Row: {
          aprovado_por_id: string | null
          colaboradora_id: string
          created_at: string | null
          data_aprovacao: string | null
          data_desconto: string | null
          data_solicitacao: string
          descontado_por_id: string | null
          id: string
          mes_competencia: string
          motivo_recusa: string | null
          observacoes: string | null
          status: Database["sistemaretiradas"]["Enums"]["status_adiantamento"]
          updated_at: string | null
          valor: number
        }
        Insert: {
          aprovado_por_id?: string | null
          colaboradora_id: string
          created_at?: string | null
          data_aprovacao?: string | null
          data_desconto?: string | null
          data_solicitacao?: string
          descontado_por_id?: string | null
          id?: string
          mes_competencia: string
          motivo_recusa?: string | null
          observacoes?: string | null
          status?: Database["sistemaretiradas"]["Enums"]["status_adiantamento"]
          updated_at?: string | null
          valor: number
        }
        Update: {
          aprovado_por_id?: string | null
          colaboradora_id?: string
          created_at?: string | null
          data_aprovacao?: string | null
          data_desconto?: string | null
          data_solicitacao?: string
          descontado_por_id?: string | null
          id?: string
          mes_competencia?: string
          motivo_recusa?: string | null
          observacoes?: string | null
          status?: Database["sistemaretiradas"]["Enums"]["status_adiantamento"]
          updated_at?: string | null
          valor?: number
        }
        Relationships: []
      }
      audit: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          entity: string
          entity_id: string
          executed_at: string | null
          executed_by_id: string
          id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          entity: string
          entity_id: string
          executed_at?: string | null
          executed_by_id: string
          id?: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          entity?: string
          entity_id?: string
          executed_at?: string | null
          executed_by_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_executed_by_id_fkey"
            columns: ["executed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas: {
        Row: {
          baixado_por_id: string | null
          competencia: string
          compra_id: string
          created_at: string | null
          data_baixa: string | null
          id: string
          motivo_estorno: string | null
          n_parcela: number
          status_parcela: Database["sistemaretiradas"]["Enums"]["status_parcela"] | null
          updated_at: string | null
          valor_parcela: number
        }
        Insert: {
          baixado_por_id?: string | null
          competencia: string
          compra_id: string
          created_at?: string | null
          data_baixa?: string | null
          id?: string
          motivo_estorno?: string | null
          n_parcela: number
          status_parcela?: Database["sistemaretiradas"]["Enums"]["status_parcela"] | null
          updated_at?: string | null
          valor_parcela: number
        }
        Update: {
          baixado_por_id?: string | null
          competencia?: string
          compra_id?: string
          created_at?: string | null
          data_baixa?: string | null
          id?: string
          motivo_estorno?: string | null
          n_parcela?: number
          status_parcela?: Database["sistemaretiradas"]["Enums"]["status_parcela"] | null
          updated_at?: string | null
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_baixado_por_id_fkey"
            columns: ["baixado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          limite_mensal: number
          limite_total: number
          name: string
          role: Database["sistemaretiradas"]["Enums"]["app_role"]
          store_default: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          cpf?: string | null
          created_at?: string | null
          email: string
          id: string
          limite_mensal?: number
          limite_total?: number
          name: string
          role: Database["sistemaretiradas"]["Enums"]["app_role"]
          store_default?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          limite_mensal?: number
          limite_total?: number
          name?: string
          role?: Database["sistemaretiradas"]["Enums"]["app_role"]
          store_default?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          colaboradora_id: string
          created_at: string | null
          created_by_id: string
          data_compra: string
          desconto_beneficio: number
          id: string
          item: string
          loja_id: string
          num_parcelas: number
          observacoes: string | null
          preco_final: number
          preco_venda: number
          status_compra: Database["sistemaretiradas"]["Enums"]["status_compra"] | null
          updated_at: string | null
        }
        Insert: {
          colaboradora_id: string
          created_at?: string | null
          created_by_id: string
          data_compra: string
          desconto_beneficio: number
          id?: string
          item: string
          loja_id: string
          num_parcelas: number
          observacoes?: string | null
          preco_final: number
          preco_venda: number
          status_compra?: Database["sistemaretiradas"]["Enums"]["status_compra"] | null
          updated_at?: string | null
        }
        Update: {
          colaboradora_id?: string
          created_at?: string | null
          created_by_id?: string
          data_compra?: string
          desconto_beneficio?: number
          id?: string
          item?: string
          loja_id?: string
          num_parcelas?: number
          observacoes?: string | null
          preco_final?: number
          preco_venda?: number
          status_compra?: Database["sistemaretiradas"]["Enums"]["status_compra"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_colaboradora_id_fkey"
            columns: ["colaboradora_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["sistemaretiradas"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "ADMIN" | "COLABORADORA"
      status_adiantamento: "PENDENTE" | "APROVADO" | "RECUSADO" | "DESCONTADO"
      status_compra: "PENDENTE" | "PARCIAL" | "PAGO" | "CANCELADO"
      status_parcela:
      | "PENDENTE"
      | "AGENDADO"
      | "DESCONTADO"
      | "ESTORNADO"
      | "CANCELADO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "sistemaretiradas">]

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
  sistemaretiradas: {
    Enums: {
      app_role: ["ADMIN", "COLABORADORA"],
      status_adiantamento: ["PENDENTE", "APROVADO", "RECUSADO", "DESCONTADO"],
      status_compra: ["PENDENTE", "PARCIAL", "PAGO", "CANCELADO"],
      status_parcela: [
        "PENDENTE",
        "AGENDADO",
        "DESCONTADO",
        "ESTORNADO",
        "CANCELADO",
      ],
    },
  },
} as const

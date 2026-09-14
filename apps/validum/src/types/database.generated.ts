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
      affiliate_documents: {
        Row: {
          beneficiary_id: string | null
          category: string
          content_type: string
          created_at: string
          document_id: string
          employee_id: string
          organization_id: string
          original_name: string
          row_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          beneficiary_id?: string | null
          category: string
          content_type: string
          created_at?: string
          document_id: string
          employee_id: string
          organization_id: string
          original_name: string
          row_id?: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          beneficiary_id?: string | null
          category?: string
          content_type?: string
          created_at?: string
          document_id?: string
          employee_id?: string
          organization_id?: string
          original_name?: string
          row_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_documents_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "employee_id"]
          },
          {
            foreignKeyName: "affiliate_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          beneficiary_id: string
          created_at: string
          data: Json
          document_number: string
          document_type: string
          employee_id: string
          first_name: string
          first_surname: string
          middle_name: string | null
          organization_id: string
          relationship: string
          row_id: string
          second_surname: string | null
          updated_at: string
        }
        Insert: {
          beneficiary_id: string
          created_at?: string
          data?: Json
          document_number: string
          document_type: string
          employee_id: string
          first_name: string
          first_surname: string
          middle_name?: string | null
          organization_id: string
          relationship: string
          row_id?: string
          second_surname?: string | null
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string
          created_at?: string
          data?: Json
          document_number?: string
          document_type?: string
          employee_id?: string
          first_name?: string
          first_surname?: string
          middle_name?: string | null
          organization_id?: string
          relationship?: string
          row_id?: string
          second_surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "employee_id"]
          },
          {
            foreignKeyName: "beneficiaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          data: Json
          department: string | null
          document_number: string
          document_type: string
          email: string | null
          legal_name: string
          organization_id: string
          phone: string | null
          row_id: string
          trade_name: string | null
          updated_at: string
          verification_digit: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          data?: Json
          department?: string | null
          document_number: string
          document_type?: string
          email?: string | null
          legal_name: string
          organization_id: string
          phone?: string | null
          row_id?: string
          trade_name?: string | null
          updated_at?: string
          verification_digit?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          data?: Json
          department?: string | null
          document_number?: string
          document_type?: string
          email?: string | null
          legal_name?: string
          organization_id?: string
          phone?: string | null
          row_id?: string
          trade_name?: string | null
          updated_at?: string
          verification_digit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string | null
          created_at: string
          data: Json
          document_number: string
          document_type: string
          email: string | null
          employee_id: string
          eps_name: string | null
          first_name: string
          first_surname: string
          middle_name: string | null
          organization_id: string
          phone: string | null
          row_id: string
          second_surname: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data?: Json
          document_number: string
          document_type: string
          email?: string | null
          employee_id: string
          eps_name?: string | null
          first_name: string
          first_surname: string
          middle_name?: string | null
          organization_id: string
          phone?: string | null
          row_id?: string
          second_surname?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data?: Json
          document_number?: string
          document_type?: string
          email?: string | null
          employee_id?: string
          eps_name?: string | null
          first_name?: string
          first_surname?: string
          middle_name?: string | null
          organization_id?: string
          phone?: string | null
          row_id?: string
          second_surname?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_company_id_fkey"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "company_id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          entity_name: string
          entity_type: string
          fields: Json
          form_type: string
          layout_fingerprint: string | null
          mapping_status: string
          name: string
          organization_id: string
          page_count: number
          page_sizes: Json | null
          pdf_storage_path: string | null
          row_id: string
          template_id: string
          thumbnail_storage_path: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          definition?: Json
          description?: string | null
          entity_name: string
          entity_type: string
          fields?: Json
          form_type: string
          layout_fingerprint?: string | null
          mapping_status?: string
          name: string
          organization_id: string
          page_count: number
          page_sizes?: Json | null
          pdf_storage_path?: string | null
          row_id?: string
          template_id: string
          thumbnail_storage_path?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          entity_name?: string
          entity_type?: string
          fields?: Json
          form_type?: string
          layout_fingerprint?: string | null
          mapping_status?: string
          name?: string
          organization_id?: string
          page_count?: number
          page_sizes?: Json | null
          pdf_storage_path?: string | null
          row_id?: string
          template_id?: string
          thumbnail_storage_path?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_forms: {
        Row: {
          employee_id: string | null
          employee_name: string
          generated_at: string
          generated_form_id: string
          manual_fields: Json
          organization_id: string
          pdf_storage_path: string
          procedure_fields: Json
          row_id: string
          source_pdf_file_name: string | null
          template_id: string | null
          template_name: string
        }
        Insert: {
          employee_id?: string | null
          employee_name: string
          generated_at?: string
          generated_form_id: string
          manual_fields?: Json
          organization_id: string
          pdf_storage_path: string
          procedure_fields?: Json
          row_id?: string
          source_pdf_file_name?: string | null
          template_id?: string | null
          template_name: string
        }
        Update: {
          employee_id?: string | null
          employee_name?: string
          generated_at?: string
          generated_form_id?: string
          manual_fields?: Json
          organization_id?: string
          pdf_storage_path?: string
          procedure_fields?: Json
          row_id?: string
          source_pdf_file_name?: string | null
          template_id?: string | null
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_forms_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "employee_id"]
          },
          {
            foreignKeyName: "generated_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_forms_organization_id_template_id_fkey"
            columns: ["organization_id", "template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["organization_id", "template_id"]
          },
        ]
      }
      novelties: {
        Row: {
          created_at: string
          data: Json
          employee_id: string
          end_date: string | null
          novelty_id: string
          novelty_type: string
          organization_id: string
          row_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          employee_id: string
          end_date?: string | null
          novelty_id: string
          novelty_type: string
          organization_id: string
          row_id?: string
          start_date: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          employee_id?: string
          end_date?: string | null
          novelty_id?: string
          novelty_type?: string
          organization_id?: string
          row_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "novelties_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["organization_id", "employee_id"]
          },
          {
            foreignKeyName: "novelties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          active: boolean
          created_at: string
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          organization_id: string
          revoked_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          active?: boolean
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          organization_id: string
          revoked_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          active?: boolean
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          organization_id?: string
          revoked_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pila_forms: {
        Row: {
          created_at: string
          data: Json
          form_id: string
          form_number: string
          organization_id: string
          payment_status: string
          period: string
          row_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id: string
          form_number: string
          organization_id: string
          payment_status: string
          period: string
          row_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: string
          form_number?: string
          organization_id?: string
          payment_status?: string
          period?: string
          row_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pila_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      soporte_documentos: {
        Row: {
          categoria: string
          created_at: string
          employee_id: string | null
          id: string
          metadata: Json
          nombre: string
          organization_id: string | null
          owner_id: string | null
          storage_path: string
          tamano_bytes: number
          tipo_archivo: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          metadata?: Json
          nombre: string
          organization_id?: string | null
          owner_id?: string | null
          storage_path: string
          tamano_bytes?: number
          tipo_archivo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          metadata?: Json
          nombre?: string
          organization_id?: string | null
          owner_id?: string | null
          storage_path?: string
          tamano_bytes?: number
          tipo_archivo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soporte_documentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_presets: {
        Row: {
          created_at: string
          definition: Json
          name: string
          organization_id: string
          row_id: string
          stamp_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition: Json
          name: string
          organization_id: string
          row_id?: string
          stamp_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: Json
          name?: string
          organization_id?: string
          row_id?: string
          stamp_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamp_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          active_company_id: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_company_id?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_company_id?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_owner: {
        Args: { organization_name: string }
        Returns: string
      }
      revoke_organization_member: {
        Args: { target_organization_id: string; target_user_id: string }
        Returns: undefined
      }
      set_organization_member_role: {
        Args: {
          new_role: string
          target_organization_id: string
          target_user_id: string
        }
        Returns: undefined
      }
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


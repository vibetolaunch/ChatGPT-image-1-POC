export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          email: string
          name: string | null
        }
        Insert: {
          id: string
          created_at?: string
          email: string
          name?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          email?: string
          name?: string | null
        }
      }
      images: {
        Row: {
          id: string
          user_id: string
          storage_path: string
          file_name: string
          file_size: number
          mime_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          storage_path: string
          file_name: string
          file_size: number
          mime_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          storage_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          created_at?: string
          updated_at?: string
        }
      }
      image_edits: {
        Row: {
          id: string
          user_id: string
          original_image_id: string
          edited_image_url: string
          prompt: string
          mask_data: string | null
          model_used: string
          model_version: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_image_id: string
          edited_image_url: string
          prompt: string
          mask_data?: string | null
          model_used?: string
          model_version?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          original_image_id?: string
          edited_image_url?: string
          prompt?: string
          mask_data?: string | null
          model_used?: string
          model_version?: string
          created_at?: string
        }
      }
    }
    Views: {
      // Define database views here
    }
    Functions: {
      // Define database functions here
    }
    Enums: {
      // Define your enums here
    }
  }
}

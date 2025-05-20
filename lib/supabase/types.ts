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
      // Add other tables as needed
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
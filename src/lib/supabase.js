import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ebvwiwdefecaxfmnfppz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidndpd2RlZmVjYXhmbW5mcHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzExMzQsImV4cCI6MjA5MDkwNzEzNH0.Ubukxfc3CvbpLqfyDxEgQLHr5KIiWLgHVoGOYp1fGrA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

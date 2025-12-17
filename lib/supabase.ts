import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function getImageUrl(path: string) {
  const { data } = supabase.storage.from('mockups').getPublicUrl(path)
  return data.publicUrl
}

export interface Client {
  id: string
  name: string
  token: string
  created_at: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  token: string
  created_at: string
  updated_at: string
}

export interface Screen {
  id: string
  project_id: string
  name: string
  sort_order: number
  desktop_image?: string
  mobile_image?: string
  created_at: string
}

export interface Comment {
  id: string
  screen_id: string
  parent_id?: string
  x_position: number
  y_position: number
  device_type: 'desktop' | 'mobile'
  author_name: string
  content: string
  is_resolved: boolean
  created_at: string
}

export interface Vote {
  id: string
  screen_id: string
  voter_name: string
  created_at: string
}

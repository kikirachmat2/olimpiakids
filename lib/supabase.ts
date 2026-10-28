import { createBrowserClient, createServerClient as createSsrServerClient } from '@supabase/ssr'

function getValidSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'))

  return {
    supabaseUrl: isValidUrl ? url : 'https://placeholder-lomba-bayi.supabase.co',
    supabaseAnonKey: key && key !== 'your_anon_key_here' ? key : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder-anon-key',
  }
}

/**
 * Client Supabase untuk Client Component (Browser)
 */
export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getValidSupabaseConfig()
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Singleton client browser untuk pemakaian praktis di komponen klien
 */
export const supabase = createBrowserSupabaseClient()

/**
 * Client Supabase untuk Server Component / Server Actions
 */
export function createServerSupabaseClient(cookieStore?: {
  getAll: () => { name: string; value: string }[]
  setAll?: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void
}) {
  const { supabaseUrl, supabaseAnonKey } = getValidSupabaseConfig()
  return createSsrServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore ? cookieStore.getAll() : []
      },
      setAll(cookiesToSet) {
        if (cookieStore?.setAll) {
          cookieStore.setAll(cookiesToSet)
        }
      },
    },
  })
}

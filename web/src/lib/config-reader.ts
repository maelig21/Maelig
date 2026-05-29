/**
 * Config Reader DEP Électrique
 * Lit la configuration depuis Supabase app_config['dep_electrique']
 * 
 * Toute config business DOIT être lue via ce module, PAS hardcodée.
 * Centralise admin_emails, cron settings, défauts métier.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'

let configCache: any = null
let configLoadedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000

export async function loadDepConfig(): Promise<any> {
  const now = Date.now()
  if (configCache && (now - configLoadedAt) < CACHE_TTL_MS) {
    return configCache
  }
  
  try {
    const sb: any = supabaseAdmin()
    const { data, error } = await sb
      .from('app_config')
      .select('config')
      .eq('id', 'dep_electrique')
      .single()
    
    if (error) {
      console.error('[CONFIG-DEP] Erreur chargement:', error)
      return configCache || {}
    }
    
    configCache = data?.config || {}
    configLoadedAt = now
    return configCache
  } catch (e) {
    console.error('[CONFIG-DEP] Exception:', e)
    return configCache || {}
  }
}

export async function depConfig<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  const c = await loadDepConfig()
  return c?.[key] ?? defaultValue
}

export async function getAdminEmails(): Promise<string[]> {
  return (await depConfig<string[]>('admin_emails', [])) || []
}

export function invalidateDepConfig(): void {
  configCache = null
  configLoadedAt = 0
}

// main-entry.js — punto de entrada Vite
import { createClient } from '@supabase/supabase-js'

// Exponer igual que hacía el CDN: window.supabase.createClient
window.supabase = { createClient }

// Módulos del proyecto (orden importante: datos primero, auth después)
import './js/main.js'
import './auth.js'

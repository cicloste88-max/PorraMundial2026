"""
patch_fix_auth_lazy_db.py
Convierte la inicializacion de db en auth.js a lazy (se inicializa
cuando se necesita, no al cargar el script) para resolver el problema
de orden de carga con el modulo ES de Vite.
Ejecutar desde la raiz del proyecto:
    python patch_fix_auth_lazy_db.py
"""
import shutil, sys
from pathlib import Path

SRC = Path('js/auth.js')
if not SRC.exists():
    print(f'ERROR: no se encuentra {SRC}')
    sys.exit(1)

shutil.copy(SRC, SRC.with_name('auth.js.bak'))
print('Backup creado: js/auth.js.bak')

content = SRC.read_text(encoding='utf-8')

OLD = """const db = window._porraDb || (window._porraDb = window.supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: { storageKey: 'porra_auth', persistSession: false, autoRefreshToken: true }
}));"""

NEW = """// Inicializacion lazy de db — espera a que window.supabase este disponible
function getDb() {
  if (!window._porraDb) {
    window._porraDb = window.supabase.createClient(SUPA_URL, SUPA_ANON, {
      auth: { storageKey: 'porra_auth', persistSession: false, autoRefreshToken: true }
    });
  }
  return window._porraDb;
}
const db = new Proxy({}, {
  get(_, prop) { return getDb()[prop]; }
});
window._porraDb = window._porraDb || null;"""

if OLD not in content:
    print('ERROR: no se encontro el patron exacto. Revisando...')
    # Busqueda alternativa
    if 'window.supabase.createClient' in content:
        print('  -> window.supabase.createClient encontrado pero en formato diferente.')
        print('  -> Revisa js/auth.js manualmente cerca de esa linea.')
    sys.exit(1)

content_fixed = content.replace(OLD, NEW, 1)
SRC.write_text(content_fixed, encoding='utf-8')
print('OK: db inicializado de forma lazy.')
print('OK: js/auth.js actualizado.')

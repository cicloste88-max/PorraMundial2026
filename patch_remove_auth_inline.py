"""
patch_remove_auth_inline.py
Elimina el bloque <script> inline de auth del index.html
Ejecutar desde la raíz del proyecto:
    python patch_remove_auth_inline.py
"""
import re, shutil, sys
from pathlib import Path

SRC = Path('index.html')

if not SRC.exists():
    print('ERROR: no se encuentra index.html — ejecuta desde la raíz del proyecto')
    sys.exit(1)

# Backup de seguridad
shutil.copy(SRC, SRC.with_suffix('.html.bak'))
print(f'Backup creado: {SRC.with_suffix(".html.bak")}')

html = SRC.read_text(encoding='utf-8')
original_len = len(html)

# Marca de inicio: el comentario del bloque auth + su <script>
START_MARKER = '<!-- ═══════════════════════════════════════════════════════════════\n     JS · MÓDULO AUTH + SESIÓN'
# Marca de fin: el </script> que cierra ese bloque
# Identificamos el bloque buscando desde el START hasta el primer </script> tras él
idx_start = html.find(START_MARKER)
if idx_start == -1:
    print('ERROR: no se encontró el marcador de inicio del bloque auth inline.')
    print('El fichero puede haber cambiado. Revisa manualmente.')
    sys.exit(1)

# Buscar el </script> de cierre a partir de idx_start
idx_script_open = html.find('<script>', idx_start)
if idx_script_open == -1:
    print('ERROR: no se encontró el <script> tras el comentario auth.')
    sys.exit(1)

idx_script_close = html.find('</script>', idx_script_open)
if idx_script_close == -1:
    print('ERROR: no se encontró el </script> de cierre del bloque auth.')
    sys.exit(1)

# El bloque a eliminar: desde el comentario hasta </script> (inclusive, + newline)
end = idx_script_close + len('</script>')
# Avanzar hasta el siguiente \n si lo hay
if end < len(html) and html[end] == '\n':
    end += 1

bloque = html[idx_start:end]
print(f'\nBloque a eliminar ({len(bloque.splitlines())} líneas):')
print('  INICIO:', bloque[:80].replace('\n', '↵'))
print('  FIN:   ', bloque[-80:].replace('\n', '↵'))

html_new = html[:idx_start] + html[end:]
SRC.write_text(html_new, encoding='utf-8')

print(f'\n✓ Eliminado. {original_len} → {len(html_new)} chars ({original_len - len(html_new)} eliminados)')
print('✓ index.html actualizado.')

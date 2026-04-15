"""
patch_remove_leagues_inline.py
Elimina el bloque <script> inline de leagues del index.html
Ejecutar desde la raíz del proyecto:
    python patch_remove_leagues_inline.py
"""
import shutil, sys
from pathlib import Path

SRC = Path('index.html')
if not SRC.exists():
    print('ERROR: no se encuentra index.html — ejecuta desde la raíz del proyecto')
    sys.exit(1)

shutil.copy(SRC, SRC.with_suffix('.html.bak'))
print(f'Backup creado: {SRC.with_suffix(".html.bak")}')

html = SRC.read_text(encoding='utf-8')
original_len = len(html)

START_MARKER = '<!-- ═══════════════════════════════════════════════════════════════\n     JS · MÓDULO LIGAS'
idx_start = html.find(START_MARKER)
if idx_start == -1:
    print('ERROR: no se encontró el marcador de inicio del bloque leagues inline.')
    sys.exit(1)

idx_script_open = html.find('<script>', idx_start)
if idx_script_open == -1:
    print('ERROR: no se encontró el <script> tras el comentario leagues.')
    sys.exit(1)

idx_script_close = html.find('</script>', idx_script_open)
if idx_script_close == -1:
    print('ERROR: no se encontró el </script> de cierre del bloque leagues.')
    sys.exit(1)

end = idx_script_close + len('</script>')
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

"""
patch_fix_main_comment.py
Arregla el comentario anidado en js/main.js que rompe el parser de Vite.
Ejecutar desde la raíz del proyecto:
    python patch_fix_main_comment.py
"""
import shutil, sys
from pathlib import Path

SRC = Path('js/main.js')
if not SRC.exists():
    print(f'ERROR: no se encuentra {SRC}')
    sys.exit(1)

shutil.copy(SRC, SRC.with_suffix('.js.bak'))
print(f'Backup creado: {SRC.with_suffix(".js.bak")}')

content = SRC.read_text(encoding='utf-8')

# Reemplazar el comentario problemático con uno limpio
OLD = '''/* main.js — Porra Mundial 2026 (módulo principal — subdividido)
   Contiene los sub-bloques: data.js + scoring.js + ui-groups.js + ko.js + ui-nav.js
   Ver cabeceras internas /* js-* */ para delimitación de cada sub-bloque.
   Líneas: ~3241
*/'''

NEW = '''/* main.js — Porra Mundial 2026 (módulo principal — subdividido)
   Contiene los sub-bloques: data.js + scoring.js + ui-groups.js + ko.js + ui-nav.js
   Ver cabeceras internas (js-data, js-scoring, js-ui-groups, js-ko, js-ui-nav)
   Líneas: ~3241
*/'''

if OLD not in content:
    print('AVISO: comentario original no encontrado — puede que ya esté corregido.')
    print('Revisando si hay comentarios anidados...')
    # Búsqueda alternativa más flexible
    import re
    fixed = re.sub(r'/\*([^*]|\*(?!/))*?/\*[^*]*?\*/([^*]|\*(?!/))*?\*/', 
                   lambda m: m.group(0).replace('/*', '/ *').replace('*/', '* /'),
                   content, count=1)
    if fixed != content:
        SRC.write_text(fixed, encoding='utf-8')
        print('✓ Comentario anidado corregido (método regex).')
    else:
        print('No se encontraron comentarios anidados. El fichero parece correcto.')
    sys.exit(0)

content_fixed = content.replace(OLD, NEW, 1)
SRC.write_text(content_fixed, encoding='utf-8')
print('✓ Comentario anidado corregido.')
print('✓ js/main.js actualizado.')

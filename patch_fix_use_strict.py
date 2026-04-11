"""
patch_fix_use_strict.py
Elimina 'use strict' de js/main.js (innecesario en módulos ES y rompe Vite 8).
Ejecutar desde la raíz del proyecto:
    python patch_fix_use_strict.py
"""
import shutil, sys
from pathlib import Path

SRC = Path('js/main.js')
if not SRC.exists():
    print(f'ERROR: no se encuentra {SRC}')
    sys.exit(1)

shutil.copy(SRC, SRC.with_name('main.js.bak2'))
print(f'Backup creado: js/main.js.bak2')

content = SRC.read_text(encoding='utf-8')

if "'use strict';" not in content:
    print('AVISO: use strict no encontrado — puede que ya esté eliminado.')
    sys.exit(0)

content_fixed = content.replace("'use strict';", "// (use strict eliminado — módulos ES son strict por defecto)", 1)
SRC.write_text(content_fixed, encoding='utf-8')
print('✓ use strict eliminado.')
print('✓ js/main.js actualizado.')

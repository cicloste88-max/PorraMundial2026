"""
patch_fix_main_encoding.py
Convierte js/main.js a UTF-8 LF y limpia el comentario de cabecera
que contiene caracteres Unicode problematicos para Vite 8.
Ejecutar desde la raiz del proyecto:
    python patch_fix_main_encoding.py
"""
import shutil, sys
from pathlib import Path

SRC = Path('js/main.js')
if not SRC.exists():
    print(f'ERROR: no se encuentra {SRC}')
    sys.exit(1)

shutil.copy(SRC, SRC.with_name('main.js.bak3'))
print('Backup creado: js/main.js.bak3')

# Leer con deteccion automatica de encoding
content = SRC.read_bytes()

# Decodificar (puede ser UTF-8 con BOM o latin-1)
for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
    try:
        text = content.decode(enc)
        print(f'Decodificado como: {enc}')
        break
    except:
        continue

# Normalizar CRLF -> LF
text = text.replace('\r\n', '\n').replace('\r', '\n')

# Reemplazar el comentario de cabecera problematico por uno limpio ASCII
import re
text = re.sub(
    r'^/\*.*?main\.js.*?\*/',
    '/* main.js - Porra Mundial 2026 (modulo principal)\n   Sub-bloques: data, scoring, ui-groups, ko, ui-nav\n*/',
    text,
    count=1,
    flags=re.DOTALL
)

# Asegurarse de que no hay 'use strict' (ya lo quitamos antes pero por si acaso)
text = text.replace("'use strict';", '')
text = text.replace('"use strict";', '')

# Escribir como UTF-8 puro con LF
SRC.write_text(text, encoding='utf-8', newline='\n')
print('Convertido a UTF-8 LF.')
print('Comentario de cabecera limpiado.')
print('OK: js/main.js listo para Vite 8.')

---
description: Reglas para coordinar Code remoto (container Anthropic) ↔ filesystem local de San (multi-agent sync)
globs:
  - "index.html"
  - "public/**"
  - "js/**"
  - "docs/**"
  - "supabase/**"
  - "apify-actors/**"
  - ".claude/rules/**"
  - "CLAUDE.md"
  - "migration-log.md"
---

# Reglas — Multi-agent sync (Code ↔ San)

## Cuándo se carga esta regla

Esta regla aplica en **toda sesión** donde Code edite ficheros del repositorio Porra Mundial 2026. Cualquier sesión que toque `index.html`, `public/**`, `js/**`, docs, edge functions, actors, reglas o el propio `CLAUDE.md` la auto-carga. Su objetivo es prevenir desincronías entre el Code remoto (que ejecuta en container Anthropic) y el filesystem local de San (donde corre Vite y se hace smoke).

Origen: issue #27 — situaciones de desincronía vividas en F7.4-A (smoke con código stale), F7.4-B (smoke tras push aparente sin recargar Vite) y F7.4-C (reanudación post-merge con branch antigua), todas con la misma raíz: filesystem local desincronizado del remote.

## 1 · Quién edita y dónde

Code edita, commitea y pushea **siempre desde el container remoto Anthropic**. El filesystem local de San es solo lectura desde el punto de vista de Code: nunca se asume que un fichero local refleja el estado del repo.

Corolario: si San reporta haber hecho un cambio manual local, Code debe **pedirle que lo commitee y pushee** antes de razonar sobre él. No leer estado local indirectamente vía descripciones de San.

## 2 · Push inmediato tras cada commit

Tras cada `git commit`, Code ejecuta `git push origin <branch>` **inmediatamente**. Nunca se acumulan commits sin push. Razón: el filesystem local de San solo se actualiza vía `git pull`, y un commit no pusheado no existe para nadie excepto el container.

Esta regla ya está formalizada en `CLAUDE.md` § Reglas CRÍTICAS ("Push inmediato tras cada commit — nunca acumular"). Aquí se reafirma con la justificación operativa.

## 3 · Sincronización en local de San tras cada push

Cuando Code anuncia "pushed (`<sha>`)", San ejecuta los **3 pasos obligatorios**:

1. `git pull origin <branch>` (en la branch correcta — ver §5).
2. **Reiniciar Vite**: `Ctrl+C` en el terminal del dev server, luego `npm run dev`.
3. **Hard-reload** del navegador: `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (macOS).

**Razón crítica**: solo `git pull` + hard-reload del navegador NO basta. Vite cachea módulos transformados en memoria entre HMRs (Hot Module Replacement) y a veces sirve código stale incluso tras tocar disco. El reinicio del dev server vacía esa caché. Saltarse este paso produce el síntoma "el git log dice que el cambio está, pero la UI no lo refleja".

## 4 · Detección de desincronía

Si San reporta "no veo el cambio" o "veo comportamiento que no encaja con el último commit", **antes de redactar otro patch**, Code verifica:

- **HEAD remoto del branch que San mira**: vía GitHub API o `git fetch && git log origin/<branch> --oneline -3`.
- **HEAD local de San**: pedirle a San `git log --oneline -3` en su filesystem.

Si los HEADs difieren → es un problema de sincronía, no de código. La acción correcta es ejecutar el §3 de nuevo (no bordear con cambios adicionales que solo enmascaran el desfase).

Si los HEADs coinciden y el síntoma persiste → entonces sí es código y procede investigación normal.

## 5 · Cambio de fase (branch nueva)

Cuando Code arranca una nueva fase y crea un branch nuevo (`claude/<descriptivo>-<sufijo>`):

1. Code crea + commitea + pushea desde el container.
2. San cambia a la branch nueva con: `git fetch origin && git checkout <nueva-branch>`.

**NUNCA** usar `git pull origin <nueva-branch>` desde la branch antigua. Eso fuerza un merge entre branches divergentes y produce conflictos en ficheros que tocaron ambas. Vivido en F7.4-B → F7.4-C: conflicts en `bottom-tab.js` y `shell.js` por intentar pull de la nueva branch desde la antigua.

El comando `git checkout` (con la rama ya `fetch`-eada) hace switch limpio sin merge.

## 6 · Tras squash-merge de un PR

Cuando un PR se mergea con squash, GitHub auto-elimina la branch `claude/*` en remote (configuración del repo). Sin embargo:

- La branch local en el filesystem de San (si la tenía checkout-eada) **queda obsoleta** pero sigue existiendo.
- La branch local en el container de Code también queda. Si Code intenta pushear a esa branch en una sesión posterior, GitHub la **recrea**, generando un PR fantasma.

**Acción al arrancar nueva sesión**:

1. `git checkout main && git pull origin main` (sincronizar antes de cualquier acción).
2. `git branch -D <branch-vieja>` (limpiar la copia local obsoleta).
3. Si hay confusión sobre qué branches están vivas en remote: `git ls-remote --heads origin claude/*`.

Ya documentado como precedente en `migration-log.md` (cierre F7.4-A): "tras squash-merge + auto-delete de la rama de trabajo, el sandbox local puede recrearla sin saberlo si pushea desde la rama vieja (genera PRs fantasma)".

## 7 · Subagentes Haiku 4.5 paralelos (patrón validado F7.X)

Cuando una fase requiere generar múltiples ficheros independientes (ej. CSS shell + design tokens + JS controller + wiring), el padre puede delegar a 4 subagentes Haiku 4.5 paralelos vía Task tool en 2 oleadas:

- **Oleada 1**: subagentes que solo escriben artefactos sin dependencias externas (ej. CSS + tokens).
- **Oleada 2**: subagentes que dependen de los outputs de la oleada 1 (ej. JS que usa selectores CSS, wiring que importa el JS).

**Responsabilidad del padre tras las oleadas**:

1. **Integrar** los outputs (concatenar/colocar ficheros donde tocan).
2. **Resolver mismatches** de selectores CSS↔JS (subagente CSS puede usar `.elim-card` mientras el JS usa `.card-elim` — el padre uniforma).
3. **Resolver escapes** en template strings (subagentes a veces escapan backticks/dólares de más al copiar a Write).
4. **Validar** con `node --check` + `npm run build` + smoke localhost antes de commit.

Caveat E13 sigue aplicando: subagentes con tool Write **no heredan** `.claude/rules/` — pasar contexto inline en el prompt del subagente o restringir a artefactos puros sin reglas de proyecto.

Validado en F7.X (PR#44, 30abr2026): 4 subagentes generaron `ui-elim-shell.js` (545 LOC) + `elim-shell.css` (295) + `elim-tokens.css` (30) + wiring en `main-entry`/`ui-nav`/`bottom-tab` con éxito tras integración del padre.

## 8 · Design source bundles en branch dedicada

Cuando se trabaja con un bundle de design source extenso (mockups HTML/CSS/JS de referencia, screenshots, specs), **NO embeber inline en el brief de la fase** (consume ventana de contexto y no sobrevive entre sesiones). En su lugar:

1. Crear branch dedicada `docs/<nombre>-design-source-v<N>` desde `main`.
2. Push del bundle en un único commit descriptivo.
3. Referenciar la branch + commit SHA en el brief de la fase y en `CHANGELOG.md`.

**Ventajas**: (a) sobrevive entre sesiones, (b) versionable (v2, v3 si rediseño), (c) consultable vía `git show <sha>:<ruta>` o checkout de la branch en local sin contaminar `main`.

Validado en F7.X: bundle design source v2 vive en `docs/quiniela-design-source-v2` commit `fd95d08`. Patrón a seguir para futuros design source bundles.

## Referencias

- `CLAUDE.md` § Reglas CRÍTICAS (Push inmediato + NUNCA push a main sin validar)
- `migration-log.md` cierre F7.4-A (incidente sandbox + protocolo)
- ERR-17 (Claude Code no puede borrar ramas remotas — HTTP 403 proxy git, San las borra)
- Issue #27 (origen de esta regla)

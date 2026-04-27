# Pantalla 01 · Headers (`.fc-appbar`)

> Estado: 🟡 **Pendiente de smoke local + merge** · F7.4-C en branch `claude/migrate-headers-fc-appbar-SPMrq`
> Base: F7.4-B merged · main=`9f7c73b`
> Decisiones aprobadas por San: B+(2)+A · ver §3
> Plan acordado en sesión Code (27 abr 2026)

Migración de los 3 headers inline (`.adm-header`, `.sb-header`, `.global-header`) al componente `.fc-appbar` con variante `--page` definido en F7.4-A. Sin tocar el header global persistente de `#page-grupos` (`#global-header` con id, separado de `.global-header` con class) — eso es F7.4-E.

---

## 1 · Inventario producción (pre-F7.4-C)

| Header | Page | Estructura previa | Selectores CSS |
|---|---|---|---|
| **Clasificación** | `#page-score` (`index.html:211-217`) | `<div class="sb-header">` con back-btn ↩ + título + `#score-user-bar` (badge usuario + logout) | `admin.css:89-94` (.sb-header/.sb-header-left/.sb-back-btn/.sb-back-btn:hover/.sb-header-title/.sb-user-bar) + dup en 643-648 + media query 286-287 + dup 839-840 |
| **Eliminatorias** | `#page-elim` (`index.html:660-687`) | `<div class="global-header">` con: back link `← Fase de Grupos`, h1 "⚽ Porra Eliminatorias", subtítulo "Fase eliminatoria — 32 partidos", `.gh-pts` (Mis puntos + `<strong id="total-ko-pts">`), botón `🏆 Clasificación`, `#elim-user-bar` | `ko.css:32-67` (.global-header + .gh-*) + dup en 731-766 + media query `admin.css:230-243` + dup 784-796 |
| **Admin** | `#page-admin` (`index.html:858-868`) | `<div class="adm-header">` con `.adm-title` "Panel de administración + .adm-badge ADMIN" + `.adm-sub` "Porra Mundial 2026" + `.adm-back` "← Volver a la porra" | `admin.css:22-27` (.adm-header/.adm-title/.adm-sub/.adm-back/.adm-back:hover) + dup 576-581 |

**Total selectores CSS retirados (incluyendo duplicados)**: 13 base + 6 media-query rules.

---

## 2 · Estructura objetivo (F7.4-C)

### 2.1 Componente reusado

`.fc-appbar.fc-appbar--page` (definido en `public/css/components/app-header.css:8-72`):
- height `var(--fc-header-h)`, sticky top, border-bottom
- slot `.fc-appbar__back` (botón cuadrado 36×36, SVG via `getIcon('back')`)
- slot `.fc-appbar__title` (text-overflow ellipsis, font-weight 700)

### 2.2 Marcado migrado

```html
<!-- Score -->
<header class="fc-appbar fc-appbar--page">
  <button class="fc-appbar__back" id="sb-back-btn" type="button" aria-label="Volver"
          onclick="showPage(window._sbPrevPage||'grupos')"></button>
  <span class="fc-appbar__title">Clasificación</span>
</header>

<!-- Elim -->
<header class="fc-appbar fc-appbar--page">
  <button class="fc-appbar__back" type="button" aria-label="Volver a fase de grupos"
          onclick="showPage('grupos')"></button>
  <span class="fc-appbar__title">Eliminatorias</span>
</header>
<div class="elim-pts-strip">
  <div class="elim-pts-block">
    <span class="elim-pts-label">Mis puntos</span>
    <strong class="elim-pts-num" id="total-ko-pts">—</strong>
  </div>
  <button type="button" class="elim-pts-clasif-btn" onclick="showPage('score')">🏆 Clasificación</button>
</div>

<!-- Admin -->
<header class="fc-appbar fc-appbar--page">
  <button class="fc-appbar__back" type="button" aria-label="Volver" onclick="showPage('grupos')"></button>
  <span class="fc-appbar__title">Panel de administración <span class="adm-badge">ADMIN</span></span>
</header>
```

### 2.3 Sweep del icono back (estrategia α)

`shell.js:fcAppbarFillBackIcons()` recorre `document.querySelectorAll('.fc-appbar__back:empty')` tras cada `fcShellApply(page)` y rellena con `getIcon('back')`. Idempotente — el selector `:empty` excluye los botones ya rellenados. Guard `typeof window.getIcon === 'function'` por si la cadena `loadScript` no ha cargado aún el módulo (defensa redundante: ya se carga antes de `shell.js` en `main-entry.js`).

---

## 3 · Decisiones (B+(2)+A)

| ID | Decisión | Aplicación |
|---|---|---|
| **B** | "Mis puntos" del header de Eliminatorias se baja a una franja `.elim-pts-strip` debajo del header. Será retirada en F7.4-E cuando el header global persistente exponga puntos + #posición (D5). | `index.html:661-674` + `ko.css:31-58` |
| **(2)** | Botón "🏆 Clasificación" (que estaba dentro del `.global-header` de elim) se conserva como `.elim-pts-clasif-btn` dentro de la franja transitoria, junto a "Mis puntos". Mismo destino que el contenedor: se autorretira en F7.4-E. Decisión preferida sobre eliminarlo (perdía 1-tap a Clasificación) o meterlo en `.fc-appbar__actions` (alargaba el header). | `index.html:670` + `ko.css:50-58` |
| **A** | `#score-user-bar` del header de Clasificación se elimina por completo. Logout sigue accesible desde welcome. F7.4-E unificará identidad de usuario en header global persistente. | `index.html:211-216` + `ui-nav.js:528-533` + `admin.css:94/648` |
| **α** (icono) | Sweep central en `shell.js` con `querySelectorAll('.fc-appbar__back:empty')`. Centralizado, idempotente, sin duplicar SVG en HTML. | `public/js/shell.js:8-13,32` |
| **div-1** | NO renombrar `id="total-ko-pts"` → `elim-pts-num`. El id ya existía y era estable; renombrarlo añadía churn a `ui-nav.js:updateKOPts` sin valor. Conservamos id, cambiamos solo clases CSS. | `index.html:672` + `ui-nav.js:563` (sin tocar) |
| **adm-badge** | `.adm-badge` se conserva como utility class. Se sigue usando inline en `.fc-appbar__title` del header de Admin para marcar el rol. | `admin.css:23/579` (1 línea) |

### 3.1 Items eliminados sin reemplazo (out of scope F7.4-C)

- Subtítulo "Fase eliminatoria — 32 partidos" (info redundante con el contexto).
- Subtítulo "Porra Mundial 2026" del header de Admin (redundante con identidad de la app).
- Color verde destacado del span "Eliminatorias" en el h1 (el título es solo texto plano en `.fc-appbar__title`).
- `#score-user-bar` y JS asociado en `ui-nav.js:528-533`.
- `#sb-back-label` y la lógica `labelMap` en `ui-nav.js:515-517`.
- `#elim-user-bar` div (la referencia en `auth.js:220` es null-safe; `renderAuthBar` simplificado en F7.4-E vía R5).

---

## 4 · DoD F7.4-C

- [ ] Mobile 375px iPhone — los 3 headers se ven con `.fc-appbar` (back-btn 36×36 izquierdo con SVG, título centrado, sin user-bar en Clasificación, badge ADMIN inline en Admin).
- [ ] Click back en Clasificación vuelve a la página de origen (Grupos o Eliminatorias según `window._sbPrevPage`).
- [ ] Click back en Eliminatorias vuelve a Grupos.
- [ ] Click back en Admin vuelve a Grupos.
- [ ] Franja "Mis puntos" en Eliminatorias visible debajo del header; el contador `#total-ko-pts` sigue actualizándose con `updateKOPts()` (sin tocar el id).
- [ ] Botón "🏆 Clasificación" en franja navega a `#page-score` (1 tap, sin regresión vs F7.4-B).
- [ ] Bottom-tab sigue funcionando como F7.4-B (visible en Grupos+Elim, click navega).
- [ ] Console limpia salvo `console.debug` esperados del shell.
- [ ] No regresiones: welcome (auth bar), login modal, navegación a/desde Score, Admin, Directo, Predictor IA tooltip.
- [ ] `node --check` OK en `public/js/shell.js` y `public/js/ui-nav.js`.
- [ ] `npm run build` OK; `.fc-appbar--page` y `.elim-pts-strip` presentes en `dist/`; `.global-header`, `.gh-pts`, `.adm-header`, `.sb-header` ausentes en `dist/`.

---

## 5 · Snapshots CSS pre-cambio

### 5.1 `.global-header` y `.gh-*` (`ko.css:32-67`, dup 731-766)

```css
.global-header{
  background:rgba(10,15,30,.95);
  border-bottom:1px solid #1e293b;
  padding:14px 24px;
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:10px;
  position:sticky;top:0;z-index:100;
  backdrop-filter:blur(12px);
}
.gh-left{display:flex;align-items:center;gap:16px}
.gh-back{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text-3);text-decoration:none;padding:6px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);cursor:pointer;transition:all .15s}
.gh-back:hover{border-color:var(--green);color:var(--green)}
.gh-title{font-family:'Inter Tight',sans-serif;font-size:18px;font-weight:900;letter-spacing:-.01em}
.gh-title span{color:var(--green)}
.gh-pts{display:flex;align-items:center;gap:8px;background:var(--deep);border:1px solid var(--border);border-radius:24px;padding:6px 16px}
.gh-pts-label{font-size:11px;color:var(--text-3)}
.gh-pts-num{font-family:'Inter Tight',sans-serif;font-size:22px;font-weight:900;color:var(--green)}
.gh-clasif{color:#fbbf24!important;border-color:#78350f!important;background:#1c1008!important}
```

### 5.2 `.adm-header` y derivados (`admin.css:22-27`, dup 576-581)

```css
.adm-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #27272a}
.adm-title{font-size:18px;font-weight:600;color:#fff}
.adm-sub{font-size:12px;color:#6b7280;margin-top:2px}
.adm-back{background:none;border:1px solid #27272a;color:#9ca3af;font-size:13px;padding:6px 14px;border-radius:8px;cursor:pointer;transition:all .15s}
.adm-back:hover{border-color:#4b5563;color:#fff}
```

### 5.3 `.sb-header` y derivados (`admin.css:89-94`, dup 643-648)

```css
.sb-header{background:#0d0d11;border-bottom:1px solid #1f2937;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:56px;position:sticky;top:0;z-index:100}
.sb-header-left{display:flex;align-items:center;gap:12px}
.sb-back-btn{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#6b7280;text-decoration:none;padding:5px 10px;border-radius:8px;border:1px solid #27272a;background:#1c1c1e;transition:all .15s;cursor:pointer}
.sb-back-btn:hover{border-color:#4ade80;color:#4ade80}
.sb-header-title{font-family:'Inter Tight',sans-serif;font-size:15px;font-weight:700;color:#fff;letter-spacing:.02em}
.sb-user-bar{display:flex;align-items:center;gap:8px}
```

### 5.4 Media queries eliminadas (`admin.css`)

```css
/* 230-234 + dup 784-790 — .global-header + .gh-* responsive */
@media(max-width:640px){
  .global-header{flex-wrap:wrap;gap:6px;padding:8px 12px;justify-content:space-between}
  .gh-left{gap:6px;flex:0 0 auto}
  .gh-back{font-size:11px;padding:5px 8px}
  .gh-title{font-size:13px}
  .gh-pts{flex-shrink:0}
  .gh-pts-num{font-size:16px}
  /* + variantes #elim-user-bar y .global-header>div:last-child */
}

/* 286-287 + dup 839-840 — .sb-* responsive */
@media(max-width:640px){
  .sb-back-btn span{display:none}
  .sb-header-title{font-size:13px}
}
```

**Conservadas**: las media queries de `#global-header` (id, page-grupos) en `admin.css:163-173` + dup 708-718 — page-grupos no migra en F7.4-C.

---

## 6 · Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| **H-R1** | `.fc-appbar--page` es `position:sticky;top:0`. Si page-elim tenía scroll-jacking custom o si `.ko-sub-bar` también es sticky, podría haber overlap. | Smoke local en localhost:5173. Ajustar margin/z-index si hay overlap visual. `.ko-sub-bar` no es sticky en CSS revisado (solo `padding`/`gap`), riesgo bajo. |
| **H-R2** | `getIcon` puede no estar cargado al primer `fcShellApply`. | Cadena `main-entry.js`: `icons.js → bottom-tab.js → app-header.js → shell.js`. Garantía de orden + guard `typeof window.getIcon === 'function'` en el sweep. Si fallara, los botones quedan vacíos pero clicables; la próxima `showPage` los rellena. |
| **H-R3** | Eliminar `#elim-user-bar` puede romper `auth.js:renderAuthBar`. | Verificado: `auth.js:220-234` ya es null-safe (`if (elimBar) ...`). `getElementById` devuelve null y el bloque salta. Sin cambios en `auth.js`. |
| **H-R4** | Selectores duplicados en CSS — si solo se elimina un bloque y queda zombie, el header viejo podría parpadear durante el reemplazo. | Verificación post-build con `grep -l ".global-header\|.gh-pts\|.adm-header\|.sb-header" dist/css/*.css` (debe no aparecer). |
| **H-R5** | Pérdida del id `#score-user-bar` puede tener referencias residuales en otros sitios. | `grep` exhaustivo en `public/js/` + `index.html` confirma uso solo en `ui-nav.js:529-533` (eliminado) y comentario header de la sección (también actualizado). |

---

## 7 · Pendientes para F7.4-D / F7.4-E

| Fase | Alcance | Relación con F7.4-C |
|---|---|---|
| **F7.4-D** | Eliminar sub-tabs internos de page-grupos (`#btn-vista-grupos/jornada/directo`) y view-tabs de page-elim (`.view-tabs`). Reemplazar por tabs del shell o pages dedicadas. Migrar `#global-header` (id) de page-grupos al header global persistente. | Independiente de F7.4-C. La franja `.elim-pts-strip` queda intacta; F7.4-D solo toca las tabs internas. |
| **F7.4-E** | Crear `#page-perfil`. Header global persistente (avatar + pts + #posición clickable). Simplificar `renderAuthBar` (R5: un único target en header global). Implementar D5/D6/D7. | Aquí se retira la franja `.elim-pts-strip` (su contador pasa al header global). Se borran los selectores `.elim-pts-strip/.elim-pts-block/.elim-pts-label/.elim-pts-num/.elim-pts-clasif-btn` de `ko.css`. Se elimina la referencia a `#elim-user-bar` de `auth.js:220-234`. |

---

## 8 · Verificación post-merge (placeholder)

Al cerrar la fase con merge a main:
- Marcar §7 del `00-app-shell.md` con F7.4-C `✅ Cerrada` + sha + PR.
- Append a `migration-log.md` con `[HH:MM] F7.4-C: migración de 3 headers a .fc-appbar`.
- Actualizar `CLAUDE.md` Estado actual con siguiente F7.4-D.
- Borrar branch `claude/migrate-headers-fc-appbar-SPMrq` post-squash.

# Restyling mobile — notas

Specs incrementales del rediseño mobile-first de Porra Mundial 2026:

- `00-app-shell.md` — shell app (header, bottom-tab, splash, page wrappers).
- `01-headers.md` — cabeceras por página.

## Design source bundles — patrón

Los **bundles de design source** (mockups HTML/CSS/JS, screenshots, specs extensas) NO se embeben inline en briefs ni se duplican en este directorio. Se push-ean a una **branch dedicada** `docs/<nombre>-design-source-v<N>`.

**Ejemplo activo**: bundle design source v2 (rediseño Fase final F7.X, abr 2026) vive en branch `docs/quiniela-design-source-v2`, commit `fd95d08`.

```bash
git fetch origin docs/quiniela-design-source-v2
git checkout docs/quiniela-design-source-v2     # browse local
# o consulta puntual:
git show fd95d08:<ruta-dentro-del-bundle>
```

**Ventajas vs embed en brief**: (a) sobrevive entre sesiones, (b) versionable (v2, v3, ...), (c) no contamina `main`, (d) historial git como auditoría de iteraciones de diseño.

Patrón completo en `.claude/rules/multi-agent-sync.md` §8.

// render.ts — send-porra-receipt
//
// Renderiza el COMPROBANTE (acuse de recibo) a HTML email-safe (estilos inline).
// El mismo HTML sirve como cuerpo del email y como adjunto .html. NO incluye
// puntuación (al cierre no se ha jugado nada) ni badge de Boost ×2 (el ×2 es
// exclusivo de grupos y, además, los boosts quedan fuera de este comprobante).

import type { KoPred, ReceiptData } from "./build-data.ts";

function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Bandera + nombre (con fallback: si la imagen no carga, queda el nombre).
function flagName(
  base: string,
  iso3: string | null,
  name: string | null,
  opts: { bold?: boolean } = {},
): string {
  const label = name ? esc(name) : "—";
  const weight = opts.bold ? "font-weight:700;" : "";
  if (!iso3) return `<span style="${weight}">${label}</span>`;
  const img =
    `<img src="${base}/flags/${esc(iso3)}.png" width="20" height="14" alt="" ` +
    `style="vertical-align:middle;border-radius:2px;margin-right:6px;object-fit:cover">`;
  return `${img}<span style="${weight}vertical-align:middle">${label}</span>`;
}

function score(l: number | null, v: number | null): string {
  if (l === null || l === undefined || v === null || v === undefined) return "—";
  return `${l} <span style="color:#9ca3af">·</span> ${v}`;
}

function fmtMadrid(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " (CEST)";
  } catch {
    return iso;
  }
}

const CELL = "padding:7px 10px;border-bottom:1px solid #eef0f3;font-size:14px;color:#111827;";
const CELL_C = CELL + "text-align:center;white-space:nowrap;";
const SUBHEAD =
  "padding:10px 10px 6px;font-size:12px;font-weight:700;letter-spacing:.04em;" +
  "text-transform:uppercase;color:#6b7280;background:#f9fafb;";

function sectionTitle(emoji: string, text: string): string {
  return (
    `<h2 style="margin:26px 0 8px;font-size:17px;color:#111827;` +
    `border-left:4px solid #c1121f;padding-left:10px">${emoji} ${esc(text)}</h2>`
  );
}

function renderGroups(d: ReceiptData): string {
  if (d.groups.length === 0) {
    return `<p style="color:#6b7280;font-size:14px">Sin pronósticos de grupos.</p>`;
  }
  let rows = "";
  let currentGroup = "";
  for (const g of d.groups) {
    if (g.group !== currentGroup) {
      currentGroup = g.group;
      rows +=
        `<tr><td colspan="3" style="${SUBHEAD}">Grupo ${esc(g.group)}</td></tr>`;
    }
    const match =
      `${flagName(d.flagsBase, g.homeIso3, g.homeName)} ` +
      `<span style="color:#9ca3af">vs</span> ` +
      `${flagName(d.flagsBase, g.awayIso3, g.awayName)}`;
    const scorer = g.scorer
      ? `<span style="color:#374151">⚽ ${esc(g.scorer)}</span>`
      : `<span style="color:#cbd5e1">—</span>`;
    rows +=
      `<tr><td style="${CELL}">${match}</td>` +
      `<td style="${CELL_C}font-weight:700">${score(g.l, g.v)}</td>` +
      `<td style="${CELL}">${scorer}</td></tr>`;
  }
  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" ` +
    `style="border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden">` +
    `<thead><tr>` +
    `<th align="left" style="${CELL}background:#f3f4f6;font-size:12px;color:#6b7280">Partido</th>` +
    `<th style="${CELL_C}background:#f3f4f6;font-size:12px;color:#6b7280">Marcador</th>` +
    `<th align="left" style="${CELL}background:#f3f4f6;font-size:12px;color:#6b7280">Goleador</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  );
}

function renderKo(d: ReceiptData): string {
  if (d.ko.length === 0) {
    return `<p style="color:#6b7280;font-size:14px">Sin pronósticos de fase final.</p>`;
  }
  let rows = "";
  let currentRound = "";
  for (const k of d.ko as KoPred[]) {
    if (k.roundLabel !== currentRound) {
      currentRound = k.roundLabel;
      rows +=
        `<tr><td colspan="3" style="${SUBHEAD}">${esc(k.roundLabel)}</td></tr>`;
    }
    const advances = k.classifierName
      ? flagName(d.flagsBase, k.classifierIso3, k.classifierName, { bold: true })
      : `<span style="color:#cbd5e1">—</span>`;
    const scorer = k.scorer
      ? `<span style="color:#374151">⚽ ${esc(k.scorer)}</span>`
      : `<span style="color:#cbd5e1">—</span>`;
    rows +=
      `<tr><td style="${CELL_C}font-weight:700">${score(k.l, k.v)}</td>` +
      `<td style="${CELL}"><span style="color:#6b7280;font-size:12px">Avanza:</span> ${advances}</td>` +
      `<td style="${CELL}">${scorer}</td></tr>`;
  }
  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" ` +
    `style="border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden">` +
    `<thead><tr>` +
    `<th style="${CELL_C}background:#f3f4f6;font-size:12px;color:#6b7280">Marcador</th>` +
    `<th align="left" style="${CELL}background:#f3f4f6;font-size:12px;color:#6b7280">Quién avanza</th>` +
    `<th align="left" style="${CELL}background:#f3f4f6;font-size:12px;color:#6b7280">Goleador</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  );
}

function renderPodium(d: ReceiptData): string {
  const cell = (emoji: string, label: string, name: string | null, iso3: string | null) =>
    `<td width="50%" style="padding:14px;text-align:center;vertical-align:top">` +
    `<div style="font-size:26px;line-height:1">${emoji}</div>` +
    `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:6px 0 4px">${esc(label)}</div>` +
    `<div style="font-size:15px;font-weight:700">${name ? flagName(d.flagsBase, iso3, name, { bold: true }) : "—"}</div>` +
    `</td>`;
  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" ` +
    `style="border-collapse:separate;border:1px solid #eef0f3;border-radius:8px;background:#fffdf5">` +
    `<tr>${cell("🏆", "Campeón", d.champion, d.championIso3)}` +
    `${cell("🥉", "Ganador 3.er puesto", d.thirdPlace, d.thirdPlaceIso3)}</tr></table>`
  );
}

function renderAwards(d: ReceiptData): string {
  const rows = d.awards.map((a) =>
    `<tr><td style="${CELL}"><b>${esc(a.label)}</b> ` +
    `<span style="color:#9ca3af;font-size:12px">(+${a.pts})</span></td>` +
    `<td style="${CELL}">${a.player ? esc(a.player) : '<span style="color:#cbd5e1">—</span>'}</td></tr>`
  ).join("");
  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" ` +
    `style="border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden">` +
    `<tbody>${rows}</tbody></table>`
  );
}

export function renderReceiptHtml(d: ReceiptData): string {
  const generated = fmtMadrid(d.generatedAt);
  const summary =
    `${d.groups.length} de 72 grupos · ${d.ko.length} de 32 fase final · ${d.counts.awards} de 4 premios`;

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprobante de tu porra — ${esc(d.leagueName)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:680px;margin:0 auto;padding:18px 12px">

  <div style="background:linear-gradient(135deg,#0a3d62 0%,#c1121f 100%);border-radius:14px 14px 0 0;padding:24px 22px;color:#fff">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Porra Mundial 2026 · Comprobante</div>
    <div style="font-size:24px;font-weight:800;margin-top:6px">Tus pronósticos quedan registrados</div>
    <div style="font-size:14px;margin-top:8px;opacity:.95">
      Liga <b>${esc(d.leagueName)}</b> · ${esc(d.userName)}
    </div>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px;padding:20px 22px 26px">

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:11px 13px;font-size:13px;color:#9a3412">
      📋 Esto es un <b>acuse de recibo</b>, no la puntuación. Al cierre todavía no se ha jugado nada:
      es la copia íntegra de lo que has pronosticado, para tu tranquilidad y como copia de auditoría.
    </div>

    <p style="font-size:14px;color:#374151;margin:16px 0 0">
      Generado el <b>${esc(generated)}</b>. Resumen: <b>${esc(summary)}</b>.
    </p>

    ${sectionTitle("⚽", "Fase de grupos")}
    ${renderGroups(d)}

    ${sectionTitle("🏟️", "Fase final")}
    ${renderKo(d)}

    ${sectionTitle("🥇", "Podio pronosticado")}
    ${renderPodium(d)}
    <p style="font-size:12px;color:#9ca3af;margin:6px 2px 0">
      Solo se muestran campeón y ganador del 3.<sup>er</sup> puesto: el subcampeón y el 4.º dependen del cruce y no se almacenan.
    </p>

    ${sectionTitle("🏆", "Premios individuales")}
    ${renderAwards(d)}

    <div style="margin-top:26px;border-top:1px dashed #d1d5db;padding-top:14px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Copia de auditoría</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;font-size:13px;color:#374151">
        <tr><td style="padding:3px 0;width:170px;color:#6b7280">Código de verificación</td>
            <td style="padding:3px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;letter-spacing:.05em">${esc(d.verificationCode)}</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280">Pronósticos grupos</td><td style="padding:3px 0">${d.groups.length} / 72</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280">Pronósticos fase final</td><td style="padding:3px 0">${d.ko.length} / 32</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280">Premios elegidos</td><td style="padding:3px 0">${d.counts.awards} / 4</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280">Generado</td><td style="padding:3px 0">${esc(generated)}</td></tr>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin:10px 0 0">
        El código de verificación es un hash de tus pronósticos guardados: si no cambian, el código no cambia.
        Conserva este correo (y el adjunto) como comprobante.
      </p>
    </div>

  </div>

  <div style="text-align:center;font-size:11px;color:#9ca3af;padding:14px 6px">
    Porra Mundial 2026 · porramundial2026-seven.vercel.app
  </div>

</div>
</body></html>`;
}

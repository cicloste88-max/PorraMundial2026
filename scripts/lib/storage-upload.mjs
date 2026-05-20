// scripts/lib/storage-upload.mjs
// Sube una foto desde TM CDN al bucket player-photos de Supabase Storage.
// Idempotente: si el archivo ya existe en el bucket, devuelve la URL pública
// sin re-descargar ni re-subir.

import { getClient } from './squads-db.mjs';

const BUCKET = 'player-photos';
const TM_REFERER = 'https://www.transfermarkt.com/';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Sube la foto de TM CDN al bucket `player-photos` con path `{iso3}/{tmPlayerId}.jpg`.
 * @param {string} iso3 - código ISO3 país (ej. 'FRA')
 * @param {number} tmPlayerId - id numérico TM
 * @param {string} sourceUrl - URL de TM CDN (img.a.transfermarkt.technology/...)
 * @returns {Promise<string>} URL pública del bucket
 */
export async function uploadPlayerPhoto(iso3, tmPlayerId, sourceUrl) {
  if (!iso3 || !tmPlayerId || !sourceUrl) {
    throw new Error(`uploadPlayerPhoto: args inválidos iso3=${iso3} id=${tmPlayerId}`);
  }
  const supa = getClient();
  const path = `${iso3}/${tmPlayerId}.jpg`;

  // Idempotencia: si ya existe, devolver URL sin re-descargar
  const { data: existing } = await supa.storage
    .from(BUCKET)
    .list(iso3, { limit: 1, search: `${tmPlayerId}.jpg` });
  if (existing?.some((f) => f.name === `${tmPlayerId}.jpg`)) {
    return supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // Descargar desde TM CDN
  const r = await fetch(sourceUrl, {
    headers: { 'User-Agent': UA, Referer: TM_REFERER },
  });
  if (!r.ok) throw new Error(`TM photo ${tmPlayerId} HTTP ${r.status}`);
  const blob = await r.blob();

  // Subir al bucket (upsert true por si hay races con otro runner)
  const { error } = await supa.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Storage upload ${path}: ${error.message}`);

  return supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

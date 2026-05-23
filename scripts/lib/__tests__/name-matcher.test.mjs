// scripts/lib/__tests__/name-matcher.test.mjs
// Tests del name-matcher: normalize order-invariant + scoring por token-set.
// Caso motivante: nombres coreanos cuyo orden cambia entre DB ('Son Heung-min',
// orden coreano: apellido + nombre) y TM ('Heung-min Son', orden occidental).
// applyEnrich usa exact-match en normalize() para el lookup por nombre+iso3,
// así que normalize() debe canonicalizar el orden de tokens.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  normalize,
  tokens,
  lastToken,
  scorePair,
  matchAgainstRoster,
} from '../name-matcher.mjs';

// ─── normalize() — canonicalización order-invariant ─────────────────────────

test('normalize: orden coreano y occidental colapsan a misma clave', () => {
  assert.equal(normalize('Son Heung-min'), normalize('Heung-min Son'));
  assert.equal(normalize('Kim Min-jae'), normalize('Min-jae Kim'));
  assert.equal(normalize('Lee Kang-in'), normalize('Kang-in Lee'));
  assert.equal(normalize('Hwang In-beom'), normalize('In-beom Hwang'));
});

test('normalize: guiones son joiners (eliminados), no separadores', () => {
  // 'Kang-in' → 'kangin' (un solo token), NO ['kang', 'in'].
  // Evita colisión 'Lee Kang-in' ↔ 'Kang Lee'.
  assert.notEqual(normalize('Lee Kang-in'), normalize('Kang Lee'));
  assert.equal(normalize('Kim Min-jae'), 'kim minjae');
});

test('normalize: guiones unicode (U+2013, U+2014) tratados igual que ascii', () => {
  assert.equal(normalize('Son Heung–min'), normalize('Son Heung-min'));
  assert.equal(normalize('Son Heung—min'), normalize('Son Heung-min'));
});

test('normalize: apóstrofes unicode (U+2019) eliminados', () => {
  assert.equal(normalize("N'Doye"), 'ndoye');
  assert.equal(normalize('N’Doye'), 'ndoye');
});

test('normalize: acentos eliminados (NFD)', () => {
  assert.equal(normalize('Théo Hernández'), normalize('Theo Hernandez'));
  assert.equal(normalize('Joan García'), normalize('Joan Garcia'));
  assert.equal(normalize('Lucas Hernández'), 'hernandez lucas');
});

test('normalize: tokens duplicados se preservan (no Set)', () => {
  // Garantía: si un nombre tuviera duplicados, no se colapsan.
  assert.equal(normalize('Park Ji Park'), 'ji park park');
});

test('normalize: input vacío o sólo puntuación → string vacío', () => {
  assert.equal(normalize(''), '');
  assert.equal(normalize(null), '');
  assert.equal(normalize('---'), '');
});

// ─── tokens() / lastToken() — orden original preservado ─────────────────────

test('tokens(): orden ORIGINAL (no sorted) — necesario para scorePair', () => {
  assert.deepEqual(tokens('Mike Maignan'), ['mike', 'maignan']);
  assert.deepEqual(tokens('Heung-min Son'), ['heungmin', 'son']);
});

test('lastToken(): último token en orden ORIGINAL = apellido', () => {
  assert.equal(lastToken('Mike Maignan'), 'maignan');
  assert.equal(lastToken('Heung-min Son'), 'son');
  assert.equal(lastToken('João Cancelo'), 'cancelo');
});

// ─── scorePair() — casos coreanos con swap apellido↔nombre ──────────────────

test('scorePair: Son Heung-min ↔ Heung-min Son score 100 (exact canonical)', () => {
  assert.equal(scorePair('Son Heung-min', 'Heung-min Son'), 100);
});

test('scorePair: Kim Min-jae ↔ Min-jae Kim score 100', () => {
  assert.equal(scorePair('Kim Min-jae', 'Min-jae Kim'), 100);
});

test('scorePair: Lee Kang-in ↔ Kang-in Lee score 100', () => {
  assert.equal(scorePair('Lee Kang-in', 'Kang-in Lee'), 100);
});

test('scorePair: Hwang In-beom ↔ In-beom Hwang score 100', () => {
  assert.equal(scorePair('Hwang In-beom', 'In-beom Hwang'), 100);
});

// ─── scorePair() — anti-regresión europea ───────────────────────────────────

test('scorePair: Mike Maignan ↔ Mike Maignan score 100', () => {
  assert.equal(scorePair('Mike Maignan', 'Mike Maignan'), 100);
});

test('scorePair: Joan García ↔ Joan Garcia score 100 (acentos)', () => {
  assert.equal(scorePair('Joan García', 'Joan Garcia'), 100);
});

test('scorePair: Lucas Hernández ↔ Lucas Hernandez score 100', () => {
  assert.equal(scorePair('Lucas Hernández', 'Lucas Hernandez'), 100);
});

test('scorePair: Théo Hernández ↔ Theo Hernandez score 100', () => {
  assert.equal(scorePair('Théo Hernández', 'Theo Hernandez'), 100);
});

test('scorePair: 1-token vs 2-token subset (apellido en roster) score 75-85', () => {
  // 'Cancelo' (apellido suelto) debe matchear 'João Cancelo' (lastToken)
  assert.ok(scorePair('Cancelo', 'João Cancelo') >= 75);
  // 'Vinícius' (nombre suelto) debe matchear 'Vinicius Junior'
  assert.ok(scorePair('Vinícius', 'Vinicius Junior') >= 75);
});

test('scorePair: NO match falso João Félix ↔ João Cancelo (mismo nombre, distinto apellido)', () => {
  // overlap=1 token ('joao'), no debe disparar la rama token-set (que requiere ≥2)
  // ni la rama lastToken (apellidos distintos: 'felix' vs 'cancelo').
  // Levenshtein 'felix' vs 'cancelo' (sim<0.85) tampoco dispara.
  assert.ok(scorePair('João Félix', 'João Cancelo') < 65,
    `score debe ser < minScore (65), fue: ${scorePair('João Félix', 'João Cancelo')}`);
});

test('scorePair: NO match falso Lee Kang-in ↔ Kang Lee (compound vs European)', () => {
  // Tras strip-hyphen: 'Lee Kang-in' tokens = ['lee', 'kangin'] (2).
  // 'Kang Lee' tokens = ['kang', 'lee']. Overlap = 1 ('lee'). NO match.
  assert.ok(scorePair('Lee Kang-in', 'Kang Lee') < 65,
    `score debe ser < 65, fue: ${scorePair('Lee Kang-in', 'Kang Lee')}`);
});

test('scorePair: Jens Castrop (nombre occidental en KOR) no se rompe', () => {
  assert.equal(scorePair('Jens Castrop', 'Jens Castrop'), 100);
});

// ─── matchAgainstRoster() — escenario roster Corea con varios "Kim" ─────────

test('matchAgainstRoster: 3 Kim distintos no se confunden entre sí', () => {
  // Roster en orden TM (occidental). XI titular en orden coreano (DB).
  const tmRoster = [
    { nombre: 'Min-jae Kim' },
    { nombre: 'Seung-gyu Kim' },
    { nombre: 'Tae-hyeon Kim' },
    { nombre: 'Heung-min Son' },
  ];
  const dbCandidates = [
    'Kim Min-jae',
    'Kim Seung-gyu',
    'Kim Tae-hyeon',
    'Son Heung-min',
  ];
  const { matches, unmatched } = matchAgainstRoster(dbCandidates, tmRoster);
  assert.equal(matches.length, 4, 'todos deben matchear');
  assert.equal(unmatched.length, 0);
  // Verificar pairing correcto (no cross-talk entre los Kim):
  const byCand = Object.fromEntries(matches.map((m) => [m.candidate, m.match.nombre]));
  assert.equal(byCand['Kim Min-jae'], 'Min-jae Kim');
  assert.equal(byCand['Kim Seung-gyu'], 'Seung-gyu Kim');
  assert.equal(byCand['Kim Tae-hyeon'], 'Tae-hyeon Kim');
  assert.equal(byCand['Son Heung-min'], 'Heung-min Son');
});

test('matchAgainstRoster: roster mixto KOR completo (8 coreanos) — todos matchean', () => {
  const tmRoster = [
    { nombre: 'Heung-min Son' },
    { nombre: 'Kang-in Lee' },
    { nombre: 'Min-jae Kim' },
    { nombre: 'In-beom Hwang' },
    { nombre: 'Seung-ho Paik' },
    { nombre: 'Yu-min Cho' },
    { nombre: 'Seung-gyu Kim' },
    { nombre: 'Jens Castrop' },
  ];
  const dbCandidates = [
    'Son Heung-min',
    'Lee Kang-in',
    'Kim Min-jae',
    'Hwang In-beom',
    'Paik Seung-ho',
    'Cho Yu-min',
    'Kim Seung-gyu',
    'Jens Castrop',
  ];
  const { matches, unmatched } = matchAgainstRoster(dbCandidates, tmRoster);
  assert.equal(matches.length, 8, `esperado 8/8, actual ${matches.length}. unmatched: ${unmatched.join(', ')}`);
});

test('matchAgainstRoster: anti-regresión europea — apellidos comunes no se confunden', () => {
  const roster = [
    { nombre: 'João Cancelo' },
    { nombre: 'João Félix' },
    { nombre: 'Bernardo Silva' },
  ];
  const candidates = ['João Félix', 'João Cancelo', 'Bernardo Silva'];
  const { matches } = matchAgainstRoster(candidates, roster);
  const byCand = Object.fromEntries(matches.map((m) => [m.candidate, m.match.nombre]));
  assert.equal(byCand['João Félix'], 'João Félix');
  assert.equal(byCand['João Cancelo'], 'João Cancelo');
  assert.equal(byCand['Bernardo Silva'], 'Bernardo Silva');
});

// ─── normalizaciones árabes (R1+R2+R3) — 23-may-2026 ────────────────────────

test('normalize R1: prefijo Al-/El- se elimina', () => {
  assert.equal(normalize('Al-Tamari'), normalize('Tamari'));
  assert.equal(normalize('Al-Fakhouri'), normalize('Fakhouri'));
  assert.equal(normalize('El-Sayed'), normalize('Sayed'));
  assert.equal(normalize('Mousa Al-Tamari'), normalize('Mousa Tamari'));
});

test('normalize R2: vocales dobles colapsan a vocal simple', () => {
  assert.equal(normalize('Saadeh'), normalize('Sadeh'));
  assert.equal(normalize('Hasheesh'), normalize('Hashesh'));
  assert.equal(normalize('Yazeed'), 'yazed');
  assert.equal(normalize('Aaron'), 'aron');
  assert.equal(normalize('Boomgaarden'), 'bomgarden');
});

test('normalize R2: consonantes dobles NO colapsan (preserva Pellegrini/Hernandez)', () => {
  assert.equal(normalize('Pellegrini'), 'pellegrini');
  assert.equal(normalize('Hernández'), 'hernandez');
  assert.equal(normalize('Cooper'), 'coper');  // ee NO es consonante; oo SÍ colapsa
});

test('normalize R3: Mohammed/Mohammad/Muhammad → mohamed', () => {
  assert.equal(normalize('Mohammed'), 'mohamed');
  assert.equal(normalize('Mohammad'), 'mohamed');
  assert.equal(normalize('Muhammad'), 'mohamed');
  assert.equal(normalize('Muhammed'), 'mohamed');
  assert.equal(normalize('Mohammed Al-Dawoud'), normalize('Mohammad Al-Dawoud'));
});

// ─── JOR — 7 casos reales con bailes de letras ──────────────────────────────

test('scorePair JOR: Mousa Al-Tamari ↔ Mousa Tamari (R1)', () => {
  const s = scorePair('Mousa Al-Tamari', 'Mousa Tamari');
  assert.ok(s >= 80, `esperado ≥80, fue ${s}`);
});

test('scorePair JOR: Ibrahim Sadeh ↔ Ibrahim Saadeh (R2)', () => {
  const s = scorePair('Ibrahim Sadeh', 'Ibrahim Saadeh');
  assert.ok(s >= 80, `esperado ≥80, fue ${s}`);
});

test('scorePair JOR: Mohammed Al-Dawoud ↔ Mohammad Al-Dawoud (R1+R3)', () => {
  const s = scorePair('Mohammed Al-Dawoud', 'Mohammad Al-Dawoud');
  assert.equal(s, 100, `esperado 100 (exact tras R1+R3), fue ${s}`);
});

test('scorePair JOR: Odeh Al-Fakhouri ↔ Odeh Fakhoury (R1 + Lev sufijo)', () => {
  const s = scorePair('Odeh Al-Fakhouri', 'Odeh Fakhoury');
  assert.ok(s >= 60, `esperado ≥60 (lev sufijo i↔y), fue ${s}`);
});

test('scorePair JOR: Mohammad Abu Hashish ↔ Mohammad Abu Hasheesh (R2+R3)', () => {
  const s = scorePair('Mohammad Abu Hashish', 'Mohammad Abu Hasheesh');
  assert.ok(s >= 60, `esperado ≥60, fue ${s}`);
});

test('scorePair JOR: Yazid Abulaila ↔ Yazeed Abulaila (R2 + last-token equal)', () => {
  const s = scorePair('Yazid Abulaila', 'Yazeed Abulaila');
  assert.ok(s >= 80, `esperado ≥80 (apellido idéntico), fue ${s}`);
});

test('scorePair JOR: Mohammad Abu Taha ↔ Mohannad Abu Taha (token-set 2/3)', () => {
  const s = scorePair('Mohammad Abu Taha', 'Mohannad Abu Taha');
  assert.ok(s >= 80, `esperado ≥80 (token overlap), fue ${s}`);
});

test('matchAgainstRoster JOR: 7 jugadores con baile transliteración matchean', () => {
  const tmRoster = [
    { nombre: 'Mousa Tamari' },
    { nombre: 'Ibrahim Saadeh' },
    { nombre: 'Mohammad Al-Dawoud' },
    { nombre: 'Odeh Fakhoury' },
    { nombre: 'Mohammad Abu Hasheesh' },
    { nombre: 'Yazeed Abulaila' },
    { nombre: 'Mohannad Abu Taha' },
    // distractores: no deben confundirse
    { nombre: 'Abdallah Nasib' },
    { nombre: 'Ali Azaizeh' },
  ];
  const dbCandidates = [
    'Mousa Al-Tamari',
    'Ibrahim Sadeh',
    'Mohammed Al-Dawoud',
    'Odeh Al-Fakhouri',
    'Mohammed Abu Hashish',
    'Yazid Abulaila',
    'Mohammad Abu Taha',
  ];
  const { matches, unmatched } = matchAgainstRoster(dbCandidates, tmRoster);
  assert.equal(matches.length, 7, `esperado 7/7, actual ${matches.length}. unmatched: ${unmatched.join(', ')}`);
});

// ─── anti-regresión post-R1/R2/R3 ───────────────────────────────────────────

test('scorePair anti-regresión: Pellegrini ↔ Pellegrini score 100 (R2 no toca ll)', () => {
  assert.equal(scorePair('Lorenzo Pellegrini', 'Lorenzo Pellegrini'), 100);
});

test('scorePair anti-regresión: Lee Kang-in ↔ Kang Lee sigue NO matcheando', () => {
  assert.ok(scorePair('Lee Kang-in', 'Kang Lee') < 60,
    `score debe ser < minScore 60, fue: ${scorePair('Lee Kang-in', 'Kang Lee')}`);
});

test('scorePair anti-regresión: João Félix ↔ João Cancelo sigue NO matcheando', () => {
  assert.ok(scorePair('João Félix', 'João Cancelo') < 60,
    `score debe ser < minScore 60, fue: ${scorePair('João Félix', 'João Cancelo')}`);
});

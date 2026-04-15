import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const PROXY = {
  server: 'http://p.webshare.io:80',
  username: 'nkbtcztk-AD-AE-AF-AG-AI-AL-AM-AO-AR-AT-AU-AW-AX-AZ-BA-BB-BD-BE-BF-BG-BH-BI-BJ-BM-BN-BO-BQ-BR-BS-BT-BW-BY-BZ-CA-CD-CG-CH-CI-CL-CM-CN-CO-CR-CU-CV-CW-CY-CZ-DJ-DK-DM-DO-DZ-EC-EE-EG-ER-ES-ET-FI-FJ-FM-FO-GA-GB-GD-GE-GF-GG-GH-GI-GL-GM-GN-GP-GQ-GR-GT-GU-GW-GY-HK-HN-HR-HT-HU-ID-IE-IL-IM-IN-IQ-IR-IS-JE-JM-JO-JP-KE-KG-KH-KM-KN-KR-KW-KY-KZ-LA-LB-LC-LI-LK-LR-LS-LT-LU-LV-LY-MA-MC-MD-ME-MF-MG-MH-MK-ML-MM-MN-MO-MP-MQ-MR-MS-MT-MU-MV-MW-MX-MY-MZ-NA-NC-NE-NG-NI-NL-NO-NP-NZ-OM-PA-PE-PF-PG-PH-PK-PL-PR-PS-PT-PW-PY-QA-RE-RO-RS-RU-RW-SA-SB-SC-SD-SE-SG-SH-SI-SK-SL-SM-SN-SO-SR-SS-ST-SV-SX-SY-SZ-TC-TG-TH-TJ-TL-TN-TO-TR-TT-TW-TZ-UA-UG-UY-UZ-VC-VE-VG-VI-VN-VU-WS-YE-YT-ZA-ZM-ZW-rotate',
  password: '6b1lhjc8eou2',
};

const browser = await chromium.launch({ proxy: PROXY });

try {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // World Cup 2026: tournament=16, season=58210
  // Probar rounds 1-50 para cubrir grupos + KO
  const endpoints = [];
  for (let r = 1; r <= 50; r++) {
    endpoints.push(`https://api.sofascore.com/api/v1/unique-tournament/16/season/58210/events/round/${r}`);
  }

  const results = await page.evaluate(async (urls) => {
    const out = {};
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' }
        });
        if (res.status === 200) {
          out[url] = await res.text();
        }
      } catch(_) {}
    }
    return out;
  }, endpoints);

  const allMatches = [];

  for (const [url, data] of Object.entries(results)) {
    try {
      const parsed = JSON.parse(data);
      const events = parsed.events || [];
      if (!events.length) continue;
      for (const ev of events) {
        allMatches.push({
          sofascore_id: ev.id,
          home: ev.homeTeam?.name || '?',
          away: ev.awayTeam?.name || '?',
          round: ev.roundInfo?.name || ev.roundInfo?.round || '?',
          group: ev.tournament?.name || '',
          date: ev.startTimestamp ? new Date(ev.startTimestamp * 1000).toISOString().slice(0, 16) : '?',
          status: ev.status?.type || '?',
          venue: ev.venue?.name || '',
          city: ev.venue?.city?.name || '',
        });
      }
    } catch(_) {}
  }

  // Ordenar por fecha
  allMatches.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`Total partidos encontrados: ${allMatches.length}`);
  console.log('');

  // Mostrar resumen por round
  const byRound = {};
  for (const m of allMatches) {
    const key = m.round;
    if (!byRound[key]) byRound[key] = [];
    byRound[key].push(m);
  }
  for (const [round, matches] of Object.entries(byRound)) {
    console.log(`--- ${round} (${matches.length} partidos) ---`);
    for (const m of matches) {
      console.log(`  ${m.sofascore_id} | ${m.home} vs ${m.away} | ${m.date} | ${m.group}`);
    }
  }

  // Guardar fichero JSON completo
  writeFileSync('worldcup-2026-sofascore-ids.json', JSON.stringify(allMatches, null, 2));
  console.log('\nGuardado en worldcup-2026-sofascore-ids.json');

  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

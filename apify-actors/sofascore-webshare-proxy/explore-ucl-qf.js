import { chromium } from 'playwright';

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

  // UCL 24/25 season=61644, probar rounds de QF (cuartos)
  // Los rounds en knockout suelen ser: QF=round 8 o "Quarter-finals"
  const endpoints = [];
  // Probar rounds del 1 al 15 para encontrar QF
  for (let r = 1; r <= 15; r++) {
    endpoints.push(`https://api.sofascore.com/api/v1/unique-tournament/7/season/61644/events/round/${r}`);
  }

  const results = await page.evaluate(async (urls) => {
    const out = {};
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' }
        });
        if (res.status === 200) {
          out[url] = { status: 200, data: await res.text() };
        } else {
          out[url] = { status: res.status };
        }
      } catch(e) {
        out[url] = { error: e.message };
      }
    }
    return out;
  }, endpoints);

  for (const [url, result] of Object.entries(results)) {
    if (result.status !== 200) continue;
    try {
      const parsed = JSON.parse(result.data);
      const events = parsed.events || [];
      if (!events.length) continue;
      const roundName = events[0]?.roundInfo?.name || `round ${url.split('/').pop()}`;
      console.log(`\n=== ${roundName} (${events.length} partidos) ===`);
      for (const ev of events) {
        const home = ev.homeTeam?.name || '?';
        const away = ev.awayTeam?.name || '?';
        const id = ev.id;
        const startTs = ev.startTimestamp;
        const date = startTs ? new Date(startTs * 1000).toISOString().slice(0, 16) : '?';
        const status = ev.status?.type || '?';
        const scoreH = ev.homeScore?.current ?? '-';
        const scoreA = ev.awayScore?.current ?? '-';
        console.log(`  ${id} | ${home} ${scoreH}-${scoreA} ${away} | ${date} | ${status}`);
      }
    } catch(_) {}
  }

  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

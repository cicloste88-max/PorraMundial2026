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
  await page.goto('https://www.sofascore.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  // Llamar a varios endpoints para encontrar UCL y sus partidos
  const endpoints = [
    // UCL es tournament 7 en SofaScore — sacar season actual
    'https://api.sofascore.com/api/v1/unique-tournament/7/seasons',
    // Copa del Mundo FIFA 2026 — buscar el ID
    'https://api.sofascore.com/api/v1/unique-tournament/16/seasons',
  ];

  const results = await page.evaluate(async (urls) => {
    const out = {};
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' }
        });
        out[url] = { status: res.status, data: await res.text() };
      } catch(e) {
        out[url] = { error: e.message };
      }
    }
    return out;
  }, endpoints);

  // Parse y mostrar resultados
  for (const [url, result] of Object.entries(results)) {
    console.log(`\n=== ${url} ===`);
    console.log(`Status: ${result.status}`);
    if (result.data) {
      try {
        const parsed = JSON.parse(result.data);
        // Mostrar primeras 5 seasons
        if (parsed.seasons) {
          console.log(`Seasons encontradas: ${parsed.seasons.length}`);
          for (const s of parsed.seasons.slice(0, 5)) {
            console.log(`  - id:${s.id} name:"${s.name}" year:"${s.year}"`);
          }
        } else {
          console.log(JSON.stringify(parsed, null, 2).substring(0, 500));
        }
      } catch(_) {
        console.log(result.data.substring(0, 300));
      }
    }
    if (result.error) console.log(`Error: ${result.error}`);
  }

  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

// netlify/functions/send-frost-alert.js
// Triggered nightly by a GitHub Actions cron job.
// Fetches Open-Meteo forecast, computes risk, and emails
// subscribers (stored in Netlify Forms) via Resend.
//
// Required environment variables (set in Netlify UI → Site Settings → Environment):
//   RESEND_API_KEY       — from resend.com (free tier: 3000 emails/month)
//   NETLIFY_API_TOKEN    — from netlify.com → User Settings → Personal Access Tokens
//   NETLIFY_SITE_ID      — your site's UUID, visible in Netlify Site Settings
//   FUNCTION_SECRET      — a random secret string you choose (shared with GitHub Action)
//   FROM_EMAIL           — sender address, e.g. "frostwächter@datAgronomist.com"

const LAT = 51.48, LON = 11.97;
const FORECAST_API =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&hourly=temperature_2m,cloud_cover,wind_speed_10m,relative_humidity_2m,soil_temperature_0cm` +
  `&daily=sunrise,sunset,temperature_2m_min&timezone=Europe%2FBerlin&forecast_days=2`;

// ── Risk scoring (mirrors frontend logic) ──────────────────────────
function computeRisk(minTemp, avgCloud, avgWind, avgHum, minSoil) {
  let s = 0;
  if (minTemp <= 0) s += 4; else if (minTemp <= 1) s += 3;
  else if (minTemp <= 3) s += 2; else if (minTemp <= 5) s += 1;
  if (avgCloud < 10) s += 3; else if (avgCloud < 25) s += 2;
  else if (avgCloud < 45) s += 1; else if (avgCloud > 70) s -= 1;
  if (avgWind < 1) s += 2; else if (avgWind < 2) s += 1.5;
  else if (avgWind < 3.5) s += 0.5; else if (avgWind > 5) s -= 0.5;
  if (avgHum < 55) s += 0.5; else if (avgHum > 85) s -= 0.5;
  if (minSoil !== null && minSoil < minTemp - 1.5) s += 1;
  else if (minSoil !== null && minSoil < minTemp - 0.5) s += 0.5;
  return Math.max(0, Math.min(10, Math.round(s * 10) / 10));
}

function riskLabel(score) {
  if (score <= 1.5) return { de:'Kein Frost',     en:'No Frost Risk' };
  if (score <= 3.5) return { de:'Geringes Risiko', en:'Low Risk' };
  if (score <= 5.5) return { de:'Mäßiges Risiko',  en:'Moderate Risk' };
  if (score <= 7.5) return { de:'Hohes Risiko',    en:'High Risk' };
  return               { de:'Extremes Risiko',  en:'Extreme Risk' };
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function minOf(arr) { return arr.length ? Math.min(...arr) : null; }

// ── Get tonight's night hours from hourly data ────────────────────
function getNightIndices(hourly, sunriseStr, sunsetStr, dateStr) {
  const sunsetH = parseInt(sunsetStr.split('T')[1].split(':')[0]);
  const sunriseH = parseInt(sunriseStr.split('T')[1].split(':')[0]);
  const [y,m,d] = dateStr.split('-').map(Number);
  const nd = new Date(y,m-1,d+1);
  const next = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`;
  return hourly.time.reduce((acc, t, i) => {
    const [day, hr] = t.split('T');
    const h = parseInt(hr.split(':')[0]);
    if ((day === dateStr && h >= sunsetH) || (day === next && h <= sunriseH)) acc.push(i);
    return acc;
  }, []);
}

// ── Fetch subscribers from Netlify Forms ──────────────────────────
async function getSubscribers() {
  const { NETLIFY_API_TOKEN, NETLIFY_SITE_ID } = process.env;
  let page = 1, allSubs = [];
  while (true) {
    const res = await fetch(
      `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/forms/frost-alert-signup/submissions?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${NETLIFY_API_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`Netlify API error: ${res.status}`);
    const subs = await res.json();
    if (subs.length === 0) break;
    allSubs = allSubs.concat(subs);
    if (subs.length < 100) break;
    page++;
  }
  return allSubs.map(s => ({
    email: s.data.email,
    threshold: parseFloat(s.data.threshold || '6')
  })).filter(s => s.email);
}

// ── Send email via Resend ──────────────────────────────────────────
async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'Frostwächter <alerts@datAgronomist.com>',
      to,
      subject,
      html
    })
  });
  return res.ok;
}

// ── HTML email template ────────────────────────────────────────────
function buildEmailHtml(score, label, minTemp, avgCloud, avgWind, dateStr, lang = 'de') {
  const isDE = lang === 'de';
  const urgency = score >= 8 ? '#b83232' : score >= 6 ? '#d4621a' : '#c9a020';
  const cloudDesc = avgCloud < 20 ? (isDE ? 'wolkenlos' : 'clear sky') :
                    avgCloud < 50 ? (isDE ? 'teils bewölkt' : 'partly cloudy') :
                                    (isDE ? 'bedeckt' : 'overcast');
  const windDesc = avgWind < 1.5 ? (isDE ? 'sehr still' : 'very calm') :
                   avgWind < 3 ? (isDE ? 'schwacher Wind' : 'light wind') :
                                 (isDE ? 'mäßiger Wind' : 'moderate wind');
  const [y,m,d] = dateStr.split('-').map(Number);
  const months_de = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const months_en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateFormatted = `${d}. ${isDE ? months_de[m-1] : months_en[m-1]}`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>
    body{font-family:Georgia,serif;background:#f4efe4;margin:0;padding:20px;}
    .wrap{max-width:540px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0d8cc;}
    .hdr{background:#1e140a;color:#f4efe4;padding:28px 32px;text-align:center;}
    .hdr h1{font-size:28px;margin:0 0 4px;} .hdr h1 em{color:#6a9e79;font-style:italic;}
    .hdr p{font-size:13px;opacity:.6;margin:0;}
    .body{padding:28px 32px;}
    .score-row{display:flex;align-items:center;gap:20px;margin:20px 0;padding:20px;
      background:#fafafa;border-radius:8px;border-left:4px solid ${urgency};}
    .score-num{font-size:52px;font-weight:700;color:${urgency};font-family:Georgia,serif;line-height:1;}
    .score-info h2{color:${urgency};font-size:20px;margin:0 0 4px;}
    .score-info p{color:#5a4232;font-size:13px;margin:0;}
    .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0;}
    .meta-item{background:#f4efe4;border-radius:6px;padding:12px;text-align:center;}
    .meta-item .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#7a6050;margin-bottom:4px;}
    .meta-item .val{font-size:18px;font-weight:700;color:#1e140a;}
    .tips{background:#d4e8da;border-radius:8px;padding:16px 20px;margin:20px 0;}
    .tips h3{color:#2a5c3a;font-size:14px;margin:0 0 8px;}
    .tips ul{margin:0 0 0 16px;padding:0;color:#2a5c3a;font-size:13px;line-height:1.8;}
    .cta{text-align:center;margin:24px 0 8px;}
    .cta a{background:#4a7c59;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;}
    .footer{font-size:11px;color:#9a8a7a;text-align:center;padding:16px 32px;border-top:1px solid #e0d8cc;}
    .footer a{color:#4a7c59;}
  </style></head><body>
  <div class="wrap">
    <div class="hdr">
      <h1>Frost<em>wächter</em></h1>
      <p>${isDE ? `Inversionsfrost-Warnung · Halle (Saale) · ${dateFormatted}` : `Inversion Frost Warning · Halle (Saale) · ${dateFormatted}`}</p>
    </div>
    <div class="body">
      <p style="color:#5a4232;font-size:14px;margin:0 0 8px">
        ${isDE ? `Für die Nacht auf <strong>${dateFormatted}</strong> wird Inversionsfrost mit erhöhtem Risiko vorhergesagt:`
                : `Inversion frost with elevated risk is forecast for the night of <strong>${dateFormatted}</strong>:`}
      </p>
      <div class="score-row">
        <div class="score-num">${score.toFixed(1)}</div>
        <div class="score-info">
          <h2>${label[isDE ? 'de' : 'en']}</h2>
          <p>${isDE ? 'Risiko-Score / 10' : 'Risk Score / 10'}</p>
        </div>
      </div>
      <div class="meta">
        <div class="meta-item">
          <div class="lbl">${isDE ? 'Tiefsttemp.' : 'Min Temp.'}</div>
          <div class="val">${minTemp.toFixed(1)} °C</div>
        </div>
        <div class="meta-item">
          <div class="lbl">${isDE ? 'Bewölkung' : 'Cloud'}</div>
          <div class="val">${cloudDesc}</div>
        </div>
        <div class="meta-item">
          <div class="lbl">${isDE ? 'Wind' : 'Wind'}</div>
          <div class="val">${windDesc}</div>
        </div>
      </div>
      <div class="tips">
        <h3>🌿 ${isDE ? 'Empfohlene Maßnahmen:' : 'Recommended actions:'}</h3>
        <ul>
          ${score >= 8 ?
            (isDE ? '<li>DRINGEND: Alle Pflanzen abdecken oder reinbringen</li><li>Kübelpflanzen sofort schützen</li><li>Abends bewässern für mehr Wärmepuffer</li>'
                  : '<li>URGENT: Cover or bring in all sensitive plants</li><li>Protect potted plants immediately</li><li>Water in the evening for heat buffering</li>') :
            (isDE ? '<li>Empfindliche Jungpflanzen mit Vlies abdecken</li><li>Kübelpflanzen an geschützte Stelle stellen</li><li>Hochbeete überprüfen und abdecken</li>'
                  : '<li>Cover sensitive seedlings with fleece</li><li>Move potted plants to a sheltered spot</li><li>Check and cover raised beds</li>')}
        </ul>
      </div>
      <div class="cta">
        <a href="https://datAgronomist.com/tools/frostwatcher/">
          ${isDE ? 'Vollständige Vorhersage ansehen →' : 'View full forecast →'}
        </a>
      </div>
    </div>
    <div class="footer">
      ${isDE ? 'Sie erhalten diese E-Mail, weil Sie sich für den Frostwächter angemeldet haben.' : 'You receive this because you subscribed to Frostwächter alerts.'}<br/>
      <a href="https://datAgronomist.com/tools/frostwatcher/#unsubscribe">${isDE ? 'Abmelden' : 'Unsubscribe'}</a> ·
      <a href="https://datAgronomist.com">DatAgronomist</a>
    </div>
  </div>
  </body></html>`;
}

// ── Main handler ───────────────────────────────────────────────────
exports.handler = async (event) => {
  // Verify secret to prevent unauthorised triggers
  const authHeader = event.headers['authorization'] || '';
  if (authHeader !== `Bearer ${process.env.FUNCTION_SECRET}`) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    // 1. Fetch forecast
    const res = await fetch(FORECAST_API);
    if (!res.ok) throw new Error('Open-Meteo fetch failed');
    const data = await res.json();

    const { hourly, daily } = data;
    const dateStr = daily.time[0]; // tonight
    const idx = getNightIndices(hourly, daily.sunrise[0], daily.sunset[0], dateStr);
    if (idx.length === 0) return { statusCode: 200, body: 'No night hours found' };

    const temps  = idx.map(i => hourly.temperature_2m[i]).filter(v => v != null);
    const clouds = idx.map(i => hourly.cloud_cover[i]).filter(v => v != null);
    const winds  = idx.map(i => hourly.wind_speed_10m[i]).filter(v => v != null);
    const hums   = idx.map(i => hourly.relative_humidity_2m[i]).filter(v => v != null);
    const soils  = idx.map(i => hourly.soil_temperature_0cm[i]).filter(v => v != null);

    const minTemp = minOf(temps);
    const score   = computeRisk(minTemp, avg(clouds), avg(winds), avg(hums), minOf(soils));
    const label   = riskLabel(score);

    console.log(`Tonight's frost risk score: ${score}/10`);

    // 2. Fetch subscribers
    const subscribers = await getSubscribers();
    console.log(`Found ${subscribers.length} subscriber(s)`);

    // 3. Send emails to those whose threshold is met
    let sent = 0, skipped = 0;
    for (const sub of subscribers) {
      if (score < sub.threshold) { skipped++; continue; }
      const subjectDE = `🌡️ Frostwarnung Halle — Risiko ${score.toFixed(1)}/10 heute Nacht`;
      const subjectEN = `🌡️ Frost Warning Halle — Risk ${score.toFixed(1)}/10 tonight`;
      const html = buildEmailHtml(score, label, minTemp, avg(clouds), avg(winds), dateStr);
      const ok = await sendEmail(sub.email, subjectDE, html);
      if (ok) sent++; else skipped++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ score, sent, skipped, subscribers: subscribers.length })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};

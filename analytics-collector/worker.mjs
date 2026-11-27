const origin = 'https://sichaoj.github.io';
const cors = { 'Access-Control-Allow-Origin': origin };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const page = /^\/(?:[\w-]+\.html|writeups\/[\w-]+\.html)?$/;
const dayMs = 86400000;
const localDate = (timestamp) => new Date(timestamp + 8 * 3600000);
const isoDay = (date) => date.toISOString().slice(0, 10);
const offset = (day, days) => isoDay(new Date(Date.parse(day) + days * dayMs));

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/collect' ||
        request.headers.get('Origin') !== origin || request.method !== 'POST') {
      return new Response(null, { status: 404 });
    }
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers: cors });
    const decoder = new TextDecoder();
    let size = 0;
    let body = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return new Response(null, { status: 413, headers: cors });
      }
      body += decoder.decode(value, { stream: true });
    }

    let event;
    try { event = JSON.parse(body + decoder.decode()); } catch {}
    if (!validEvent(event)) return new Response(null, { status: 400, headers: cors });

    const country = /^[A-Z]{2}$/.test(request.cf?.country ?? '') ? request.cf.country : 'ZZ';
    await env.ANALYTICS.prepare(
      'INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(event.id, isoDay(localDate(Date.now())), event.visitor, country,
      event.kind, event.path === '/' ? '/index.html' : event.path, event.detail).run();
    return new Response(null, { status: 204, headers: cors });
  },

  async scheduled(controller, env) {
    await exportReports(env, isoDay(localDate(controller.scheduledTime)));
  }
};

function validEvent(event) {
  if (!event || !['id', 'visitor', 'kind', 'path', 'detail'].every(
    (field) => typeof event[field] === 'string'
  ) || !uuid.test(event.id) || !uuid.test(event.visitor) || !page.test(event.path) ||
    event.path.length > 200) return false;

  switch (event.kind) {
    case 'view': return event.detail === '';
    case 'depth': return event.path.startsWith('/writeups/') &&
      ['25', '50', '75', '100'].includes(event.detail);
    case 'click': return event.detail.length <= 400 &&
      /^(?:email|[a-z0-9][a-z0-9.-]*\/[\w.%~:@+/-]*)$/i.test(event.detail);
    default: return false;
  }
}

const dailyQuery = `
  SELECT 'daily_visitors' AS metric, '' AS page, '' AS detail,
         COUNT(DISTINCT visitor) AS count FROM events WHERE day = ?1 AND kind = 'view'
  UNION ALL
  SELECT 'country_visitors', '', country, COUNT(DISTINCT visitor)
    FROM events WHERE day = ?1 AND kind = 'view' GROUP BY country
  UNION ALL
  SELECT 'post_views', path, '', COUNT(*)
    FROM events WHERE day = ?1 AND kind = 'view' AND path LIKE '/writeups/%' GROUP BY path
  UNION ALL
  SELECT 'post_visitors', path, '', COUNT(DISTINCT visitor)
    FROM events WHERE day = ?1 AND kind = 'view' AND path LIKE '/writeups/%' GROUP BY path
  UNION ALL
  SELECT 'reading_depth', path, detail, COUNT(*)
    FROM events WHERE day = ?1 AND kind = 'depth' GROUP BY path, detail
  UNION ALL
  SELECT 'key_link_clicks', path, detail, COUNT(*)
    FROM events WHERE day = ?1 AND kind = 'click' GROUP BY path, detail
  ORDER BY metric, page, detail`;

async function exportReports(env, today) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.REPORT_REPOSITORY ?? '') || !env.GITHUB_TOKEN) {
    throw new Error('Configure REPORT_REPOSITORY and GITHUB_TOKEN');
  }
  const db = env.ANALYTICS;
  const cursor = await db.prepare('SELECT day FROM export_cursor WHERE id = 1').first('day');
  let day = cursor ? offset(cursor, 1) :
    await db.prepare('SELECT MIN(day) AS day FROM events').first('day');
  if (!day || day >= today) return;

  const repo = '/repos/' + env.REPORT_REPOSITORY;
  const metadata = await (await github(env, repo)).json();
  if (metadata.private !== true) throw new Error('The report repository must be private');

  for (let exported = 0; day < today && exported < 7; exported++, day = offset(day, 1)) {
    const { results } = await db.prepare(dailyQuery).bind(day).all();
    const rows = [['period_start', 'period_end', 'metric', 'page', 'detail', 'count']];
    for (const { metric, page, detail, count } of results) {
      rows.push([day, day, metric, page, detail, count]);
    }
    const finishedWeek = new Date(day).getUTCDay() === 0;
    if (finishedWeek) {
      const monday = offset(day, -6);
      const count = await db.prepare(
        "SELECT COUNT(DISTINCT visitor) AS count FROM events WHERE day BETWEEN ? AND ? AND kind = 'view'"
      ).bind(monday, day).first('count');
      rows.push([monday, day, 'weekly_visitors', '', '', count]);
    }

    await uploadCsv(env, repo, day, rows);
    const statements = [db.prepare(
      'INSERT INTO export_cursor VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET day = MAX(day, excluded.day)'
    ).bind(day)];
    if (finishedWeek) statements.push(db.prepare('DELETE FROM events WHERE day <= ?').bind(day));
    await db.batch(statements);
  }
}

async function uploadCsv(env, repo, day, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
  const path = repo + '/contents/analytics/' + day + '.csv';
  const existing = await github(env, path, {}, true);
  const sha = existing.ok ? (await existing.json()).sha : undefined;
  const bytes = new TextEncoder().encode(csv);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  await github(env, path, {
    method: 'PUT',
    body: JSON.stringify({ message: 'Export analytics for ' + day, content: btoa(binary), sha })
  });
}

function csvCell(value) {
  const text = String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

async function github(env, path, options = {}, allowMissing = false) {
  const response = await fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'sichaoj-site-analytics'
    }
  });
  if (!response.ok && !(allowMissing && response.status === 404)) {
    throw new Error('GitHub API returned ' + response.status);
  }
  return response;
}

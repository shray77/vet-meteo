#!/usr/bin/env node
/**
 * tools/curate_outbreaks.mjs — курация вспышек для слоя карты дашборда.
 * Источник: research-бэкап WAHIS/ФСВПС (в git-истории:
 *   git show d5bc1da:research/shray77/outbreaks_backup.json > /tmp/outbreaks_backup.json
 *   node tools/curate_outbreaks.mjs /tmp/outbreaks_backup.json
 * Фильтр: ТОЛЬКО Ростовская область, дата >= 2019,
 * без хронических технических (лейкоз, нозематоз, варрооз) — они не «вспышки».
 * Выход: docs/data/outbreaks.json (компактные ключи, ~35 КБ).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/curate_outbreaks.mjs <outbreaks_backup.json>');
  process.exit(1);
}
const backup = JSON.parse(readFileSync(src, 'utf8'));

const REGIONS = ['Ростовская'];
const EXCLUDE = new Set(['leukosis', 'nosemosis', 'varroosis']);
const SHORT = {
  asf: 'АЧС', hpai: 'ГПАП', fmd: 'Ящур', rabies: 'Бешенство', brucellosis: 'Бруцеллёз',
  anthrax: 'Сибирка', lsd: 'ЛШД', bluetongue: 'Блютанг', wnv: 'ВЗН', lepto: 'Лептоспироз',
  trichinellosis: 'Трихинеллёз', newcastle: 'Ньюкасл', csf: 'КЧС', ppr: 'ЧМР',
  avian_salmonellosis: 'Сальмонеллёз пт.', eia: 'ИНАН', btb: 'ТБ КРС', svc: 'ВВК карпа', other: 'Прочее',
};

const recs = [];
for (const o of backup.outbreaks || []) {
  const region = o.region || '';
  const date = o.date || '';
  if (!REGIONS.some((r) => region.includes(r))) continue;
  if (date < '2019') continue;
  if (EXCLUDE.has(o.disease_key)) continue;
  if (o.lat == null || o.lon == null) continue;
  recs.push({
    k: o.disease_key,
    n: SHORT[o.disease_key] || o.disease_key,
    dt: date,
    r: region,
    la: +(+o.lat).toFixed(3),
    lo: +(+o.lon).toFixed(3),
    c: o.cases ?? null,
    d: o.deaths ?? null,
    st: o.status === 'Resolved' ? 0 : 1, // 1 = активная/не закрыта
  });
}
recs.sort((a, b) => (a.dt < b.dt ? 1 : -1));

const out = {
  updated: new Date().toISOString().slice(0, 10),
  note: 'WAHIS/ФСВПС, только Ростовская обл., с 2019 г. (курация бэкапа; координаты части записей — центроид района)',
  total: recs.length,
  diseases: [...new Set(recs.map((r) => r.n))],
  outbreaks: recs,
};
mkdirSync(join(ROOT, 'docs', 'data'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'data', 'outbreaks.json'), JSON.stringify(out));
console.log(`OK: ${recs.length} вспышек, болезни: ${out.diseases.join(', ')}`);

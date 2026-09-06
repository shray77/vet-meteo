#!/usr/bin/env node
/**
 * ro_only_outbreaks.mjs — перефильтровать docs/data/outbreaks.json
 * строго до Ростовской области (юзер: «не только по ростову и области»).
 * Вход уже в компактном формате куратора {k,n,dt,r,la,lo,c,d,st}.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'docs', 'data', 'outbreaks.json');
const d = JSON.parse(readFileSync(FILE, 'utf8'));

const keep = (d.outbreaks || []).filter((o) => (o.r || '').includes('Ростовская'));
const out = {
  ...d,
  note: 'WAHIS/ФСВПС, только Ростовская обл., с 2019 г. (курация бэкапа vet-heatmap; координаты части записей — центроид района)',
  total: keep.length,
  diseases: [...new Set(keep.map((r) => r.n))],
  outbreaks: keep,
};
writeFileSync(FILE, JSON.stringify(out));
console.log(`OK: ${keep.length} вспышек (было ${d.total}), болезни: ${out.diseases.join(', ')}`);

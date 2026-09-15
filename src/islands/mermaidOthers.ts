/**
 * mermaidOthers — flowchart 가 아닌 Mermaid 블록(gantt, sequenceDiagram)을 섬으로.
 *
 * v3.91.0: 실데이터 조사 결과 mermaid 블록 287개 중 flowchart 251 · gantt 21 · sequenceDiagram 10.
 *  - gantt    : 글자 크기 고정 SVG 간트. 섹션 묶음, done/active/crit/milestone, 오늘 선.
 *  - sequence : 참여자 칩 + 메시지 목록(DOM). 폰에서도 위아래로만 읽힌다. loop/alt/opt 블록은 들여쓴 묶음.
 *  판별이 안 되면 null → Mermaid 그대로.
 */
import { resolveIslandTokens, measureText, svgEl, svgText } from './islandTokens';
import type { IslandTokens } from './islandTokens';

// ────────────────────────────────────────────────────────────────────────────
// gantt
// ────────────────────────────────────────────────────────────────────────────

export interface GanttTask { name: string; section: string; start: Date; end: Date; tags: string[]; id?: string }
export interface GanttModel { title: string; tasks: GanttTask[]; sections: string[] }

const DATE_RE = /^\d{4}[-.]\d{2}(?:[-.]\d{2})?$/;
const DUR_RE = /^(\d+(?:\.\d+)?)\s*(d|w|h|m)$/i;

/** YYYY-MM-DD 또는 YYYY-MM(월 단위 dateFormat). endOfMonth 면 그 달 말일로. */
function parseDate(s: string, endOfMonth = false): Date | null {
  if (!DATE_RE.test(s)) return null;
  const parts = s.split(/[-.]/).map(Number);
  if (parts.length === 2) return endOfMonth ? new Date(parts[0], parts[1], 0) : new Date(parts[0], parts[1] - 1, 1);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function parseGantt(src: string): GanttModel | null {
  const lines = src.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  if (!lines.length || !/^gantt\b/.test(lines[0])) return null;
  const model: GanttModel = { title: '', tasks: [], sections: [] };
  let section = '';
  const byId = new Map<string, GanttTask>();
  for (const line of lines.slice(1)) {
    if (/^title\s+/.test(line)) { model.title = line.replace(/^title\s+/, ''); continue; }
    if (/^(dateFormat|axisFormat|excludes|todayMarker|tickInterval|weekday)\b/.test(line)) continue;
    if (/^section\s+/.test(line)) { section = line.replace(/^section\s+/, '').trim(); model.sections.push(section); continue; }
    const m = /^(.+?)\s*:\s*(.+)$/.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    const parts = m[2].split(',').map(x => x.trim()).filter(Boolean);
    const tags: string[] = []; let id: string | undefined; let start: Date | null = null; let end: Date | null = null; let dur: number | null = null; let afterId: string | null = null;
    for (const p of parts) {
      if (/^(done|active|crit|milestone)$/i.test(p)) { tags.push(p.toLowerCase()); continue; }
      const dt = parseDate(p, !!start);
      if (dt) { if (!start) start = dt; else end = dt; continue; }
      const dm = DUR_RE.exec(p);
      if (dm) { const n = parseFloat(dm[1]); const u = dm[2].toLowerCase(); dur = u === 'w' ? n * 7 : u === 'h' ? n / 24 : u === 'm' ? n / 1440 : n; continue; }
      const am = /^after\s+(\S+)/.exec(p);
      if (am) { afterId = am[1]; continue; }
      if (!id && /^[A-Za-z_][\w-]*$/.test(p)) { id = p; continue; }
    }
    if (!start && afterId && byId.has(afterId)) start = byId.get(afterId)!.end;
    if (!start) continue;
    if (!end) end = dur !== null ? addDays(start, dur) : addDays(start, 1);
    if (tags.includes('milestone')) end = start;
    const t: GanttTask = { name, section, start, end, tags, id };
    model.tasks.push(t); if (id) byId.set(id, t);
  }
  return model.tasks.length ? model : null;
}

function fmtMD(d: Date): string { return `${d.getMonth() + 1}/${d.getDate()}`; }

export function renderGantt(model: GanttModel, width: number): string {
  const t: IslandTokens = resolveIslandTokens();
  const W = Math.max(320, width), SZ = 12;
  let labelW = 0; for (const tk of model.tasks) labelW = Math.max(labelW, measureText(tk.name, SZ, 500, t.font));
  const LW = Math.min(Math.max(96, Math.ceil(labelW) + 12), Math.floor(W * 0.42));
  const x0 = LW + 10, x1 = W - 8, rowH = 24, secH = 22, mT = 22;
  const min = new Date(Math.min(...model.tasks.map(x => x.start.getTime()))), max = new Date(Math.max(...model.tasks.map(x => x.end.getTime())));
  const span = Math.max(1, (max.getTime() - min.getTime()) / 86400000);
  const pad = Math.max(1, Math.round(span * 0.04));
  const d0 = addDays(min, -pad), d1 = addDays(max, pad);
  const total = (d1.getTime() - d0.getTime()) / 86400000;
  const X = (d: Date) => x0 + ((d.getTime() - d0.getTime()) / 86400000) / total * (x1 - x0);
  let s = '';
  // 축: 기간이 70일 넘으면 월 첫날, 아니면 주 단위
  const ticks: Date[] = [];
  if (total > 70) { const c = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); while (c <= d1) { ticks.push(new Date(c)); c.setMonth(c.getMonth() + 1); } }
  else { const c = new Date(d0); c.setDate(c.getDate() + ((8 - c.getDay()) % 7)); while (c <= d1) { ticks.push(new Date(c)); c.setDate(c.getDate() + 7); } }
  // 행 배치
  let y = mT; const rows: Array<{ y: number; task?: GanttTask; section?: string }> = [];
  const secs = model.sections.length ? model.sections : [''];
  for (const sec of secs) {
    const tasks = model.tasks.filter(x => x.section === sec);
    if (!tasks.length) continue;
    if (sec) { rows.push({ y, section: sec }); y += secH; }
    for (const tk of tasks) { rows.push({ y, task: tk }); y += rowH; }
    y += 6;
  }
  const H = y + 6;
  for (const tk of ticks) { const x = X(tk); s += svgEl('line', { x1: x, y1: mT - 6, x2: x, y2: H - 8, stroke: t.border, 'stroke-width': 1 }); s += svgText(x, mT - 10, total > 70 ? `${tk.getMonth() + 1}월` : fmtMD(tk), { size: 10, fill: t.muted, anchor: 'middle' }, t); }
  const today = new Date(); if (today >= d0 && today <= d1) { const x = X(today); s += svgEl('line', { x1: x, y1: mT - 6, x2: x, y2: H - 8, stroke: t.red, 'stroke-width': 1.2, 'stroke-dasharray': '3,3' }); s += svgText(x + 3, H - 10, '오늘', { size: 9.5, fill: t.red }, t); }
  for (const r of rows) {
    if (r.section) { s += svgText(8, r.y + 14, r.section, { size: 11, weight: 600, fill: t.text2 }, t); continue; }
    const tk = r.task!; const yb = r.y + 5, hb = 14;
    let label = tk.name; while (label.length > 2 && measureText(label, SZ, 500, t.font) > LW - 12) label = label.slice(0, -2) + '…';
    s += svgText(8, r.y + 16, label, { size: SZ, weight: 500, fill: t.text }, t);
    const done = tk.tags.includes('done'), crit = tk.tags.includes('crit'), active = tk.tags.includes('active'), ms = tk.tags.includes('milestone');
    const fill = crit ? t.red : active ? t.primary : done ? t.muted : t.text2;
    if (ms) { const x = X(tk.start); s += svgEl('path', { d: `M${x} ${yb} l7 7 l-7 7 l-7 -7 z`, fill: t.orange }); s += svgText(x + 11, yb + 11, fmtMD(tk.start), { size: 10, fill: t.muted }, t); continue; }
    const xa = X(tk.start), xb = Math.max(X(tk.end), xa + 3);
    s += svgEl('rect', { x: xa, y: yb, width: xb - xa, height: hb, rx: 4, fill, 'fill-opacity': done ? 0.45 : 0.9 });
    const range = `${fmtMD(tk.start)}~${fmtMD(tk.end)}`; const rw = measureText(range, 9.5, 400, t.font);
    if (xb - xa > rw + 10) s += svgText(xa + 6, yb + 10.5, range, { size: 9.5, fill: done ? t.text : t.surface, opacity: 0.95 }, t);
    else s += svgText(xb + 5, yb + 10.5, range, { size: 9.5, fill: t.muted }, t);
  }
  return svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, s);
}

// ────────────────────────────────────────────────────────────────────────────
// sequenceDiagram
// ────────────────────────────────────────────────────────────────────────────

export interface SeqItem { kind: 'msg' | 'note' | 'block' | 'end' | 'else'; from?: string; to?: string; text: string; dashed?: boolean; label?: string }
export interface SeqModel { participants: Map<string, string>; items: SeqItem[] }

function clean(s: string): string { return s.replace(/<br\s*\/?>/gi, ' · ').replace(/\s+/g, ' ').trim(); }

export function parseSequence(src: string): SeqModel | null {
  const lines = src.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  if (!lines.length || !/^sequenceDiagram\b/.test(lines[0])) return null;
  const model: SeqModel = { participants: new Map(), items: [] };
  const name = (id: string) => model.participants.get(id) || id;
  for (const line of lines.slice(1)) {
    let m = /^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/.exec(line);
    if (m) { model.participants.set(m[1], clean(m[2] || m[1])); continue; }
    m = /^Note\s+(?:over|left of|right of)\s+([^:]+):\s*(.+)$/i.exec(line);
    if (m) { model.items.push({ kind: 'note', text: `${m[1].split(',').map(x => name(x.trim())).join(', ')}: ${clean(m[2])}` }); continue; }
    m = /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/.exec(line);
    if (m) { model.items.push({ kind: 'block', label: m[1], text: clean(m[2]) }); continue; }
    m = /^(else|and)\b\s*(.*)$/.exec(line);
    if (m) { model.items.push({ kind: 'else', label: m[1], text: clean(m[2]) }); continue; }
    if (/^end\b/.test(line)) { model.items.push({ kind: 'end', text: '' }); continue; }
    m = /^(\S+?)\s*(-->>|->>|-->|->|-x|--x|-\)|--\))\s*([^:]+?)\s*:\s*(.*)$/.exec(line);
    if (m) {
      if (!model.participants.has(m[1])) model.participants.set(m[1], m[1]);
      if (!model.participants.has(m[3])) model.participants.set(m[3], m[3]);
      model.items.push({ kind: 'msg', from: m[1], to: m[3], text: clean(m[4]), dashed: m[2].startsWith('--') }); continue;
    }
  }
  return model.items.some(i => i.kind === 'msg') ? model : null;
}

function h(tag: string, cls?: string, text?: string): HTMLElement { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

/** 참여자 칩 줄 + 메시지 목록. 순서 번호는 메시지에만 붙는다. */
export function buildSequence(model: SeqModel): HTMLElement {
  const root = h('div', 'ww-seq');
  const head = h('div', 'ww-seq-parts');
  for (const [, label] of model.participants) head.appendChild(h('span', 'ww-chip ww-chip-team', label));
  root.appendChild(head);
  const stack: HTMLElement[] = [root];
  let n = 0;
  const cur = () => stack[stack.length - 1];
  for (const it of model.items) {
    if (it.kind === 'block') { const b = h('div', 'ww-seq-block'); const lb = h('div', 'ww-seq-block-lb'); lb.appendChild(h('span', 'ww-chip', it.label || '')); if (it.text) lb.appendChild(h('span', undefined, it.text)); b.appendChild(lb); cur().appendChild(b); stack.push(b); continue; }
    if (it.kind === 'else') { const lb = h('div', 'ww-seq-block-lb'); lb.appendChild(h('span', 'ww-chip', it.label || 'else')); if (it.text) lb.appendChild(h('span', undefined, it.text)); cur().appendChild(lb); continue; }
    if (it.kind === 'end') { if (stack.length > 1) stack.pop(); continue; }
    if (it.kind === 'note') { cur().appendChild(h('div', 'ww-seq-note', it.text)); continue; }
    n += 1;
    const row = h('div', `ww-seq-msg${it.dashed ? ' ww-dashed' : ''}`);
    row.appendChild(h('span', 'ww-seq-n', String(n)));
    const who = h('span', 'ww-seq-who');
    who.appendChild(h('span', 'ww-chip ww-chip-person', model.participants.get(it.from!) || it.from!));
    who.appendChild(h('i', 'ww-arrow', it.dashed ? '⇢' : '→'));
    who.appendChild(h('span', 'ww-chip ww-chip-person', model.participants.get(it.to!) || it.to!));
    row.appendChild(who);
    row.appendChild(h('span', 'ww-seq-txt', it.text));
    cur().appendChild(row);
  }
  return root;
}

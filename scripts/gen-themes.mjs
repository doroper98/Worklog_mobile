// @ts-nocheck
/**
 * gen-themes.mjs — generate src/styles/themes-extra.css from palettes.json.
 *
 * Each palette declares only 5 colors (primary/bg/bg2/surface/text). Every
 * other mobile token — including the mobile-only --glass-* and --scrim — is
 * derived here so the ported themes stay consistent with the base token set.
 *
 * Run:  node scripts/gen-themes.mjs
 * Do NOT hand-edit themes-extra.css — it is a generated artifact (SC-57).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../src/styles/palettes.json')
const OUT = resolve(here, '../src/styles/themes-extra.css')

// ─── Color math (WCAG) ─────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function channelLuminance(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance (0..1). */
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** WCAG contrast ratio between two hex colors (1..21). */
function contrast(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** Pick a legible text color to sit on top of an accent fill. */
function onColor(hex) {
  return relativeLuminance(hex) > 0.45 ? '#1A1B26' : '#FFFFFF'
}

// ─── Shared (theme-independent) values inherited from the dark base ─────────

const CATEGORY = {
  meet: '#F7768E',
  task: '#7AA2F7',
  memo: '#E0AF68',
  personal: '#BB9AF7',
  daily: '#9ECE6A',
}
const SEMANTIC = {
  danger: '#F7768E',
  success: '#9ECE6A',
  warning: '#E0AF68',
}

// ─── Emit one theme block ───────────────────────────────────────────────────

function block(p) {
  const warnings = []

  // Auto-correct body text contrast (warn, don't fail — §4.5).
  let text = p.text
  if (contrast(text, p.bg) < 4.5) {
    const corrected = p.mode === 'dark' ? '#FFFFFF' : '#000000'
    warnings.push(
      `  ${p.key}: text ${text} on bg ${p.bg} is ${contrast(text, p.bg).toFixed(2)}:1 (<4.5) → corrected to ${corrected}`,
    )
    text = corrected
  }

  const accentOn = onColor(p.primary)
  const scrim = p.mode === 'dark'
    ? 'rgba(0, 0, 0, 0.55)'
    : 'color-mix(in srgb, var(--color-text) 38%, transparent)'

  const lines = [
    `[data-theme="${p.key}"] {`,
    `  /* Base surfaces */`,
    `  --color-bg: ${p.bg};`,
    `  --color-bg2: ${p.bg2};`,
    `  --color-surface: ${p.surface};`,
    `  --color-surface-alt: color-mix(in srgb, var(--color-surface) 92%, var(--color-text));`,
    `  --color-surface-warm: color-mix(in srgb, var(--color-surface) 88%, var(--color-accent));`,
    ``,
    `  /* Borders */`,
    `  --color-border: color-mix(in srgb, var(--color-text) 10%, transparent);`,
    `  --color-border-strong: color-mix(in srgb, var(--color-text) 18%, transparent);`,
    `  --color-hairline: color-mix(in srgb, var(--color-text) 6%, transparent);`,
    ``,
    `  /* Text */`,
    `  --color-text: ${text};`,
    `  --color-text-sec: color-mix(in srgb, var(--color-text) 70%, transparent);`,
    `  --color-text-muted: color-mix(in srgb, var(--color-text) 48%, transparent);`,
    `  --color-text-faint: color-mix(in srgb, var(--color-text) 30%, transparent);`,
    ``,
    `  /* Accent */`,
    `  --color-accent: ${p.primary};`,
    `  --color-accent-hover: color-mix(in srgb, var(--color-accent) 85%, var(--color-text));`,
    `  --color-accent-soft: color-mix(in srgb, var(--color-accent) 14%, transparent);`,
    `  --color-accent-faint: color-mix(in srgb, var(--color-accent) 22%, transparent);`,
    `  --color-accent-text-on: ${accentOn};`,
    ``,
    `  /* Category (inherited from dark base) */`,
    `  --color-meet: ${CATEGORY.meet};`,
    `  --color-task: ${CATEGORY.task};`,
    `  --color-memo: ${CATEGORY.memo};`,
    `  --color-personal: ${CATEGORY.personal};`,
    `  --color-daily: ${CATEGORY.daily};`,
    ``,
    `  /* Semantic */`,
    `  --color-danger: ${SEMANTIC.danger};`,
    `  --color-success: ${SEMANTIC.success};`,
    `  --color-warning: ${SEMANTIC.warning};`,
    ``,
    `  /* Skeleton */`,
    `  --color-skel: color-mix(in srgb, var(--color-text) 8%, transparent);`,
    `  --color-skel2: color-mix(in srgb, var(--color-text) 4%, transparent);`,
    ``,
    `  /* Liquid Glass (derived from theme background) */`,
    `  --glass-bg: color-mix(in srgb, var(--color-bg) 68%, transparent);`,
    `  --glass-bg-sheet: color-mix(in srgb, var(--color-surface) 85%, transparent);`,
    `  --glass-highlight: color-mix(in srgb, var(--color-text) 10%, transparent);`,
    `  --glass-border: color-mix(in srgb, var(--color-text) 12%, transparent);`,
    `  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.2);`,
    `  --glass-shadow-strong: 0 20px 60px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.25);`,
    `  --glass-blur: 28px;`,
    `  --glass-blur-strong: 40px;`,
    `  --glass-saturate: 170%;`,
    `  --glass-saturate-strong: 180%;`,
    `  --glass-tint: color-mix(in srgb, var(--color-bg) 70%, transparent);`,
    `  --scrim: ${scrim};`,
    ``,
    `  /* Opaque fallback for no-blur environments */`,
    `  --bg-opaque: ${p.bg};`,
    `}`,
  ]

  return { css: lines.join('\n'), warnings }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const data = JSON.parse(readFileSync(SRC, 'utf-8'))
const allWarnings = []
const blocks = data.palettes.map((p) => {
  const { css, warnings } = block(p)
  allWarnings.push(...warnings)
  return css
})

const header = `/*
 * themes-extra.css — GENERATED by scripts/gen-themes.mjs from palettes.json.
 * Do not edit by hand. Run \`node scripts/gen-themes.mjs\` to regenerate.
 *
 * Ported desktop themes (dark family). Each block overrides the full mobile
 * token set so selecting a theme fixes it regardless of the OS color scheme.
 */
`

writeFileSync(OUT, header + '\n' + blocks.join('\n\n') + '\n', 'utf-8')

if (allWarnings.length) {
  console.warn('gen-themes: contrast corrections applied:')
  for (const w of allWarnings) console.warn(w)
}
console.log(`gen-themes: wrote ${data.palettes.length} themes → ${OUT}`)

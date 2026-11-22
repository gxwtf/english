#!/usr/bin/env node
/**
 * 颜色 / 深色模式自检 —— 广学英语 & 作文积累本专用（方案见 docs/dark-mode.md）
 *
 * 用法：
 *   pnpm check:colors                 # 自检，有问题退出码 1
 *   pnpm check:colors --verbose       # 每个文件列出全部问题
 *   pnpm check:colors --rule=contrast # 只看某一类规则
 *
 * 这套规则**取自 `~/gxexercise/scripts/check-colors.mjs`**（广学社通用颜色约定），并按这两站的
 * 实际情况做了三处增强 —— 因为这两站的 globals.css 把 Tailwind **全量色阶重映射**成 VI 色
 * （blue→实验红、indigo→青春橙、gray/slate/zinc/neutral/stone→暖中性…）：
 *
 *   1. 「原始色阶必须带 dark: 配对」的范围从 5 个中性色系扩到**全部 22 个色系**（这里它们都是品牌色）；
 *   2. CSS 变量成对校验额外要求 `:root{color-scheme:light}` / `.dark{color-scheme:dark}`；
 *   3. 新增 `contrast` 规则（gxexercise 没有）：把同一个 className 里的 `bg-*` 与 `text-*` 配对，
 *      用 globals.css 里的**真实色值**算 WCAG 对比度，浅色/深色各算一遍，正文 < 4.5 直接报错。
 *      —— 这条规则就是用来兜住「浅色下灰字压浅灰底看不见」这类回归的。
 *
 * 规则总览：
 *   absolute-color : className 里禁止 bg-white / text-black / border-black / border-1
 *   missing-dark   : 任何原始色阶类必须在同一字符串里有同属性、同修饰符的 dark: 配对
 *   hex-color      : className 里禁止裸 #hex（白名单：globals.css、PDF 导出、sw/offline 内联页）
 *   css-var-pair   : :root 与 .dark 变量集合必须一致，且都声明 color-scheme
 *   text-white     : text-white 必须配品牌/主色/600+ 饱和底或深色底
 *   contrast       : 同一 className 内 前景色 / 背景色 的对比度，浅色与深色都要 >= 4.5（大字 >= 3.0）
 *
 * 逃生阀：在某一行代码里写 `// color-check: ignore`（或 `theme-check: ignore`）即可豁免整行。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const GLOBALS = join(SRC, 'app/globals.css')
const VERBOSE = process.argv.includes('--verbose')
const ONLY_RULE = (process.argv.find((a) => a.startsWith('--rule=')) || '').split('=')[1]

const HUES =
  'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PROPS = 'text|bg|border|from|to|via|ring|divide|fill|stroke|placeholder|outline|decoration|shadow|caret|accent'
const SCALE_RE = new RegExp(`\\b((?:[a-z-]+:)*)(${PROPS})-(${HUES})-(\\d{2,3})\\b`, 'g')

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/
const BANNED_ABSOLUTE = [
  { re: /\bbg-white\b/g, hint: '深色下是刺眼白块 → bg-card / bg-background（或 bg-white dark:bg-card）' },
  { re: /\btext-black\b/g, hint: '深色下不可见 → text-foreground' },
  { re: /\bborder-black\b/g, hint: '深色下边框隐形 → border-border / border-foreground/20' },
  { re: /\bborder-1\b/g, hint: 'Tailwind 里 1px 就是 border，别写 border-1' },
]
// 这些文件里的 #hex 是「打印稿 / 离线页 / 导出产物」的独立配色，不参与深色模式
const HEX_ALLOW = new Set([
  'src/app/globals.css',
  'src/lib/pdf-generator.ts',
  'src/lib/writing-pdf.ts',
  'src/lib/writing-pdf-fonts.ts',
  'public/sw.js',
  'public/offline.html',
])

// ------------------------------------------------------------------ 色板解析

/** 解析 globals.css：@theme 的色阶 + :root/.dark 的语义 token，全都换算成 {r,g,b,a} */
function parsePalette() {
  const css = readFileSync(GLOBALS, 'utf8')
  const blockOf = (sel) => {
    const i = css.indexOf(sel + ' {')
    if (i < 0) return ''
    const start = css.indexOf('{', i) + 1
    const end = css.indexOf('\n}', start)
    return css.slice(start, end)
  }
  const toRgb = (value) => {
    const v = value.trim().replace(/;.*$/, '')
    let m = /^#([0-9a-fA-F]{3,8})$/.exec(v)
    if (m) {
      let hex = m[1]
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      }
    }
    m = /^rgba?\(([^)]+)\)$/.exec(v)
    if (m) {
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    return null
  }
  const vars = (block) => {
    const out = {}
    for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = toRgb(m[2])
    return out
  }
  // @theme 里的色阶定义（VI 重映射就是在这里）
  const scale = {}
  for (const m of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    scale[m[1].replace('--color-', '')] = toRgb(m[2])
  }
  return { scale, light: vars(blockOf(':root')), dark: vars(blockOf('\n.dark')) }
}

const PALETTE = parsePalette()

/** 把单个类名解析成颜色；解析不出来返回 null（例如 text-white/70、渐变中间色） */
function resolveColor(cls, mode) {
  const [name, opacityPart] = cls.split('/')
  if (opacityPart !== undefined) return null // 半透明一律不参与静态判断
  if (name === 'text-white' || name === 'bg-white') return { r: 255, g: 255, b: 255, a: 1 }
  if (name === 'text-black' || name === 'bg-black') return { r: 0, g: 0, b: 0, a: 1 }
  const bare = name.replace(/^(text|bg)-/, '')
  const vars = mode === 'dark' ? PALETTE.dark : PALETTE.light
  const semantic = vars[`--${bare}`]
  if (semantic && semantic.a > 0.95) return semantic
  const scale = PALETTE.scale[bare]
  if (scale) return scale
  return null
}

const lum = ({ r, g, b }) => {
  const f = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (fg, bg) => {
  const l1 = lum(fg)
  const l2 = lum(bg)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** 从一个 className 字面量里取出「基础/深色」两组前景与背景 */
function pickPair(body) {
  const tokens = body.split(/\s+/).filter(Boolean)
  const base = { text: null, bg: null }
  const darkT = { text: null, bg: null }
  let large = false
  let gradient = false
  for (const t of tokens) {
    if (/^dark:/.test(t)) {
      const c = t.slice(5)
      if (/^text-/.test(c)) darkT.text = c
      else if (/^bg-/.test(c)) darkT.bg = c
      continue
    }
    if (/^(bg-gradient|from-|to-|via-)/.test(t)) gradient = true
    if (/^(text|bg)-(2xl|3xl|4xl|5xl)/.test(t)) large = true
    if (/^text-/.test(t) && !/^text-(left|right|center|justify|xs|sm|base|lg|xl|\d|\[)/.test(t)) base.text = t
    if (/^bg-/.test(t)) base.bg = t
  }
  return { base, dark: darkT, large, gradient }
}

// ------------------------------------------------------------------ 扫描

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === 'generated') continue
      walk(p, out)
    } else if (/\.(tsx|ts|css|mjs)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

const problems = []
const add = (file, line, rule, detail) => {
  if (ONLY_RULE && ONLY_RULE !== rule) return
  problems.push({ file: relative(ROOT, file), line, rule, detail })
}

/** 取出所有「像 className」的字符串字面量；用 + 拼接的相邻字符串会合并判断 */
function classLiterals(text) {
  const lits = []
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let m
  let prev = null
  while ((m = re.exec(text))) {
    const body = m[2]
    if (!/[a-z]/.test(body)) continue
    if (!new RegExp(`\\b(?:${PROPS})-[a-z]|\\bborder\\b|dark:`).test(body)) continue
    const start = text.slice(0, m.index).split('\n').length
    if (prev && /^\s*\+\s*$/.test(text.slice(prev.end, m.index))) {
      prev.body += ' ' + body
      prev.end = re.lastIndex
      continue
    }
    prev = { body, start, end: re.lastIndex }
    lits.push(prev)
  }
  return lits
}

let scannedFiles = 0
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  scannedFiles++

  if (file.endsWith('.css')) {
    if (rel.endsWith('src/app/globals.css')) {
      const blockOf = (sel) => {
        const i = text.indexOf(sel + ' {')
        if (i < 0) return null
        const start = text.indexOf('{', i) + 1
        const end = text.indexOf('\n}', start)
        return text.slice(start, end)
      }
      const rootBlock = blockOf(':root')
      const darkBlock = blockOf('\n.dark') ?? blockOf('.dark')
      const varsOf = (block) =>
        new Set(
          [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]).filter((v) => !/^--(radius|font|spacing)/.test(v)),
        )
      if (rootBlock && darkBlock) {
        const a = varsOf(rootBlock)
        const b = varsOf(darkBlock)
        for (const v of a) if (!b.has(v)) add(file, 0, 'css-var-pair', `:root 有 ${v}，.dark 缺同名变量（深色会落回浅色值）`)
        for (const v of b) if (!a.has(v)) add(file, 0, 'css-var-pair', `.dark 有 ${v}，:root 缺同名变量`)
      } else {
        add(file, 0, 'css-var-pair', '找不到 :root 或 .dark 变量块')
      }
      if (!/^\s*:root\s*\{[^}]*color-scheme\s*:\s*light/m.test(text)) {
        add(file, 0, 'css-var-pair', ':root 缺少 color-scheme: light（滚动条 / 原生控件会发白）')
      }
      if (!/\.dark\s*\{[^}]*color-scheme\s*:\s*dark/m.test(text)) {
        add(file, 0, 'css-var-pair', '.dark 缺少 color-scheme: dark')
      }
    }
    continue
  }

  const lits = classLiterals(text)

  // 规则 1：固定色
  for (const { re, hint } of BANNED_ABSOLUTE) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length
      if (/color-check: ignore|theme-check: ignore/.test(lines[line - 1] || '')) continue
      if (m[0] === 'bg-white' && /dark:bg-/.test(lines[line - 1] || '')) continue
      add(file, line, 'absolute-color', `${m[0]} —— ${hint}`)
    }
  }

  // 规则 3：hex
  if (!HEX_ALLOW.has(rel)) {
    for (const { body, start } of lits) {
      const hit = body.match(HEX_RE)
      if (hit) add(file, start, 'hex-color', `${hit[0]} 是写死色值 → 改语义 token 或 CSS 变量`)
    }
  }

  for (const { body, start } of lits) {
    // 规则 2：色阶缺 dark: 配对（同属性、同修饰符）
    SCALE_RE.lastIndex = 0
    const need = new Set()
    let m
    while ((m = SCALE_RE.exec(body))) {
      const [, mods, prop] = m
      if (/(?:^|:)dark:/.test(mods)) continue
      need.add(`${mods}|${prop}`)
    }
    for (const key of need) {
      const [mods, prop] = key.split('|')
      if (!new RegExp(`\\bdark:${mods}${prop}-`).test(body)) {
        const sample = (body.match(new RegExp(`\\b${mods}${prop}-(?:${HUES})-\\d{2,3}\\b`, 'g')) || [])[0]
        add(file, start, 'missing-dark', `${sample} 没有 dark: 配对 → 加 dark:${mods}${prop}-*（同修饰符）`)
      }
    }

    // 规则 5：text-white 必须压在深/饱和底色上
    const whiteHits = [...body.matchAll(/\b((?:[a-z-]+:)*)text-white\b/g)].filter(
      (w) => !/(?:^|:)dark:/.test(w[1]),
    )
    if (whiteHits.length) {
      const strongBg =
        /\b(?:bg|from)-(?:primary|destructive|black|brand-[a-z-]+)\b/.test(body) ||
        /\b(?:bg|from)-[a-z]+-(?:500|600|700|800|900|950)\b/.test(body)
      if (!strongBg) add(file, start, 'text-white', 'text-white 缺少足够深的背景（品牌色 / 主色 / 600+ 饱和底）')
    }

    // 规则 6：静态对比度（同串配对，浅色与深色各算一遍）
    const { base, dark, large, gradient } = pickPair(body)
    if (gradient) continue // 渐变底无法静态判定
    const pairs = []
    if (base.text && base.bg) {
      pairs.push({ mode: 'light', fgClass: base.text, bgClass: base.bg })
    }
    const darkFgClass = dark.text || base.text
    const darkBgClass = dark.bg || base.bg
    if (darkFgClass && darkBgClass) {
      pairs.push({ mode: 'dark', fgClass: darkFgClass, bgClass: darkBgClass })
    }
    for (const p of pairs) {
      const fg = resolveColor(p.fgClass, p.mode)
      const bg = resolveColor(p.bgClass, p.mode)
      if (!fg || !bg) continue // 解析不出来（自定义 token / 半透明）就跳过
      const ratio = contrast(fg, bg)
      const limit = large ? 3.0 : 4.5
      if (ratio < limit) {
        add(
          file,
          start,
          'contrast',
          `${p.mode === 'dark' ? '深色' : '浅色'} ${p.fgClass} 压 ${p.bgClass} 只有 ${ratio.toFixed(2)}:1（需 ≥ ${limit}）`,
        )
      }
    }
  }
}

if (problems.length === 0) {
  console.log(`✔ 颜色自检通过（扫描 ${scannedFiles} 个文件，0 处问题）`)
  process.exit(0)
}

if (!VERBOSE) {
  const byRule = {}
  for (const p of problems) byRule[p.rule] = (byRule[p.rule] || 0) + 1
  console.log(
    `✗ ${problems.length} 处问题（${Object.entries(byRule)
      .map(([k, v]) => `${k} ${v}`)
      .join(' / ')}）`,
  )
}

const byFile = new Map()
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, [])
  byFile.get(p.file).push(p)
}
for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${file}  (${list.length})`)
  for (const p of list.slice(0, VERBOSE ? 500 : 12)) {
    console.log(`  ${p.line}: [${p.rule}] ${p.detail}`)
  }
  if (!VERBOSE && list.length > 12) console.log(`  … 另外 ${list.length - 12} 处（--verbose 看全部）`)
}
console.log(`\n共 ${problems.length} 处，涉及 ${byFile.size} 个文件。约定见 docs/dark-mode.md。`)
process.exit(1)

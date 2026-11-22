#!/usr/bin/env node
/**
 * 深色模式 / 颜色自检 —— 广学英语 & 作文积累本专用（方案见 docs/dark-mode.md）
 *
 * 用法：
 *   node scripts/check-theme.mjs            # 有问题退出码 1
 *   node scripts/check-theme.mjs --verbose  # 每个文件列出全部问题
 *   node scripts/check-theme.mjs --rule=missing-dark   # 只看某一类
 *
 * 为什么要单独一套：这两站的 globals.css 把 Tailwind **全量色阶重映射**成 VI 色
 * （blue→实验红、indigo→青春橙、gray/slate/zinc/neutral/stone→暖中性…），
 * 所以「原始色阶」在这里是**品牌色**，不能像题库那样一律换成语义 token，
 * 而是必须逐处给出 dark: 配对。规则详见 docs/dark-mode.md §7.1。
 *
 * 规则：
 *   1. absolute-color : className 里禁止 bg-white / text-black / border-black / border-1
 *   2. missing-dark   : 任何原始色阶类（任意色系）必须在同一字符串里有同属性、同修饰符的 dark: 配对
 *   3. hex-color      : className 里禁止裸 #hex（白名单：globals.css、PDF 导出、sw/offline 内联页）
 *   4. css-var-pair   : globals.css 的 :root 与 .dark 变量集合必须一致，且都声明 color-scheme
 *   5. text-white     : text-white 必须配品牌/主色/600+ 饱和底或深色底
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const VERBOSE = process.argv.includes('--verbose')
const ONLY_RULE = (process.argv.find((a) => a.startsWith('--rule=')) || '').split('=')[1]

// VI 重映射覆盖的 18 个色系 + 语义色系
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

/** 取出所有「像 className」的字符串字面量（含模板字符串、clsx/cva 的参数）
 *  相邻、用 + 拼接的字符串会合并成一个整体判断，避免
 *  `'text-gray-600 ' + 'dark:text-gray-300'` 这种写法被误报。 */
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
    // 与前一个字面量之间只有空白与 + 时合并
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
      if (lines[line - 1]?.includes('theme-check: ignore')) continue
      // 允许 bg-white 紧跟着 dark:bg-* 的写法（显式成对，功能等价于 bg-card）
      const lineText = lines[line - 1] || ''
      if (m[0] === 'bg-white' && /dark:bg-/.test(lineText)) continue
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

  // 规则 2：色阶缺 dark: 配对（同属性、同修饰符）
  for (const { body, start } of lits) {
    SCALE_RE.lastIndex = 0
    const need = new Set()
    let m
    while ((m = SCALE_RE.exec(body))) {
      const [, mods, prop] = m
      // 已经是 dark: 前缀的类本身就是配对的一侧，不再要求它再带 dark:
      if (/(?:^|:)dark:/.test(mods)) continue
      need.add(`${mods}|${prop}`)
    }
    for (const key of need) {
      const [mods, prop] = key.split('|')
      const want = new RegExp(`\\bdark:${mods}${prop}-`)
      if (!want.test(body)) {
        const sample = (body.match(new RegExp(`\\b${mods}${prop}-(?:${HUES})-\\d{2,3}\\b`, 'g')) || [])[0]
        add(file, start, 'missing-dark', `${sample} 没有 dark: 配对 → 加 dark:${mods}${prop}-*（同修饰符）`)
      }
    }
  }

  // 规则 5：text-white 必须压在深/饱和底色上（dark:text-white 属于配对侧，不参与）
  for (const { body, start } of lits) {
    const hits = [...body.matchAll(/\b((?:[a-z-]+:)*)text-white\b/g)].filter(
      (m) => !/(?:^|:)dark:/.test(m[1]),
    )
    if (!hits.length) continue
    const strongBg =
      /\b(?:bg|from)-(?:primary|destructive|black|brand-[a-z-]+)\b/.test(body) ||
      /\b(?:bg|from)-[a-z]+-(?:500|600|700|800|900|950)\b/.test(body)
    if (!strongBg) {
      add(file, start, 'text-white', 'text-white 缺少足够深的背景（品牌色 / 主色 / 600+ 饱和底）')
    }
  }
}

if (problems.length === 0) {
  console.log(`✔ 深色模式自检通过（扫描 ${scannedFiles} 个文件，0 处问题）`)
  process.exit(0)
}

if (!VERBOSE) {
  // 先给一行汇总，方便队友判断进度
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

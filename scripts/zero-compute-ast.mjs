/**
 * Decision 0001: Native ESTree Zero-Compute AST Linter (powered by oxc-parser, MIT).
 * Audits TypeScript/JavaScript modules AND Svelte (<script> + {...} template expressions).
 * Zero regex guesswork: walks the real parsed ESTree AST to block hidden arithmetic,
 * aggregations (.reduce), domain sorting (.sort/.toSorted), numeric coercions (+x, Number, parseFloat),
 * client rounding (.toFixed, Math.round), threshold comparisons, unknown->0 fallbacks,
 * type escape hatches (as any / : any / as unknown as number), and nondeterministic globals.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';

const OPAQUE_NAME_RE =
  /^(display|previousDisplay|previous_display|cell|rawCell|amount|value|val|figure|rate|cap|income|assets|total|subtotal|sum|score|cost|price|threshold|tariff|subsidy|benefit|balance|salary|quota|metric|amount_cell|income_cell|assets_cell|ratio_display|outcome_display|cliff_distance_display)$/i;

const DOMAIN_SORT_PROP_RE =
  /^(display|previousDisplay|value|val|amount|rate|score|total|subtotal|sum|date|time|timestamp|priority|rank|income|assets|cost|price|count|status|state|eur|cents|percentage|ratio)$/i;

const ZERO_FALLBACK_STR_RE = /^[€$£]?\s*0([.,]0+)?\s*%?$/;

const MATH_COMPUTE_FNS = new Set(['round', 'floor', 'ceil', 'trunc', 'abs', 'max', 'min', 'pow', 'sqrt', 'sign']);
const ARITH_BIN_OPS = new Set(['-', '*', '/', '%', '**']);
const ARITH_ASSIGN_OPS = new Set(['+=', '-=', '*=', '/=']);
const REL_OPS = new Set(['<', '<=', '>', '>=']);

function walkAst(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const key of Object.keys(node)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && typeof item.type === 'string') {
          walkAst(item, fn);
        }
      }
    } else if (child && typeof child === 'object' && typeof child.type === 'string') {
      walkAst(child, fn);
    }
  }
}

function getPropName(member) {
  if (!member.computed && member.property?.type === 'Identifier') return member.property.name;
  if (member.computed && member.property?.type === 'Literal' && typeof member.property.value === 'string') {
    return member.property.value;
  }
  return null;
}

function touchesOpaqueName(node) {
  let found = false;
  walkAst(node, (n) => {
    if (found) return;
    if (n.type === 'Identifier' && OPAQUE_NAME_RE.test(n.name)) found = true;
    if (n.type === 'MemberExpression') {
      const p = getPropName(n);
      if (p && OPAQUE_NAME_RE.test(p)) found = true;
    }
  });
  return found;
}

function touchesDomainSortProp(node) {
  let found = false;
  walkAst(node, (n) => {
    if (found) return;
    if (n.type === 'MemberExpression') {
      const p = getPropName(n);
      if (p && DOMAIN_SORT_PROP_RE.test(p)) found = true;
    }
  });
  return found;
}

function isStringExpr(node) {
  return (
    (node?.type === 'Literal' && typeof node.value === 'string') ||
    node?.type === 'TemplateLiteral'
  );
}

function isZeroLikeLiteral(node) {
  if (!node) return false;
  if (node.type === 'Literal') {
    if (node.value === 0 || node.value === false) return true;
    if (typeof node.value === 'string' && ZERO_FALLBACK_STR_RE.test(node.value.trim())) return true;
  }
  return false;
}

function isGeometryCoordReceiver(expr, src) {
  const txt = src.slice(expr.start, expr.end).trim();
  return /(mongeCoords|box|rect|coord|pt|point|pos)\.[xywh]$/.test(txt);
}

/**
 * Extracts <script> blocks AND {...} mustache expressions from a .svelte file
 * into virtual TS snippets with accurate starting line offsets.
 */
export function extractSvelteSnippets(source) {
  const snippets = [];
  const lineAt = (offset) => source.slice(0, offset).split(/\r?\n/).length - 1;

  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let masked = source;
  let m;
  while ((m = scriptRe.exec(source)) !== null) {
    const contentStart = m.index + m[0].indexOf('>') + 1;
    snippets.push({ code: m[1], lineOffset: lineAt(contentStart), kind: 'svelte-script' });
    masked = masked.slice(0, m.index) + ' '.repeat(m[0].length) + masked.slice(m.index + m[0].length);
  }

  masked = masked.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (s) => ' '.repeat(s.length));

  let i = 0;
  while (i < masked.length) {
    if (masked[i] === '{') {
      const start = i;
      let depth = 0;
      let inStr = null;
      while (i < masked.length) {
        const ch = masked[i];
        if (inStr) {
          if (ch === '\\') { i += 2; continue; }
          if (ch === inStr) inStr = null;
        } else {
          if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
          else if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        i++;
      }
      const rawInner = masked.slice(start + 1, i).trim();
      if (rawInner && !rawInner.startsWith('/')) {
        let expr = rawInner;
        if (expr.startsWith('#if ')) expr = expr.slice(4);
        else if (expr.startsWith(':else if ')) expr = expr.slice(9);
        else if (expr.startsWith('#each ')) expr = expr.slice(6).split(/\s+as\s+/)[0] ?? '';
        else if (expr.startsWith('@const ')) expr = `const ${expr.slice(7)};`;
        else if (expr.startsWith('@html ')) expr = expr.slice(6);
        else if (expr.startsWith('#') || expr.startsWith(':')) expr = '';

        if (expr.trim()) {
          const code = expr.trim().startsWith('const ') ? expr : `(${expr});`;
          snippets.push({ code, lineOffset: lineAt(start), kind: 'svelte-template' });
        }
      }
    }
    i++;
  }
  return snippets;
}

/**
 * Lints a single TypeScript / JavaScript / Svelte source string via real ESTree AST traversal.
 */
export function lintSourceCode(source, filePath = 'inline.ts') {
  const violations = [];
  const isSvelte = filePath.endsWith('.svelte');
  const snippets = isSvelte
    ? extractSvelteSnippets(source)
    : [{ code: source, lineOffset: 0, kind: 'module' }];

  for (const snip of snippets) {
    const code = snip.code;
    const lineOfOffset = (offset) => snip.lineOffset + code.slice(0, offset).split(/\r?\n/).length;

    // ZC12: forbid @ts-ignore / @ts-nocheck / @ts-expect-error
    code.split(/\r?\n/).forEach((line, idx) => {
      if (/@ts-(ignore|nocheck|expect-error)\b/.test(line)) {
        violations.push({
          code: 'ZC12',
          file: filePath,
          line: snip.lineOffset + idx + 1,
          message: 'TypeScript suppression (@ts-ignore/@ts-nocheck/@ts-expect-error) is forbidden in Cartouche packages.'
        });
      }
    });

    const parsed = parseSync(isSvelte ? `${filePath}.ts` : filePath, code);
    const report = (node, ruleCode, message) => {
      violations.push({
        code: ruleCode,
        file: filePath,
        line: lineOfOffset(node.start ?? 0),
        message
      });
    };

    walkAst(parsed.program, (node) => {
      // ZC01: No Intl.* or locale-dependent formatting/collation
      if (node.type === 'MemberExpression') {
        const prop = getPropName(node);
        if (node.object?.type === 'Identifier' && node.object.name === 'Intl') {
          report(node, 'ZC01', `Intl.${prop} breaks cross-OS determinism; use server-formatted opaque cells.`);
        }
        if (prop && ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'localeCompare'].includes(prop)) {
          report(node, 'ZC01', `.${prop}() depends on host locale and is forbidden (Decision 0001).`);
        }
      }

      // CallExpression rules: ZC02, ZC03, ZC05, ZC06, ZC09, ZC10
      if (node.type === 'CallExpression') {
        const callee = node.callee;

        // ZC02: parseFloat / parseInt / BigInt / Number(opaque)
        if (callee?.type === 'Identifier') {
          if (['parseFloat', 'parseInt', 'BigInt'].includes(callee.name)) {
            report(node, 'ZC02', `${callee.name}() violates Zero Client Compute (Decision 0001).`);
          }
          if (callee.name === 'Number' && node.arguments.some((a) => touchesOpaqueName(a))) {
            report(node, 'ZC02', 'Number(...) coercion on an opaque/domain cell violates Decision 0001.');
          }
        }

        if (callee?.type === 'MemberExpression') {
          const prop = getPropName(callee);

          // ZC03: .toFixed() / .toPrecision()
          if ((prop === 'toFixed' || prop === 'toPrecision') && !isGeometryCoordReceiver(callee.object, code)) {
            report(node, 'ZC03', `.${prop}() performs client-side rounding/formatting (Decision 0001).`);
          }

          // ZC05: .reduce() / .reduceRight() numeric accumulation
          if (prop === 'reduce' || prop === 'reduceRight') {
            const cb = node.arguments[0];
            if (cb) {
              let hasNumericAccum = false;
              walkAst(cb, (n) => {
                if (hasNumericAccum) return;
                if (n.type === 'BinaryExpression') {
                  if (ARITH_BIN_OPS.has(n.operator)) hasNumericAccum = true;
                  if (n.operator === '+' && !isStringExpr(n.left) && !isStringExpr(n.right)) hasNumericAccum = true;
                }
                if (n.type === 'AssignmentExpression' && ARITH_ASSIGN_OPS.has(n.operator)) hasNumericAccum = true;
                if (
                  n.type === 'CallExpression' &&
                  n.callee?.type === 'MemberExpression' &&
                  n.callee.object?.type === 'Identifier' &&
                  n.callee.object.name === 'Math' &&
                  MATH_COMPUTE_FNS.has(getPropName(n.callee))
                ) {
                  hasNumericAccum = true;
                }
              });
              if (hasNumericAccum) {
                report(node, 'ZC05', `.${prop}() performs client-side aggregation/summation (Decision 0001).`);
              }
            }
          }

          // ZC06: .sort() / .toSorted() on domain values or numeric property subtraction
          if (prop === 'sort' || prop === 'toSorted') {
            const cb = node.arguments[0];
            if (cb) {
              const leading = code.slice(Math.max(0, (node.start ?? 0) - 90), node.start ?? 0);
              const isGeometrySort = /@cartouche-geometry-sort/.test(leading);
              if (!isGeometrySort) {
                if (touchesDomainSortProp(cb) || touchesOpaqueName(cb)) {
                  report(node, 'ZC06', `.${prop}() sorts on domain/opaque cell values; ordering must come from Rezono.`);
                } else {
                  let hasPropSub = false;
                  walkAst(cb, (n) => {
                    if (n.type === 'BinaryExpression' && n.operator === '-') {
                      if (n.left?.type === 'MemberExpression' || n.right?.type === 'MemberExpression') {
                        hasPropSub = true;
                      }
                    }
                  });
                  if (hasPropSub) {
                    report(node, 'ZC06', `.${prop}() uses numeric property subtraction; use canonical key order or tag explicit geometry sorts.`);
                  }
                }
              }
            }
          }

          // ZC09: Math.round/floor/ceil/max/min/... on opaque/domain values
          if (callee.object?.type === 'Identifier' && callee.object.name === 'Math' && prop && MATH_COMPUTE_FNS.has(prop)) {
            if (node.arguments.some((a) => touchesOpaqueName(a))) {
              report(node, 'ZC09', `Math.${prop}() on opaque/domain values violates Decision 0001.`);
            }
          }

          // ZC10: Nondeterministic globals
          if (callee.object?.type === 'Identifier') {
            if (callee.object.name === 'Math' && prop === 'random') {
              report(node, 'ZC10', 'Math.random() breaks deterministic output bytes (AGENTS.md Rule 4).');
            }
            if (callee.object.name === 'Date' && prop === 'now') {
              report(node, 'ZC10', 'Date.now() breaks deterministic output bytes (AGENTS.md Rule 4).');
            }
            if (callee.object.name === 'crypto' && prop === 'randomUUID') {
              report(node, 'ZC10', 'crypto.randomUUID() breaks deterministic output bytes (AGENTS.md Rule 4).');
            }
          }
        }
      }

      // ZC10: new Date() without fixed argument
      if (node.type === 'NewExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'Date' && node.arguments.length === 0) {
        report(node, 'ZC10', 'new Date() uses wall-clock time and breaks determinism (AGENTS.md Rule 4).');
      }

      // ZC02: Unary + coercion (+cell.display)
      if (node.type === 'UnaryExpression' && node.operator === '+') {
        if (!(node.argument?.type === 'Literal' && typeof node.argument.value === 'number')) {
          report(node, 'ZC02', `Unary + numeric coercion ("${code.slice(node.start, node.end)}") violates Zero Client Compute (Decision 0001).`);
        }
      }

      // ZC04 & ZC07: BinaryExpression (arithmetic + threshold compare on opaque/domain identifiers)
      if (node.type === 'BinaryExpression') {
        if (ARITH_BIN_OPS.has(node.operator) && (touchesOpaqueName(node.left) || touchesOpaqueName(node.right))) {
          report(node, 'ZC04', `Arithmetic "${code.slice(node.start, node.end).slice(0, 60)}" on opaque/domain value violates Decision 0001.`);
        }
        if (
          node.operator === '+' &&
          !isStringExpr(node.left) &&
          !isStringExpr(node.right) &&
          (touchesOpaqueName(node.left) || touchesOpaqueName(node.right))
        ) {
          report(node, 'ZC04', `Addition "${code.slice(node.start, node.end).slice(0, 60)}" on opaque/domain value violates Decision 0001.`);
        }
        if (REL_OPS.has(node.operator) && (touchesOpaqueName(node.left) || touchesOpaqueName(node.right))) {
          report(node, 'ZC07', `Threshold comparison "${code.slice(node.start, node.end).slice(0, 60)}" on opaque/domain value violates Decision 0001.`);
        }
      }

      // ZC04: Compound assignment arithmetic (+=, -=, *=, /=) on opaque/domain values
      if (node.type === 'AssignmentExpression' && ARITH_ASSIGN_OPS.has(node.operator)) {
        if (touchesOpaqueName(node.left) || touchesOpaqueName(node.right)) {
          report(node, 'ZC04', `Compound arithmetic "${code.slice(node.start, node.end).slice(0, 60)}" violates Decision 0001.`);
        }
      }

      // ZC08: Nullish coalescing or logical OR coercing unknown/missing opaque cell to zero/false
      if (node.type === 'LogicalExpression' && (node.operator === '??' || node.operator === '||')) {
        if (touchesOpaqueName(node.left) && isZeroLikeLiteral(node.right)) {
          report(node, 'ZC08', `Fallback "${code.slice(node.start, node.end)}" coerces unknown/missing value to zero or false (Decision 0001).`);
        }
      }

      // ZC11: Type escape hatches (any / as unknown as number)
      if (node.type === 'TSAnyKeyword') {
        report(node, 'ZC11', 'Type escape hatch "any" is forbidden in Cartouche packages.');
      }
      if (
        node.type === 'TSAsExpression' &&
        node.typeAnnotation?.type === 'TSNumberKeyword' &&
        node.expression?.type === 'TSAsExpression' &&
        node.expression.typeAnnotation?.type === 'TSUnknownKeyword'
      ) {
        report(node, 'ZC11', 'Casting opaque types via "as unknown as number" violates Decision 0001.');
      }
    });
  }

  return violations;
}

export function lintDirectory(dirPath, rootDir = process.cwd()) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|mts|js|mjs|svelte)$/.test(entry.name)) files.push(full);
    }
  }
  walk(dirPath);

  const violations = [];
  for (const file of files) {
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    const src = fs.readFileSync(file, 'utf8');
    violations.push(...lintSourceCode(src, rel));
  }
  return { fileCount: files.length, violations };
}

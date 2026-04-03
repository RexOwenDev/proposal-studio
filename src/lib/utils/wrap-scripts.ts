/**
 * Shared script-wrapping utility used by both the editor and the public renderer.
 *
 * Splits raw proposal JS into three buckets:
 *   1. ES module scripts  — preserved as <script type="module"> (deferred by spec)
 *   2. Global declarations — function/class/arrow-fn assignments hoisted to global scope
 *                            so that inline onclick="fn()" handlers can reach them
 *   3. Deferred execution — everything else, wrapped in DOMContentLoaded
 *
 * The parser marks <script type="module"> blocks with sentinel comments so the
 * type="module" attribute survives the content-only storage format.
 */

export const MODULE_SCRIPT_START = '/*__MODULE_SCRIPT_START__*/';
export const MODULE_SCRIPT_END = '/*__MODULE_SCRIPT_END__*/';

const MODULE_RE =
  /\/\*__MODULE_SCRIPT_START__\*\/([\s\S]*?)\/\*__MODULE_SCRIPT_END__\*\//g;

/**
 * Patterns that identify a top-level declaration which must be globally accessible.
 * Covers: named functions, async functions, generators, class declarations,
 * arrow-function assignments, function-expression assignments, class expressions.
 */
const HOIST_RE: RegExp[] = [
  /^\s*(?:async\s+)?function[\s*]+\w+/,                               // function foo / async function foo / function* foo
  /^\s*class\s+\w+/,                                                  // class Foo extends Bar
  /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function[\s*]*/,   // const foo = function() / async function
  /^\s*(?:const|let|var)\s+\w+\s*=\s*class\b/,                       // const Foo = class { }
  /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/,               // const foo = () => / const foo = async () =>
  /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\w+\s*=>/,         // const foo = x => expr
];

export function wrapScripts(scripts: string): string {
  const moduleScripts: string[] = [];

  // ── 1. Pull out any module scripts marked by the parser ──────────────────
  const nonModules = scripts.replace(MODULE_RE, (_, content: string) => {
    moduleScripts.push(content.trim());
    return '';
  });

  // ── 2. Categorize remaining lines ─────────────────────────────────────────
  const lines = nonModules.split('\n');
  const globalLines: string[] = [];
  const deferLines: string[] = [];

  let inHoisted = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Detect the start of a hoistable top-level declaration
    if (!inHoisted && HOIST_RE.some((re) => re.test(line))) {
      inHoisted = true;
      braceDepth = 0;
    }

    if (inHoisted) {
      globalLines.push(line);
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      // End the hoisted block when braces are balanced and there's no
      // trailing operator/arrow that implies the statement continues
      const continues = /[,({=>\-+*|&?:]\s*$/.test(trimmed) || trimmed.endsWith('=>');
      if (braceDepth <= 0 && !continues) {
        inHoisted = false;
        braceDepth = 0;
      }
    } else {
      deferLines.push(line);
    }
  }

  const globalCode = globalLines.join('\n').trim();
  const deferCode = deferLines.join('\n').trim();

  // ── 3. Assemble output ───────────────────────────────────────────────────
  let result = '';

  // Module scripts first — they defer automatically per ES module spec
  for (const mod of moduleScripts) {
    result += `<script type="module">\n${mod}\n<\/script>\n`;
  }

  // Global declarations — no wrapper needed
  if (globalCode) {
    result += `<script>\n${globalCode}\n<\/script>\n`;
  }

  // Deferred execution — wrap in DOMContentLoaded so the DOM is ready
  if (deferCode) {
    result += `<script>\ndocument.addEventListener('DOMContentLoaded', function() {\n${deferCode}\n});\n<\/script>`;
  }

  return result;
}

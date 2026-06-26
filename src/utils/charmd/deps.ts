/**
 * Shared dependencies for the charmd markdown renderer: chalk for terminal
 * color, plus the mdast/micromark packages used to parse markdown (including
 * GFM strikethrough).
 */

import chalk from "chalk";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";

// ---------------------------------------------------------------------------
// Re-export the mdast pieces in the shape charmd internals expect
// ---------------------------------------------------------------------------

export { gfmStrikethroughFromMarkdown as strikethroughExt };
export { gfmStrikethrough as strike };

export type mdastFromMarkdownFn = (
  markdown: string,
  encodig?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: { extensions?: any[]; mdastExtensions?: any[] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any;

export const fromMarkdownFn: mdastFromMarkdownFn = (
  markdown: string,
  _encoding?: string,
  options?: { extensions?: any[]; mdastExtensions?: any[] },
) => fromMarkdown(markdown, options as any);

// ---------------------------------------------------------------------------
// colors — a small chalk-backed helper. The renderer imports `colors` from
// here and calls colors.bold(), colors.red(), colors.stripColor(), etc.
// ---------------------------------------------------------------------------

export const colors = {
  // Text styles
  bold: (s: string) => chalk.bold(s),
  italic: (s: string) => chalk.italic(s),
  underline: (s: string) => chalk.underline(s),
  strikethrough: (s: string) => chalk.strikethrough(s),
  inverse: (s: string) => chalk.inverse(s),
  reset: (s: string) => chalk.reset(s),

  // Foreground colours
  red: (s: string) => chalk.red(s),
  green: (s: string) => chalk.green(s),
  yellow: (s: string) => chalk.yellow(s),
  blue: (s: string) => chalk.blue(s),
  magenta: (s: string) => chalk.magenta(s),
  cyan: (s: string) => chalk.cyan(s),
  white: (s: string) => chalk.white(s),
  gray: (s: string) => chalk.gray(s),
  black: (s: string) => chalk.black(s),

  // Background colours
  bgBlack: (s: string) => chalk.bgBlack(s),
  bgWhite: (s: string) => chalk.bgWhite(s),
  bgBrightBlack: (s: string) => chalk.bgBlackBright(s),
  bgBrightWhite: (s: string) => chalk.bgWhiteBright(s),

  // Utility
  stripColor: (s: string) => s.replace(/\x1b\[[0-9;]*m/g, ""),
};

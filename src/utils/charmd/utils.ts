import { colors, fromMarkdownFn } from "./deps.ts"
import type { MdastOptions } from "./mod.ts"
import type { Node } from "./nodeTypes.ts"

/**
 * **UNSTABLE**
 *
 * Returns an AST of the provided markdown.
 */
export function toAst(markdown: string, _encoding?: string, options?: MdastOptions): Node {
  const value = fromMarkdownFn(markdown, _encoding, options)
  return value
}

const headingFormats = [
  (value: string) => value,
  (value: string) => colors.bold(colors.underline(colors.red(value))),
  (value: string) => colors.yellow(colors.bold(value)),
  (value: string) => colors.green(colors.bold(value)),
  (value: string) => colors.magenta(colors.bold(value)),
  (value: string) => colors.cyan(colors.bold(value)),
  (value: string) => colors.blue(colors.bold(value)),
]

export function getHeaderFormatter(head: number) {
  if (head > headingFormats.length - 1) {
    head = 0
  }
  return headingFormats[head]
}

export function isMarkdownTable(text: string) {
  // https://github.com/erikvullings/slimdown-js/blob/master/src/slimdown.ts#L125
  return /(\|[^\n]+\|\r?\n)((?:\|\s*:?[-]+:?\s*)+\|)(\n(?:\|[^\n]+\|\r?\n?)*)?/g.test(text)
}

export function generateTable(markdownTable: string, borders?: boolean) {
  let grid = markdownTable
    .trim()
    .replaceAll("\r", "")
    .split("\n")
    .map((l) => {
      return l
        .trim()
        .replaceAll(/^\||\|$/g, "")
        .split("|")
    })

  const maxCol = Math.max(...grid.map((row) => row.length))
  const cellWidths = []

  const cellPadding = 1
  const paddingString = " ".repeat(cellPadding)

  for (let i = 0; i < maxCol; i++) {
    const cellMax = Math.max(
      ...grid.map((row, ri) => colors.stripColor(ri === 1 ? "" : (row[i] || "").trim()).length),
    )
    cellWidths.push(cellMax)

    const align = grid[1][i]?.trim() || ":--"
    const cellAlign = align.startsWith(":")
      ? align.endsWith(":")
        ? "center"
        : "left"
      : align.endsWith(":")
        ? "right"
        : "left"

    grid = grid.map((row, ri) => {
      const d = row
      if (ri === 1) {
        d[i] = `${["center", "left"].includes(cellAlign) ? ":" : ""}${"-".repeat(
          cellMax + cellPadding * 2 - (cellAlign === "center" ? 2 : 1),
        )}${["center", "right"].includes(cellAlign) ? ":" : ""}`
        return d
      }

      let cellContent = (d[i] || "").trim()
      if (borders && ri === 0) {
        cellContent = colors.blue(colors.bold(cellContent))
      }
      const strippedDiff = cellContent.length - colors.stripColor(cellContent).length
      const diff = cellMax - cellContent.length + strippedDiff
      d[i] = paddingString + getAlignedCellText(cellContent, cellAlign, diff) + paddingString
      return d
    })
  }

  if (borders) {
    const top =
      tableChars.topLeft +
      cellWidths
        .map((cw) => tableChars.middleMiddle.repeat(cw + cellPadding * 2))
        .join(tableChars.topMiddle) +
      tableChars.topRight
    const middle =
      tableChars.leftMiddle +
      cellWidths
        .map((cw) => tableChars.middleMiddle.repeat(cw + cellPadding * 2))
        .join(tableChars.rowMiddle) +
      tableChars.rightMiddle
    const bottom =
      tableChars.bottomLeft +
      cellWidths
        .map((cw) => tableChars.middleMiddle.repeat(cw + cellPadding * 2))
        .join(tableChars.bottomMiddle) +
      tableChars.bottomRight

    grid.splice(1, 1) // remove alignment row
    return [
      top,
      grid
        .map((row) => tableChars.left + row.join(tableChars.middle) + tableChars.right)
        .join("\n" + middle + "\n"),
      bottom,
    ].join("\n")
  } else {
    return grid.map((row) => "|" + row.join("|") + "|").join("\n")
  }
}

function getAlignedCellText(cellText: string, align: string, diff: number) {
  diff = Math.max(diff, 0)
  switch (align) {
    case "center":
      return " ".repeat(Math.floor(diff / 2)) + cellText + " ".repeat(Math.ceil(diff / 2))
    case "left":
      return cellText + " ".repeat(diff)
    case "right":
      return " ".repeat(diff) + cellText
  }
}

const tableChars = {
  middleMiddle: "─",
  rowMiddle: "┼",
  topRight: "┐",
  topLeft: "┌",
  leftMiddle: "├",
  topMiddle: "┬",
  bottomRight: "┘",
  bottomLeft: "└",
  bottomMiddle: "┴",
  rightMiddle: "┤",
  left: "│",
  right: "│",
  middle: "│",
} as const

import type { Entry } from "./analyzer"

/**
 * Represents the options for generating export files.
 */
export interface GeneratorOptions {
  /** The base filename for the generated files. Defaults to "index". */
  filename?: string
  /** The filename for the type definition file. Defaults to "index.d". */
  typesFilename?: string
  /** The export format, either JavaScript ("js") or TypeScript ("ts"). Defaults to "ts". */
  exportType?: "js" | "ts" | "json"
  /** Whether to generate separate files for types and content. Defaults to `false`. */
  splitFiles?: boolean
}

/**
 * Represents a generated file with its filename, extension, and content.
 */
export interface GeneratorFile {
  /** The name of the file without its extension. */
  filename: string
  /** The file extension (e.g., "js" or "ts"). */
  ext: string
  /** The content of the file. */
  content: string
}

function escapeUnicode(str: string): string {
  return str.replace(/[\u2028\u2029]/g, match => (match === "\u2028" ? "\\u2028" : "\\u2029"))
}

function exportJsObject(entries: Entry[]): string {
  const createEntryObject = `export const entries = new Map([
  ${entries
    .map(
      entry =>
        `["${entry.name}", { content: ${entry.data ? `"${entry.data}"` : escapeUnicode(JSON.stringify(entry.content))}, compressed: ${entry.compressed} }]`,
    )
    .join(",\n  ")}
]);`

  const createFunctions = `export function getEntry(key) {
  return entries.get(key);
}
export function getEntries(filter) {
  return Array.from(entries).filter(filter);
}
export function useEntry(key, options) {
  const entry = entries.get(key);

  // Add functionality here
}`

  return `${createEntryObject}
${createFunctions}`
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}

function exportTsDef(entries: Entry[]): string {
  const createTypeOptions = `export type EntryOptions =
  | ${entries
    .map(entry => `"${entry.name}"`)
    .join("\n  | ")};`

  const createTypeData = `export type EntryData = {
  content: string;
  compressed: boolean;
};`

  const createTypeEntry = entries
    .map((entry) => {
      if (!entry.types || Object.keys(entry.types).length === 0)
        return ""

      const type = `export type ${toPascalCase(entry.name)} = {
${Object.entries(entry.types)
  .map(([key, value]) => `  ${key}: ${value};`)
  .join("\n")}
};`

      return type
    })
    .filter(Boolean)

  const createTypeEntryMap = `export type EntryMap = {
  ${entries
    .map(entry => `"${entry.name}": ${toPascalCase(entry.name)};`)
    .join("\n  ")}
};`

  const createEntryObject = `declare const entries: Map<EntryOptions, EntryData>;`

  const createFunctions = `declare function getEntry(key: EntryOptions): EntryData | undefined;
declare function getEntries(filter: (entry: [EntryOptions, EntryData]) => boolean): [EntryOptions, EntryData][];
declare function useEntry<K extends keyof EntryMap>(key: K, options: EntryMap[K]);`

  return `${createTypeOptions}
${createTypeData}
${createTypeEntry.join("\n")}
${createTypeEntryMap}
${createEntryObject}
${createFunctions}`
}

function exportTsFull(entries: Entry[]): string {
  const createTypeOptions = `export type EntryOptions =
  | ${entries
    .map(entry => `"${entry.name}"`)
    .join("\n  | ")};`

  const createTypeData = `export type EntryData = {
  content: string;
  compressed: boolean;
};`

  const createTypeEntry = entries
    .map((entry) => {
      if (!entry.types || Object.keys(entry.types).length === 0)
        return ""

      const type = `export type ${toPascalCase(entry.name)} = {
${Object.entries(entry.types)
  .map(([key, value]) => `  ${key}: ${value};`)
  .join("\n")}
};`

      return type
    })
    .filter(Boolean)

  const createTypeEntryMap = `export type EntryMap = {
  ${entries
    .map(entry => `"${entry.name}": ${toPascalCase(entry.name)};`)
    .join("\n  ")}
};`

  const createEntryObject = `export const entries = new Map<EntryOptions, EntryData>([
  ${entries
    .map(
      entry =>
        `["${entry.name}", { content: ${entry.data ? `"${entry.data}"` : escapeUnicode(JSON.stringify(entry.content))}, compressed: ${entry.compressed} }]`,
    )
    .join(",\n  ")}
]);`

  const createFunctions = `export function getEntry(key: EntryOptions): EntryData | undefined {
  return entries.get(key);
}
export function getEntries(filter: (entry: [EntryOptions, EntryData]) => boolean): [EntryOptions, EntryData][] {
  return Array.from(entries).filter(filter);
};
export function useEntry<K extends keyof EntryMap>(key: K, options: EntryMap[K]) {
  const entry = entries.get(key);

  // Add functionality here
}`

  return `${createTypeOptions}
${createTypeData}
${createTypeEntry.join("\n")}
${createTypeEntryMap}
${createEntryObject}
${createFunctions}`
}

interface ExportedJson {
  [key: string]: {
    content: string
    compressed: boolean
  }
}

function exportJson(entries: Entry[]): string {
  const result: ExportedJson = entries.reduce<ExportedJson>((acc, entry) => {
    acc[entry.name] = {
      content: entry.data ?? entry.content ?? "",
      compressed: entry.compressed,
    }
    return acc
  }, {})

  return JSON.stringify(result, null, 2)
}

/**
 * Generates export files based on the provided entries and options.
 *
 * @param entries - The list of entries to generate export files for.
 * @param options - Configuration options for file generation.
 * @returns An array of generated files.
 */
export function generate(entries: Entry[], options?: GeneratorOptions): GeneratorFile[] {
  const { filename = "index", typesFilename = "index.d", exportType = "ts", splitFiles = false } = options || {}

  const files: GeneratorFile[] = []

  if (exportType === "json") {
    files.push({
      filename,
      ext: "json",
      content: exportJson(entries),
    })
  }
  else if (splitFiles && exportType === "ts") {
    files.push({
      filename,
      ext: "js",
      content: exportJsObject(entries),
    })
    files.push({
      filename,
      ext: "js",
      content: exportJsObject(entries),
    })
    files.push({
      filename: typesFilename,
      ext: "ts",
      content: exportTsDef(entries),
    })
  }
  else {
    files.push({
      filename,
      ext: exportType,
      content: exportType === "ts" ? exportTsFull(entries) : exportJsObject(entries),
    })
  }

  return files
}

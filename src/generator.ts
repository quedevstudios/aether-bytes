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

function sanitizeTypeName(name: string): string {
  return name.replace(/\W/g, "_").replace(/^(\d)/, "_$1")
}

function formatJsEntries(entries: Entry[]): string {
  return entries.map((entry) => {
    const extraFields = entry.extra
      ? Object.entries(entry.extra)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}: ${typeof value === "string" ? `"${value}"` : value}`)
          .join(",\n    ")
      : ""

    return `["${entry.name}", {
    ${extraFields ? `${extraFields},\n    ` : ""}content: ${entry.data ? `"${entry.data}"` : escapeUnicode(JSON.stringify(entry.content))},
    compressed: ${entry.compressed}
  }]`
  }).join(",\n  ")
}

function exportJsObject(entries: Entry[]): string {
  return `export const entries = new Map([
  ${formatJsEntries(entries)}
]);\n
export function getEntry(key) {
  return entries.get(key);
}
export function getEntries(filter) {
  return Array.from(entries).filter(filter);
}
export function useEntry(key, options) {
  /* Add functionality */
  return entries.get(key);
}`
}

function generateTypeMappings(entries: Entry[]): string {
  return entries
    .filter(entry => entry.types && Object.keys(entry.types).length > 0)
    .map(entry => `export interface ${sanitizeTypeName(entry.name)} {
${Object.entries(entry.types!)
  .map(([key, value]) => `  ${key}: ${value};`)
  .join("\n")}
}`)
    .join("\n\n")
}

function generateEntryTypeMap(entries: Entry[]): string {
  const entryTypeMap = entries
    .filter(entry => entry.types && Object.keys(entry.types).length > 0)
    .map(entry => `"${entry.name}": ${sanitizeTypeName(entry.name)};`)
    .join("\n  ")

  return `export interface EntryMap {\n  ${entryTypeMap}\n}`
}

function generateEntryOptions(entries: Entry[]): string {
  return `export type EntryOptions = ${entries.map(entry => `"${entry.name}"`).join(" | ")};`
}

function generateEntryDataInterface(entries: Entry[]): string {
  const fieldTypes: Record<string, Set<string>> = {}

  entries.forEach((entry) => {
    if (!entry.extra)
      return

    Object.entries(entry.extra).forEach(([key, value]) => {
      if (!fieldTypes[key]) {
        fieldTypes[key] = new Set()
      }
      fieldTypes[key]?.add(typeof value)
    })
  })

  const extraFields = Object.entries(fieldTypes)
    .map(([key, types]) => `${key}?: ${[...types].filter(t => t !== "undefined").join(" | ") || "any"};`)
    .join("\n  ")

  return `export interface EntryData {\n  ${extraFields ? `${extraFields}\n  ` : ""}content: string;\n  compressed: boolean;\n}`
}

function exportTs(entries: Entry[], full: boolean): string {
  const typeDefinitions = [
    generateEntryOptions(entries),
    generateEntryDataInterface(entries),
    generateTypeMappings(entries),
    generateEntryTypeMap(entries),
  ].join("\n\n")

  if (!full) {
    return `${typeDefinitions}\n\ndeclare const entries: Map<EntryOptions, EntryData>;
declare function getEntry(key: EntryOptions): EntryData | undefined;
declare function getEntries(filter?: (entry: [EntryOptions, EntryData]) => boolean): [EntryOptions, EntryData][];
declare function useEntry<K extends keyof EntryMap>(key: K | EntryOptions, options?: EntryMap[K]): any;`
  }

  return `${typeDefinitions}\n\nexport const entries = new Map<EntryOptions, EntryData>([\n  ${formatJsEntries(entries)}\n]);

export function getEntry(key: EntryOptions): EntryData | undefined {
  return entries.get(key);
}
export function getEntries(filter?: (entry: [EntryOptions, EntryData]) => boolean): [EntryOptions, EntryData][] {
  return filter ? Array.from(entries).filter(filter) : Array.from(entries);
}
export function useEntry<K extends keyof EntryMap>(key: K | EntryOptions, options?: EntryMap[K]): any {
  /* Add functionality */
  return entries.get(key);
}`
}

function exportJson(entries: Entry[]): string {
  return JSON.stringify(
    Object.fromEntries(entries.map((entry) => {
      const extraFields = entry.extra ? { ...entry.extra } : {}
      return [entry.name, { ...extraFields, content: entry.data ?? entry.content ?? "", compressed: entry.compressed }]
    })),
    null,
    2,
  )
}

/**
 * Generates export files based on the provided entries and options.
 *
 * @param entries - The list of entries to generate export files for.
 * @param options - Configuration options for file generation.
 * @returns An array of generated files.
 */
export function generate(entries: Entry[], options: GeneratorOptions = {}): GeneratorFile[] {
  const { filename = "index", typesFilename = "index.d", exportType = "ts", splitFiles = false } = options
  const files: GeneratorFile[] = []

  if (exportType === "json") {
    files.push({ filename, ext: "json", content: exportJson(entries) })
  }
  else if (splitFiles && exportType === "ts") {
    files.push({ filename, ext: "js", content: exportJsObject(entries) })
    files.push({ filename: typesFilename, ext: "ts", content: exportTs(entries, false) })
  }
  else {
    files.push({ filename, ext: exportType, content: exportType === "ts" ? exportTs(entries, true) : exportJsObject(entries) })
  }

  return files
}

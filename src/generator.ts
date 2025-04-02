import type { Entry } from "./analyzer"

/**
 * Represents the options for generating export files.
 */
export interface GeneratorOptions {
  /** The base filename for the generated files. Defaults to "index". */
  indexFilename?: string
  /** The filename for the type definition file. Defaults to "index.d". */
  typesFilename?: string
  /** The filename for the helper functions file. Defaults to "helpers". */
  helpersFilename?: string
  /** The filename for the JSON file. Defaults to "data". */
  jsonFilename?: string
  /** The export format, either JavaScript ("js") or TypeScript ("ts"). Defaults to "ts". */
  exportFormat?: "js" | "ts" | "json"
  /** Whether to export helper functions. Defaults to true. */
  exportHelpers?: boolean
  /** The export format for the helpers file, either JavaScript ("js") or TypeScript ("ts"). Defaults to "ts". */
  exportHelpersFormat?: "js" | "ts"
  /** Whether to merge compatible files into a single file. Defaults to true. */
  mergeFiles?: boolean
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

function exportEntryOptions(entries: Entry[]): string {
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

function exportTypeMappings(entries: Entry[]): string {
  return entries
    .filter(entry => entry.types && Object.keys(entry.types).length)
    .map((entry) => {
      const typeFields = Object.entries(entry.types!)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join("\n")

      return `export interface ${sanitizeTypeName(entry.name)} {\n${typeFields}\n}`
    })
    .join("\n\n")
}

function exportEntryTypeMap(entries: Entry[]): string {
  const mappedEntries = entries
    .filter(entry => entry.types && Object.keys(entry.types).length)
    .map(entry => `"${entry.name}": ${sanitizeTypeName(entry.name)};`)
    .join("\n  ")

  return `export interface EntryMap {\n  ${mappedEntries || "  // No entries available"}\n}`
}

function exportIndex({
  entries,
  format,
  merge,
  typesFilename,
}: {
  entries: Entry[]
  format: "js" | "ts"
  merge: boolean
  typesFilename: string
}): string {
  const exportImport = `import type { EntryData, EntryOptions } from './${typesFilename}';`

  const exportEntries = `export const entries = new Map${format === "ts" ? "<EntryOptions, EntryData>" : ""}([
  ${formatJsEntries(entries)}
]);`

  const exportChunks = [exportEntries]

  if (!merge && format === "ts") {
    exportChunks.unshift(exportImport)
  }

  return exportChunks.join("\n\n")
}

function exportHelperFunctions({
  format,
  merge,
  indexFilename,
  typesFilename,
}: {
  format: "js" | "ts"
  merge: boolean
  indexFilename: string
  typesFilename: string
}): string {
  const exportImport = `${format === "ts" ? `import type { EntryData, EntryOptions, EntryMap } from './${typesFilename}';\n` : ""}import { entries } from './${indexFilename}';`

  const exportGetEntry = `export function getEntry(key${format === "ts" ? ": EntryOptions" : ""})${format === "ts" ? ": EntryData | undefined" : ""} {
  return entries.get(key);
}`

  const exportGetEntries = `export function getEntries(filter${format === "ts" ? "?: (entry: [EntryOptions, EntryData]) => boolean" : ""})${format === "ts" ? ": [EntryOptions, EntryData][]" : ""} {
  return filter ? Array.from(entries).filter(filter) : Array.from(entries);
}`

  const exportUseEntry = `export function useEntry${format === "ts" ? "<K extends keyof EntryMap>" : ""}(key${format === "ts" ? ": K | EntryOptions" : ""}, options${format === "ts" ? "?: EntryMap[K]" : ""}) {
  /* Add functionality */
  return entries.get(key);
}`

  const exportChunks = [exportGetEntry, exportGetEntries, exportUseEntry]

  if (!merge) {
    exportChunks.unshift(exportImport)
  }

  return exportChunks.join("\n\n")
}

function exportJsonIndex(entries: Entry[]): string {
  const mappedEntries = Object.fromEntries(
    entries.map(({ name, extra = {}, data, content, compressed }) => [
      name,
      { ...extra, content: data ?? content ?? "", compressed },
    ]),
  )

  return JSON.stringify(mappedEntries, null, 2)
}

function exportJsonHelpers({
  format,
  jsonFilename,
}: {
  format: "js" | "ts"
  jsonFilename: string
}): string {
  const exportGetEntry = `export async function getEntry(key${format === "ts" ? ": EntryOptions" : ""})${format === "ts" ? ": Promise<EntryData | undefined>" : ""} {
  const jsonData = (await import("./${jsonFilename}.json", { assert: { type: "json" } })).default${format === "ts" ? " as unknown as [EntryOptions, EntryData][];" : ";"}
  return jsonData.find(entry => entry[0] === key)?.[1];
}`

  const exportGetEntries = `export async function getEntries(filter${format === "ts" ? "?: (entry: [EntryOptions, EntryData]) => boolean" : ""})${format === "ts" ? ": Promise<[EntryOptions, EntryData][]>" : ""} {
  const jsonData = (await import("./${jsonFilename}.json", { assert: { type: "json" } })).default${format === "ts" ? " as unknown as [EntryOptions, EntryData][];" : ";"}
  return filter ? jsonData.filter(filter) : jsonData;
}`

  const exportUseEntry = `export async function useEntry${format === "ts" ? "<K extends keyof EntryMap>" : ""}(key${format === "ts" ? ": K | EntryOptions" : ""}, options${format === "ts" ? "?: EntryMap[K]" : ""}) {
  const jsonData = (await import("./${jsonFilename}.json", { assert: { type: "json" } })).default${format === "ts" ? " as unknown as [EntryOptions, EntryData][];" : ";"}
  /* Add functionality */
  return jsonData.find(entry => entry[0] === key)?.[1];
}`

  const exportChunks = [exportGetEntry, exportGetEntries, exportUseEntry]

  return exportChunks.join("\n\n")
}

/**
 * Generates export files based on the provided entries and options.
 *
 * @param entries - The list of entries to generate export files for.
 * @param options - Configuration options for file generation.
 * @returns An array of generated files.
 */
export function generate(entries: Entry[], options: GeneratorOptions = {}): GeneratorFile[] {
  const {
    indexFilename = "index",
    typesFilename = "index.d",
    helpersFilename = "helpers",
    jsonFilename = "data",
    exportHelpers = true,
    exportFormat = "ts",
    exportHelpersFormat = "ts",
    mergeFiles = false,
  } = options
  const files: GeneratorFile[] = []

  if (exportFormat === "json") {
    files.push({ filename: jsonFilename, ext: "json", content: exportJsonIndex(entries) })

    const exportChunks = [exportJsonHelpers({ format: exportHelpersFormat, jsonFilename })]

    if (exportHelpers) {
      if (exportHelpersFormat === "ts") {
        exportChunks.unshift(...[
          exportEntryOptions(entries),
          generateEntryDataInterface(entries),
          exportTypeMappings(entries),
          exportEntryTypeMap(entries),
        ])

        files.push({ filename: helpersFilename, ext: exportHelpersFormat, content: exportChunks.join("\n\n") })
      }
      else {
        files.push({ filename: helpersFilename, ext: exportHelpersFormat, content: exportChunks.join("\n\n") })
      }
    }
  }
  else {
    if (mergeFiles) {
      const exportChunks = [exportIndex({
        entries,
        format: exportFormat,
        merge: mergeFiles,
        typesFilename,
      })]

      if (exportHelpers) {
        exportChunks.push(exportHelperFunctions({
          format: exportHelpersFormat,
          merge: mergeFiles,
          indexFilename,
          typesFilename,
        }))
      }

      if (exportFormat === "ts") {
        exportChunks.unshift(...[
          exportEntryOptions(entries),
          generateEntryDataInterface(entries),
          exportTypeMappings(entries),
          exportEntryTypeMap(entries),
        ])
      }

      files.push({ filename: indexFilename, ext: exportFormat, content: exportChunks.join("\n\n") })
    }
    else {
      files.push({
        filename: indexFilename,
        ext: exportFormat,
        content: exportIndex({
          entries,
          format: exportFormat,
          merge: mergeFiles,
          typesFilename,
        }),
      })

      if (exportFormat === "ts") {
        const exportChunks = [
          exportEntryOptions(entries),
          generateEntryDataInterface(entries),
          exportTypeMappings(entries),
          exportEntryTypeMap(entries),
        ]

        files.push({ filename: typesFilename, ext: exportFormat, content: exportChunks.join("\n\n") })
      }

      if (exportHelpers) {
        files.push({
          filename: helpersFilename,
          ext: exportHelpersFormat,
          content: exportHelperFunctions({
            format: exportHelpersFormat,
            merge: mergeFiles,
            indexFilename,
            typesFilename,
          }),
        })
      }
    }
  }

  return files
}

import {
  exists,
  readFile,
} from "node:fs/promises"
import { extname, sep } from "node:path"

/**
 * Represents the types of entries that can be extracted from a file's content.
 */
export type EntryTypes =
  | Record<string, string>
  | undefined

/**
 * Represents an analyzed file entry with metadata and extracted data.
 */
export interface Entry {
  /** The name of the file without its extension. */
  name: string
  /** The file extension without the leading dot. */
  ext: string
  /** The full path to the file. */
  path: string
  /** The content of the file as a string. */
  content: string
  /** Extracted template variables and their inferred types. */
  types: EntryTypes
  /** Optional flag indicating whether the file is compressed or not. */
  compressed: boolean
  /** Optional processed data related to the file. */
  data?: string
  /** Optional extra metadata related to the file. */
  extra?: Record<string, string | number | boolean>
}

/**
 * Analyzes a file and extracts metadata, content, and detected template variables.
 *
 * @param filepath - The path to the file to be analyzed.
 * @param genTypes - Whether to generate types for detected template variables.
 * @returns A promise that resolves to an {@link Entry} object with extracted information.
 */
export async function analyze({
  filepath,
  genTypes = true,
}: {
  filepath: string
  genTypes?: boolean
}): Promise<Entry> {
  if (!await exists(filepath)) {
    throw new Error(`File does not exist: ${filepath}`)
  }

  const name = filepath.split(sep).pop()?.split(".")[0] || ""
  const ext = extname(filepath).slice(1)
  const path = filepath
  const content = await readFile(filepath, "utf-8")

  // Extract template variables in the format {{ variable }} or {variable}
  const matches = content.match(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g) || []
  const types: EntryTypes = matches.reduce((acc, match) => {
    const variable = match.replace(/\{\{|\}\}|\{|\}/g, "").trim()
    acc = acc || {}
    acc[variable] = "string"
    return acc
  }, {} as EntryTypes)

  const compressed = false

  return {
    name,
    ext,
    path,
    content,
    types: genTypes ? types : undefined,
    compressed,
  }
}

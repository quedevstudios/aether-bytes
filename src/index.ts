import { EventEmitter } from "node:events"
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises"
import { extname, join, sep } from "node:path"

/**
 * Options for loading files
 *
 * @includeExt - Array of file extensions to include (e.g. ['js', 'ts'])
 * @excludeExt - Array of file extensions to exclude (e.g. ['json', 'txt'])
 */
export interface LoadOptions {
  includeExt?: string[]
  excludeExt?: string[]
}

/**
 * Options for writing the output file
 *
 * @filename - The name of the output file (default is 'index')
 * @type - The type of the output file, either 'js' or 'ts' (default is 'ts')
 */
export interface WriteOptions {
  filename?: string
  type?: "js" | "ts"
}

/**
 * This represents an object where the keys are variable names found in the file
 *
 * @key {string} - The variable name
 * @value {string} - The type of the variable (default is 'string')
 */
export type EntryTypes =
  | {
    [key: string]: string
  }
  | undefined

/**
 * Interface for the entry object
 * This represents a single file entry with its properties
 *
 * @property {string} name - The name of the file without extension
 * @property {string} ext - The file extension
 * @property {string} path - The full path to the file
 * @property {string} content - The content of the file
 * @property {string} base64 - The base64 encoded content of the file
 * @property {EntryTypes} types - An object representing the types of variables found in the file
 */
export interface Entry {
  name: string
  ext: string
  path: string
  content: string
  base64: string
  types: EntryTypes
}

/**
 * AetherBytes is a class that analyzes files, extracts variables, and generates a TypeScript or JavaScript file
 * with the results. It extends EventEmitter to allow for event-driven programming.
 */
export class AetherBytes extends EventEmitter {
  private entries: Entry[] = []

  /**
   * Get the entries array which contains all analyzed file entries
   *
   * @returns An array of entries representing the analyzed files
   */
  public getEntries(): Entry[] {
    return this.entries
  }

  /**
   * Analyze a single file, extract its content, and map variables to their types
   *
   * @param {string} filepath - The path to the file to analyze
   * @param {boolean} push - Whether to push the entry to the entries array (default: false)
   * @returns A promise that resolves to the analyzed entry object
   */
  public async analyze(filepath: string, push?: boolean): Promise<Entry> {
    try {
      const name = filepath.split(sep).pop()?.split(".")[0] || ""
      const ext = extname(filepath).slice(1)
      const content = await readFile(filepath, "utf-8")

      const base64 = Buffer.from(content).toString("base64")

      // Scan for variables inside {} and map them to key, and rest as string
      const matches = content.match(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g) || []
      const types: EntryTypes = matches.reduce((acc, match) => {
        const variable = match.replace(/\{\{|\}\}|\{|\}/g, "").trim()
        acc = acc || {}
        acc[variable] = "string"
        return acc
      }, {} as EntryTypes)

      const entry: Entry = { name, ext, path: filepath, content, base64, types }

      this.emit("data", entry)

      if (push) {
        this.entries.push(entry)
      }

      return entry
    }
    catch (error) {
      this.emit("error", `Error analyzing file ${filepath}: ${error}`)
      throw error
    }
  }

  private async getFilesFromDirectory(directory: string): Promise<string[]> {
    const files: string[] = []

    try {
      const items = await readdir(directory, { withFileTypes: true })

      for (const item of items) {
        const fullPath = join(directory, item.name)

        if (item.isDirectory()) {
          const subFiles = await this.getFilesFromDirectory(fullPath)
          files.push(...subFiles)
        }
        else {
          files.push(fullPath)
        }
      }
    }
    catch (error) {
      this.emit("error", `Error reading directory ${directory}: ${error}`)
    }

    return files
  }

  /**
   * Load files from a specified source (file or directory), analyze them, and store the results
   *
   * @param {string | string[]} source - The path to the file or directory to load
   * @param {LoadOptions} options - Options for loading files (e.g. include/exclude extensions)
   * @returns A promise that resolves when the loading is completed
   */
  public async load(source: string | string[], options?: LoadOptions): Promise<void> {
    try {
      const sources = typeof source === "string" ? [source] : source

      let files: string[] = []

      for (const src of sources) {
        try {
          const srcStats = await stat(src)

          if (srcStats.isFile()) {
            files.push(src)
          }
          else if (srcStats.isDirectory()) {
            const dirFiles = await this.getFilesFromDirectory(src)

            files.push(...dirFiles)
          }
        }
        catch (error) {
          this.emit("error", `Error accessing ${src}: ${error}`)
        }
      }

      // Handle if ext in both include and exclude
      if (options?.includeExt && options?.excludeExt) {
        const intersection = options.includeExt.filter(ext => options.excludeExt?.includes(ext))
        if (intersection.length > 0) {
          this.emit("error", `Extensions ${intersection.join(", ")} are in both include and exclude`)
          return
        }
      }

      // Apply filters
      files = files.filter((file) => {
        const ext = extname(file).slice(1)
        if (options?.includeExt && !options.includeExt.includes(ext)) {
          return false
        }
        if (options?.excludeExt && options.excludeExt.includes(ext)) {
          return false
        }
        return true
      })

      for (const file of files) {
        await this.analyze(file, true)
      }

      this.emit("done", { message: "Loading completed", files: this.entries.length })
    }
    catch (error) {
      this.emit("error", `Error loading files: ${error}`)
    }
  }

  private toPascalCase(string: string): string {
    return string
      .replace(/[-_]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join("")
  }

  private createTypeOptions(entries: Entry[]): string {
    return `export type Options = ${entries
      .map(email => `"${email.name}"`)
      .join(" | ")};`
  }

  private createTypeEntry(entries: Entry[]): string {
    return entries
      .map((entry) => {
        if (!entry.types || Object.keys(entry.types).length === 0) {
          return ""
        }

        let type = `export type ${this.toPascalCase(entry.name)} = {
${Object.entries(entry.types)
  .map(([key, value]) => `  ${key}: ${value};`)
  .join("\n")}
};`

        type = type.replace(/,/g, "")

        return type
      })
      .join("\n")
  }

  private createEntryObject(entries: Entry[]): string {
    return `export const entries: Record<Options, string> = {
${entries
  .map(
    entry =>
      `  "${entry.name}": \"${entry.base64}\"`,
  )
  .join(",\n")}
};`
  }

  /**
   * Write the analyzed entries to a file in TypeScript or JavaScript format
   *
   * @param {string} destination - The directory where the output file will be written
   * @param {WriteOptions} options - Options for writing the output file (e.g. filename, type)
   * @returns A promise that resolves when the writing is completed
   */
  public async write(destination: string, options?: WriteOptions): Promise<string | undefined> {
    const filename = options?.filename || "index"
    const ext = options?.type || "ts"
    const filepath = join(destination, `${filename}.${ext}`)

    const entryObject = this.createEntryObject(this.entries)
    let typeFileContent = `${entryObject}`

    if (ext === "ts") {
      const typeOptions = this.createTypeOptions(this.entries)
      const types = this.createTypeEntry(this.entries)
      typeFileContent = `${typeOptions}\n\n${types}\n\n${entryObject}`
    }

    try {
      mkdir(destination, { recursive: true })

      await writeFile(filepath, typeFileContent)
      this.emit("done", { message: "Conversion completed", output: filepath })

      return filepath
    }
    catch (error) {
      this.emit("error", `Error converting files:: ${error}`)
      return undefined
    }
  }
}

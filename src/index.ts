import type { Entry } from "./analyzer"
import type { CompressOptions, DecompressOptions } from "./compression"
import type { EventCallback, EventTypes } from "./events"
import type { GeneratorFile, GeneratorOptions } from "./generator"
import {
  mkdir,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises"
import { extname, join } from "node:path"
import { analyze } from "./analyzer"
import { compressor, decompressor } from "./compression"
import { EventEmitter } from "./events"
import { generate } from "./generator"

export type { CompressOptions, DecompressOptions, Entry, EventCallback, EventTypes, GeneratorFile, GeneratorOptions }

/**
 * Options for loading and filtering files.
 */
export interface LoadOptions {
  /**
   * List of file extensions to include.
   * If specified, only files with these extensions will be processed.
   */
  includeExt?: string[]

  /**
   * List of file extensions to exclude.
   * If specified, files with these extensions will be ignored.
   */
  excludeExt?: string[]

  /**
   * Whether to generate types for detected template variables.
   */
  genTypes?: boolean
}

/**
 * Represents a callback function to modify an entry.
 */
export type ModifyCallback = (entry: Entry) => Promise<Partial<Entry> | undefined> | Partial<Entry> | undefined

/**
 * Represents a callback function to add extra to an entry.
 */
export type ExtraCallback = (entry: Entry) => Promise<{ [key: string]: string | number | boolean } | undefined> | { [key: string]: string | number | boolean } | undefined

export class AetherBytes {
  private eventEmitter: EventEmitter
  private entries: Entry[] = []
  private files: GeneratorFile[] = []

  constructor() {
    this.eventEmitter = new EventEmitter()
  }

  /**
   * Registers an event listener.
   *
   * @param event - The event name to listen for.
   * @param callback - The function to be called when the event is triggered.
   *
   * @template K - The key of the event type.
   */
  public on<K extends keyof EventTypes>(event: K, callback: EventCallback<K>): void {
    this.eventEmitter.on(event, callback)
  }

  private emit<K extends keyof EventTypes>(event: K, data: EventTypes[K]): void {
    this.eventEmitter.emit(event, data)
  }

  /**
   * Retrieves the list of analyzed entries.
   *
   * @returns An array of analyzed {@link Entry} objects.
   */
  public getEntries(): Entry[] {
    return this.entries
  }

  /**
   * Analyzes a file and extracts metadata, content, and detected template variables.
   *
   * @param filepath - The path to the file to be analyzed.
   * @param push - Whether to push the analyzed entry to the internal entries list.
   * @returns A promise that resolves to an {@link Entry} object with extracted information.
   */
  public async analyze({
    filepath,
    genTypes,
    push = false,
  }: {
    filepath: string
    genTypes?: boolean
    push?: boolean
  }): Promise<Entry> {
    const entry = await analyze({ filepath, genTypes })

    this.emit("analyzed", { message: `Analyzed file ${filepath}`, entry })

    if (push) {
      this.entries.push(entry)
    }

    return entry
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
      this.emit("error", { message: `Error reading directory ${directory}`, error })
    }

    return files
  }

  /**
   * Loads files from the specified source(s), applying optional filters.
   *
   * @param source - A file path or an array of file paths or directories.
   * @param options - Options to filter and process the files.
   * @returns A promise resolving to an array of loaded {@link Entry} objects.
   */
  public async load(source: string | string[], options?: LoadOptions): Promise<Entry[]> {
    const sources = Array.isArray(source) ? source : [source]

    let files: string[] = []

    for (const src of sources) {
      try {
        const stats = await stat(src)

        if (stats.isDirectory()) {
          const dirFiles = await this.getFilesFromDirectory(src)
          files.push(...dirFiles)
        }
        else {
          files.push(src)
        }
      }
      catch (error) {
        this.emit("error", { message: `Error reading source ${src}`, error })
      }
    }

    // Validate include and exclude extensions
    if (options?.includeExt && options?.excludeExt) {
      const normalize = (ext: string): string => ext.replace(/^\./, "")
      const includeExtNormalized = options.includeExt.map(normalize)
      const excludeExtNormalized = options.excludeExt.map(normalize)

      const intersection = includeExtNormalized.filter(ext => excludeExtNormalized.includes(ext))

      if (intersection.length > 0) {
        this.emit("error", { message: `Conflicting include and exclude extensions: ${intersection.join(", ")}` })
        return []
      }
    }

    // Apply extension filtering
    files = files.filter((file) => {
      const ext = extname(file).replace(/^\./, "")

      if (options?.includeExt) {
        const normalizedIncludeExt = options.includeExt.map(e => e.replace(/^\./, ""))
        if (!normalizedIncludeExt.includes(ext)) {
          return false
        }
      }

      if (options?.excludeExt) {
        const normalizedExcludeExt = options.excludeExt.map(e => e.replace(/^\./, ""))
        if (normalizedExcludeExt.includes(ext)) {
          return false
        }
      }

      return true
    })

    for (const file of files) {
      try {
        await this.analyze({ filepath: file, genTypes: options?.genTypes, push: true })

        this.emit("loaded", { message: `Loaded file ${file}`, files: files.length })
      }
      catch (error) {
        this.emit("error", { message: `Error reading file ${file}`, error })
      }
    }

    return this.entries
  }

  /**
   * Compresses the loaded entries using the specified algorithm.
   *
   * @param options - Options for compression.
   * @returns A promise resolving to an array of loaded {@link Entry} objects with
   *          compressed content and compression settings
   */
  public async compress(options?: CompressOptions): Promise <Entry[]> {
    const files: Entry[] = []

    for (const entry of this.entries) {
      try {
        const compressedContent = await compressor(entry.content, options)

        const newEntry = { ...entry, data: compressedContent, compressed: true }
        files.push(newEntry)

        this.emit("compression", { message: `Compressed file ${newEntry.path}`, data: newEntry.data })
      }
      catch (error) {
        this.emit("error", { message: `Error compressing file ${entry.path}`, error })
      }
    }

    this.entries = files

    return files
  }

  /**
   * Decompresses the loaded entries using the specified algorithm.
   *
   * @param options - Options for decompression.
   * @returns A promise resolving to an array of loaded {@link Entry} objects with
   *          decompressed content
   */
  public async decompress(options?: DecompressOptions): Promise<Entry[]> {
    const files: Entry[] = []

    for (const entry of this.entries) {
      try {
        if (!entry.data) {
          continue
        }

        const decompressedContent = await decompressor(entry.data, options)

        const newEntry = { ...entry, data: decompressedContent, compressed: false }
        files.push(newEntry)

        this.emit("compression", { message: `Decompressed file ${newEntry.path}`, data: newEntry.data })
      }
      catch (error) {
        this.emit("error", { message: `Error decompressing file ${entry.path}`, error })
      }
    }

    this.entries = files

    return files
  }

  /**
   * Modifies the loaded entries by using the specified callback.
   *
   * @param callback - A callback function that returns an object with extra metadata.
   * @returns A promise resolving to an array of loaded {@link Entry} objects with added extra metadata
   */
  public async modifyEntries(callback: ModifyCallback): Promise<Entry[]> {
    const files: Entry[] = []

    for (const entry of this.entries) {
      const updatedEntry = await callback(entry)

      if (updatedEntry && Object.keys(updatedEntry).length > 0) {
        files.push({ ...entry, ...updatedEntry })
      }
    }

    this.entries = files

    return files
  }

  /**
   * Adds extra metadata to the loaded entries.
   *
   * @param callback - A callback function that returns an object with extra metadata.
   * @returns A promise resolving to an array of loaded {@link Entry} objects with added extra metadata
   */
  public async addExtra(callback: ExtraCallback): Promise<Entry[]> {
    const files: Entry[] = []

    for (const entry of this.entries) {
      const extra = await callback(entry)

      if (extra && Object.keys(extra).length > 0) {
        files.push({ ...entry, extra })
      }
    }

    this.entries = files

    return files
  }

  /**
   * Generates files from the loaded entries using the specified template engine.
   *
   * @param destination - The destination directory to write the generated files.
   * @param options - Options for the generator.
   * @returns A promise resolving to an array of generated {@link GeneratorFile} objects with content and metadata
   *          or `undefined` if no entries are available
   *
   * @throws If an error occurs during file generation, the promise is rejected with an error.
   */
  public async generate(destination: string, options?: GeneratorOptions): Promise<GeneratorFile[] | undefined> {
    if (this.entries.length === 0) {
      this.emit("error", { message: "No entries to write" })
      return undefined
    }

    const sortedEntries = this.entries.sort((a, b) => a.name.localeCompare(b.name))
    const files = generate(sortedEntries, options)

    for (const file of files) {
      try {
        const fullPath = join(destination, `${file.filename}.${file.ext}`)
        await mkdir(destination, { recursive: true })
        await writeFile(fullPath, file.content)

        this.emit("generator", { message: `Generated file ${fullPath}`, file })

        this.files.push(file)
      }
      catch (error) {
        this.emit("error", { message: `Error generating file ${file.filename}`, error })
      }
    }

    return files
  }
}

/**
 * Decompresses the loaded entries using the specified algorithm.
 *
 * @param data - The data to be decompressed as a string.
 * @param options - Options for decompression.
 * @returns A promise resolving to an array of loaded {@link Entry} objects with
 *          decompressed content
 */
export async function decompress(data: string, options?: DecompressOptions): Promise<string> {
  return await decompressor(data, options)
}

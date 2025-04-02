import { readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { beforeAll, describe, expect, test } from "bun:test"
import { AetherBytes, decompress } from "../src"

const TEMP_DIR = "./tests/.temp"
const TEMPLATE_DIR = "./tests/templates"
const TEMPLATE_FILES = await readdir(TEMPLATE_DIR, { recursive: true })

if (TEMPLATE_FILES.length === 0) {
  throw new Error("No files found in the template directory")
}

beforeAll(async () => {
  await rm(TEMP_DIR, { recursive: true, force: true })
})

describe("AetherBytes", () => {
  describe("getEntries", () => {
    test("should return empty if no files loaded", () => {
      const aetherBytes = new AetherBytes()

      expect(aetherBytes.getEntries().length).toEqual(0)
    })

    test("should return loaded files", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)

      expect(aetherBytes.getEntries().length).not.toBe(0)
    })
  })

  describe("analyze", () => {
    test("should process a file and extract metadata with types", async () => {
      const aetherBytes = new AetherBytes()
      const filepath = join(TEMPLATE_DIR, TEMPLATE_FILES[0] as string)
      const entry = await aetherBytes.analyze({ filepath })

      expect(entry).toMatchObject({
        name: TEMPLATE_FILES[0]?.split(".")[0],
        ext: TEMPLATE_FILES[0]?.split(".")[1],
        path: filepath,
        content: expect.any(String),
        types: expect.any(Object),
      })
    })

    test("should process a file and extract metadata without types", async () => {
      const aetherBytes = new AetherBytes()
      const filepath = join(TEMPLATE_DIR, TEMPLATE_FILES[0] as string)
      const entry = await aetherBytes.analyze({ filepath, genTypes: false })

      expect(entry).toMatchObject({
        name: TEMPLATE_FILES[0]?.split(".")[0],
        ext: TEMPLATE_FILES[0]?.split(".")[1],
        path: filepath,
        content: expect.any(String),
      })
    })

    test("should throw an error if file does not exist", () => {
      const aetherBytes = new AetherBytes()
      const filepath = join(TEMPLATE_DIR, "nonexistent-file.txt")

      expect(aetherBytes.analyze({ filepath })).rejects.toThrow(
        `File does not exist: ${filepath}`,
      )
    })
  })

  describe("load", () => {
    test("should load file from filepath", async () => {
      const aetherBytes = new AetherBytes()

      let eventData
      aetherBytes.on("loaded", (data) => {
        eventData = data
      })

      const filepath = join(TEMPLATE_DIR, TEMPLATE_FILES[0] as string)
      await aetherBytes.load(filepath)
      expect(eventData).toMatchObject({ message: expect.any(String), files: 1 })
    })

    test("should load files from directory", async () => {
      const aetherBytes = new AetherBytes()

      let eventData
      aetherBytes.on("loaded", (data) => {
        eventData = data
      })

      await aetherBytes.load(TEMPLATE_DIR)
      expect(eventData).toMatchObject({ message: expect.any(String), files: 5 })
    })

    test("should apply extension filters", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR, { includeExt: ["md"] })

      expect(aetherBytes.getEntries().length).toBe(2)
    })

    test("should handle conflicting include and exclude filters", async () => {
      const aetherBytes = new AetherBytes()

      let eventData
      aetherBytes.on("error", (data) => {
        eventData = data
      })

      await aetherBytes.load(TEMPLATE_DIR, { includeExt: [".md"], excludeExt: ["md"] })

      expect(eventData).toMatchObject({ message: "Conflicting include and exclude extensions: md" })
    })
  })

  describe("compress", () => {
    test("should encode entry content to data and set compressed to true", async () => {
      const aetherBytes = new AetherBytes()
      const originalEntries = await aetherBytes.load(TEMPLATE_DIR)
      const compressedEntries = await aetherBytes.compress()

      expect(originalEntries[0]?.content).not.toEqual(compressedEntries[0]?.data)
      expect(compressedEntries[0]).toHaveProperty("compressed", true)
    })
  })

  describe("decompress", () => {
    test("should decode compressed entry data to data", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const compressedEntries = await aetherBytes.compress()
      const decompressedEntries = await aetherBytes.decompress()

      expect(compressedEntries[0]?.data).not.toEqual(decompressedEntries[0]?.data)
      expect(decompressedEntries[0]).toHaveProperty("compressed", false)
    })
  })

  describe("modifyEntries", () => {
    test(" should update entry properties", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      await aetherBytes.modifyEntries(entry => ({ name: `${entry.name} - Hello World!` }))

      expect(aetherBytes.getEntries()[0]).toHaveProperty("name", `${TEMPLATE_FILES[0]?.split(".")[0]} - Hello World!`)
    })
  })

  describe("addExtra", () => {
    test("should add extra property to entry", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      await aetherBytes.addExtra(_entry => ({ category: "test" }))

      expect(aetherBytes.getEntries()[0]?.extra).toHaveProperty("category", "test")
    })
  })

  describe("generate", () => {
    test("should export: json without helpers", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "json-no-helpers")
      const filename = "data"
      await aetherBytes.generate(outputDir, {
        jsonFilename: filename,
        exportFormat: "json",
        exportHelpers: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(1)
      expect(tempFiles[0]).toContain(filename)
    })
    test("should export: json with js helpers separate", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "json-js-helpers-separate")
      const filename = "data"
      const helperFilename = "helpers"
      await aetherBytes.generate(outputDir, {
        helpersFilename: helperFilename,
        jsonFilename: filename,
        exportFormat: "json",
        exportHelpersFormat: "js",
        mergeFiles: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(2)
      expect(tempFiles).toEqual(
        expect.arrayContaining([
          expect.stringContaining(filename),
          expect.stringContaining(helperFilename),
        ]),
      )
    })
    test("should export: json with ts helpers separate", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "json-ts-helpers-separate")
      const filename = "data"
      const helperFilename = "helpers"
      await aetherBytes.generate(outputDir, {
        helpersFilename: helperFilename,
        jsonFilename: filename,
        exportFormat: "json",
        exportHelpersFormat: "ts",
        mergeFiles: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(2)
      expect(tempFiles).toEqual(
        expect.arrayContaining([
          expect.stringContaining(filename),
          expect.stringContaining(helperFilename),
        ]),
      )
    })

    test("should export: js without helpers", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "js-no-helpers")
      const filename = "index"
      await aetherBytes.generate(outputDir, {
        indexFilename: filename,
        exportFormat: "js",
        exportHelpers: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(1)
      expect(tempFiles[0]).toContain(filename)
    })
    test("should export: js with helpers separate", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "js-js-helpers-separate")
      const filename = "index"
      const helperFilename = "helpers"
      await aetherBytes.generate(outputDir, {
        helpersFilename: helperFilename,
        indexFilename: filename,
        exportFormat: "js",
        exportHelpersFormat: "js",
        mergeFiles: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(2)
      expect(tempFiles).toEqual(
        expect.arrayContaining([
          expect.stringContaining(filename),
          expect.stringContaining(helperFilename),
        ]),
      )
    })
    test("should export: js with helpers merged", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "js-js-helpers-merged")
      const filename = "index"
      await aetherBytes.generate(outputDir, {
        indexFilename: filename,
        exportFormat: "js",
        exportHelpersFormat: "js",
        mergeFiles: true,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(1)
      expect(tempFiles[0]).toContain(filename)
    })
    test("should export: js with type-definitions", async () => {})

    test("should export: ts without helpers", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "ts-no-helpers")
      const filename = "index"
      await aetherBytes.generate(outputDir, {
        indexFilename: filename,
        exportFormat: "ts",
        exportHelpers: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(2)
      expect(tempFiles[0]).toContain(filename)
    })
    test("should export: ts with helpers separate", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "ts-ts-helpers-separate")
      const indexFilename = "index"
      const typesFilename = "index.d"
      const helpersFilename = "helpers"
      await aetherBytes.generate(outputDir, {
        helpersFilename,
        indexFilename,
        typesFilename,
        exportFormat: "ts",
        exportHelpersFormat: "ts",
        mergeFiles: false,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(3)
      expect(tempFiles).toEqual(
        expect.arrayContaining([
          expect.stringContaining(indexFilename),
          expect.stringContaining(helpersFilename),
          expect.stringContaining(typesFilename),
        ]),
      )
    })
    test("should export: ts with helpers merged", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)
      const outputDir = join(TEMP_DIR, "ts-ts-helpers-merged")
      const filename = "index"
      await aetherBytes.generate(outputDir, {
        indexFilename: filename,
        exportFormat: "ts",
        exportHelpersFormat: "ts",
        mergeFiles: true,
      })
      const tempFiles = await readdir(outputDir, { recursive: true })

      expect(tempFiles.length).toBe(1)
      expect(tempFiles[0]).toContain(filename)
    })
  })
})

describe("decompress", () => {
  test("should decompress data to string", async () => {
    const aetherBytes = new AetherBytes()
    const filepath = join(TEMPLATE_DIR, TEMPLATE_FILES[0] as string)
    await aetherBytes.analyze({
      filepath,
      push: true,
    })
    const compressed = await aetherBytes.compress()

    if (!compressed || compressed.length === 0) {
      throw new Error("No compressed data found")
    }

    if (compressed && compressed.length > 1 && compressed?.[0]?.data) {
      const decompressed = await decompress(compressed[0].data)

      expect(decompressed).toMatchObject({
        data: expect.any(String),
        compressed: false,
      })
    }
  })
})

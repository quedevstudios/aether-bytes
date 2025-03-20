import { readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, describe, expect, test } from "bun:test"
import { AetherBytes } from "../src"

const TEMP_DIR = "./tests/.temp"
const TEMPLATE_DIR = "./tests/templates"
const TEMPLATE_FILES = await readdir(TEMPLATE_DIR, { recursive: true })

if (TEMPLATE_FILES.length === 0) {
  throw new Error("No files found in the template directory")
}

describe("AetherBytes", () => {
  describe("getEntries", () => {
    test("should return empty array if no files loaded", () => {
      const aetherBytes = new AetherBytes()

      expect(aetherBytes.getEntries()).toEqual([])
    })

    test("should return loaded files", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)

      expect(aetherBytes.getEntries().length).toBe(3)
    })
  })

  describe("analyze", () => {
    test("should analyze file", async () => {
      const aetherBytes = new AetherBytes()
      const filepath = join(TEMPLATE_DIR, TEMPLATE_FILES[0] as string)
      const analysis = await aetherBytes.analyze(filepath)

      expect(analysis).toMatchObject({
        name: TEMPLATE_FILES[0]?.split(".")[0],
        ext: TEMPLATE_FILES[0]?.split(".")[1],
        path: filepath,
        content: expect.any(String),
        base64: expect.any(String),
        types: expect.any(Object),
      })
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
      expect(eventData).toMatchObject({ message: "Loading completed", files: 1 })
    })

    test("should load files from directory", async () => {
      const aetherBytes = new AetherBytes()

      let eventData
      aetherBytes.on("loaded", (data) => {
        eventData = data
      })

      await aetherBytes.load(TEMPLATE_DIR)
      expect(eventData).toMatchObject({ message: "Loading completed", files: 3 })
    })

    test("should apply extension filters", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR, { includeExt: ["md"] })

      expect(aetherBytes.getEntries().length).toBe(1)
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

  describe("write", () => {
    test("should write files", async () => {
      const aetherBytes = new AetherBytes()
      await aetherBytes.load(TEMPLATE_DIR)

      await rm(TEMP_DIR, { recursive: true, force: true })
      await aetherBytes.write(TEMP_DIR)

      const tempFiles = await readdir(TEMP_DIR, { recursive: true })
      expect(tempFiles.length).toBe(1)
    })

    test("should contain types and entries", async () => {
      const tempFiles = await readdir(TEMP_DIR, { recursive: true })
      const tempFile = tempFiles.find(file => file.endsWith("index.ts"))

      if (!tempFile) {
        throw new Error("No index.ts file found in the temp directory")
      }

      const tempFilePath = join(TEMP_DIR, tempFile)
      const tempFileUrl = pathToFileURL(tempFilePath).href

      const tempFileContent = await import(tempFileUrl)

      expect(tempFileContent.entries).toBeDefined()
      expect(typeof tempFileContent.entries).toBe("object")
    })
  })
})

afterAll(async () => {
  await rm(TEMP_DIR, { recursive: true, force: true })
})

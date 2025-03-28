import type {
  DeflateOptions,
  InflateOptions,
} from "pako"
import { deflate, inflate } from "pako"

/**
 * Represents the options for compressing data.
 * These options are passed to the `deflate` function from the `pako` library.
 *
 * @see {@link https://github.com/nodeca/pako#deflate}
 */
export type CompressOptions = DeflateOptions

/**
 * Represents the options for decompressing data.
 * These options are passed to the `inflate` function from the `pako` library.
 *
 * @see {@link https://github.com/nodeca/pako#inflate}
 */
export type DecompressOptions = InflateOptions

/**
 * Compresses the provided data using the `deflate` algorithm from the `pako` library.
 *
 * @param data - The data to be compressed. It can be a string or a `Uint8Array`.
 * @param options - The compression options. By default, it uses a compression level of 9.
 * @returns A promise that resolves to the compressed data as a `Uint8Array`.
 * @throws If the compression fails, the promise is rejected with an error.
 *
 * @see {@link https://github.com/nodeca/pako#deflate}
 */
export async function compressor(data: string | Uint8Array, options: CompressOptions = { level: 9 }): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const compressedData = deflate(data, options)
      const base64Data = btoa(String.fromCharCode(...compressedData))
      resolve(base64Data)
    }
    catch (error) {
      reject(error)
    }
  })
}

/**
 * Decompresses the provided data using the `inflate` algorithm from the `pako` library.
 *
 * @param data - The data to be decompressed as a string.
 * @param options - The decompression options.
 * @returns A promise that resolves to the decompressed data, either as a string (if the decompressed data is text) or as a `Uint8Array`.
 * @throws If the decompression fails, the promise is rejected with an error.
 *
 * @see {@link https://github.com/nodeca/pako#inflate}
 */
export async function decompressor(data: string, options: DecompressOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const binaryString = atob(data)
      const uint8Array = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }

      const decompressedData = inflate(uint8Array, options)
      const textDecoder = new TextDecoder("utf-8")
      resolve(textDecoder.decode(decompressedData))
    }
    catch (error) {
      reject(error)
    }
  })
}

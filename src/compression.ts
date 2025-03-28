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
export async function compressor(data: string | Uint8Array, options: CompressOptions = { level: 9 }): Promise<Uint8Array> {
  const { ...deflateOptions } = options

  return new Promise((resolve, reject) => {
    try {
      const compressedData = deflate(data, deflateOptions)
      resolve(compressedData)
    }
    catch (error) {
      reject(error)
    }
  })
}

/**
 * Decompresses the provided data using the `inflate` algorithm from the `pako` library.
 *
 * @param data - The data to be decompressed as a `Uint8Array`.
 * @param options - The decompression options.
 * @returns A promise that resolves to the decompressed data, either as a string (if the decompressed data is text) or as a `Uint8Array`.
 * @throws If the decompression fails, the promise is rejected with an error.
 *
 * @see {@link https://github.com/nodeca/pako#inflate}
 */
export async function decompressor(data: Uint8Array, options: DecompressOptions = {}): Promise<string> {
  const { ...inflateOptions } = options

  return new Promise((resolve, reject) => {
    try {
      const decompressedData = inflate(data, inflateOptions)

      const textDecoder = new TextDecoder("utf-8")
      const decodedData = textDecoder.decode(decompressedData)

      resolve(decodedData)
    }
    catch (error) {
      reject(error)
    }
  })
}

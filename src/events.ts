import type { Entry } from "./analyzer"
import type { GeneratorFile } from "./generator"

/**
 * Defines the structure of different event types.
 */
export interface EventTypes {
  /**
   * Triggered when analysis is completed.
   */
  analyzed: {
    /** A message describing the event. */
    message: string

    /** The analyzed entry data. */
    entry: Entry
  }

  /**
   * Triggered when a file is compressed or decompressed.
   */
  compression: {
    /** A message describing the event. */
    message: string

    /** The data after compression or decompression. */
    data: string | Uint8Array
  }

  /**
   * Triggered when a file is generated.
   */
  generator: {
    /** A message describing the event. */
    message: string

    /** The generated file. */
    file: GeneratorFile
  }

  /**
   * Triggered when files are loaded.
   */
  loaded: {
    /** A message describing the event. */
    message: string

    /** The number of files loaded. */
    files: number
  }

  /**
   * Triggered when an error occurs.
   */
  error: {
    /** A message describing the error. */
    message: string

    /** The error object, if available. */
    error?: unknown
  }

  /**
   * Triggered when a process is complete.
   */
  complete: {
    /** A message describing the event. */
    message: string

    /** The output result of the process. */
    output: string
  }
}

/**
 * Type representing a callback function for handling specific events.
 *
 * @template K - The key of the event type.
 */
export type EventCallback<K extends keyof EventTypes> = (data: EventTypes[K]) => void

/**
 * A simple event emitter to register and trigger event callbacks.
 */
export class EventEmitter {
  /**
   * Stores event listeners for different event types.
   */
  private events: { [K in keyof EventTypes]?: EventCallback<K>[] } = {}

  /**
   * Registers an event listener.
   *
   * @param event - The event name to listen for.
   * @param callback - The function to be called when the event is triggered.
   *
   * @template K - The key of the event type.
   */
  public on<K extends keyof EventTypes>(event: K, callback: EventCallback<K>): void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event]!.push(callback)
  }

  /**
   * Emits an event, triggering all registered listeners.
   *
   * @param event - The event name to emit.
   * @param data - The data associated with the event.
   *
   * @template K - The key of the event type.
   */
  public emit<K extends keyof EventTypes>(event: K, data: EventTypes[K]): void {
    if (this.events[event]) {
      this.events[event]!.forEach(callback => callback(data))
    }
  }
}

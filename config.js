/** Plugin configuration: the capture server's port, bounds, and listen address. */
import z from '@deepseek-ai/schemastery'

/** Validated plugin configuration received by the Host `apply`. */
export const Config = z.object({
  /** TCP port the phone capture server listens on; `0` picks a free port. */
  port: z.number().min(0).max(65535).default(8765),
  /** Listen address; `0.0.0.0` accepts the phone on the same network. */
  host: z.string().default('0.0.0.0'),
  /** Largest number of images one submission may carry. */
  maxImages: z.number().min(1).max(20).default(9),
  /** Largest number of characters one submission's text may carry. */
  maxTextChars: z.number().min(1).max(100000).default(8000),
  /** Largest accepted request body in bytes. */
  maxUploadBytes: z.number().min(1024).default(32 * 1024 * 1024),
})

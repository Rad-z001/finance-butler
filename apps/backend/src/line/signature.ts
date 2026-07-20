import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates the `x-line-signature` header: HMAC-SHA256 of the RAW request body
 * with the channel secret, base64-encoded. Must run before any JSON parsing.
 */
export function verifyLineSignature(
  channelSecret: string,
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

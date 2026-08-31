import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await deriveKey(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, salt, expectedHex, unexpected] = encodedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !expectedHex || unexpected) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = (await deriveKey(password, salt, KEY_LENGTH)) as Buffer;

  return timingSafeEqual(actual, expected);
}

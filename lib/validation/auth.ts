export const SETUP_SECRET_HEX_LENGTH = 64;

/** Validates the deployment format; cryptographic randomness remains an operator responsibility. */
export function isHighEntropySetupSecret(secret: string): boolean {
  return new RegExp(`^[0-9a-fA-F]{${SETUP_SECRET_HEX_LENGTH}}$`).test(secret);
}

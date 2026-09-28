import { createHash } from 'crypto';

export function sha256Checksum(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

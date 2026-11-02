/**
 * Verifies file authenticity using magic bytes / binary signatures.
 * Prevents disguised files and malicious uploads.
 */

export type AllowedDocType = 'pdf' | 'docx' | 'png' | 'jpeg';

export function detectFileType(buffer: Buffer): AllowedDocType | null {
  if (buffer.length < 4) return null;

  // 1. PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // 2. PNG: \x89PNG\r\n\x1a\n (0x89, 0x50, 0x4E, 0x47)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  // 3. JPEG: \xFF\xD8\xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // 4. DOCX / ZIP: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'docx';
  }

  return null;
}

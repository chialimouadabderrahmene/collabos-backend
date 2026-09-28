export interface SniffedFile {
  mimeType:
    'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';
  extension: 'jpg' | 'png' | 'webp' | 'gif' | 'pdf';
  width: number | null;
  height: number | null;
}

/** Largest accepted image edge, a guard against decompression bombs. */
export const MAX_IMAGE_DIMENSION = 20_000;

/**
 * Identifies a file from its magic bytes (never from the client-declared
 * MIME type or filename) and reads image dimensions from the header.
 * Returns null for anything unrecognised or malformed. SVG is deliberately
 * unsupported (it can carry script).
 */
export function sniffFile(buffer: Buffer): SniffedFile | null {
  if (isPng(buffer)) {
    return withDimensions('image/png', 'png', readPngSize(buffer));
  }
  if (isJpeg(buffer)) {
    return withDimensions('image/jpeg', 'jpg', readJpegSize(buffer));
  }
  if (isGif(buffer)) {
    return withDimensions('image/gif', 'gif', readGifSize(buffer));
  }
  if (isWebp(buffer)) {
    return withDimensions('image/webp', 'webp', readWebpSize(buffer));
  }
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('latin1') === '%PDF-'
  ) {
    return {
      mimeType: 'application/pdf',
      extension: 'pdf',
      width: null,
      height: null,
    };
  }
  return null;
}

type Size = { width: number; height: number } | null;

function withDimensions(
  mimeType: SniffedFile['mimeType'],
  extension: SniffedFile['extension'],
  size: Size,
): SniffedFile | null {
  if (
    !size ||
    size.width < 1 ||
    size.height < 1 ||
    size.width > MAX_IMAGE_DIMENSION ||
    size.height > MAX_IMAGE_DIMENSION
  ) {
    return null;
  }
  return { mimeType, extension, width: size.width, height: size.height };
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isPng(buffer: Buffer): boolean {
  return buffer.length >= 24 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function readPngSize(buffer: Buffer): Size {
  if (buffer.subarray(12, 16).toString('latin1') !== 'IHDR') {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

/** Walks JPEG segments until a Start-Of-Frame marker (SOF0-SOF15 except
 * DHT/JPG/DAC) and reads its height/width. */
function readJpegSize(buffer: Buffer): Size {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      return null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function isGif(buffer: Buffer): boolean {
  const header = buffer.subarray(0, 6).toString('latin1');
  return buffer.length >= 10 && (header === 'GIF87a' || header === 'GIF89a');
}

function readGifSize(buffer: Buffer): Size {
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 30 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  );
}

function readWebpSize(buffer: Buffer): Size {
  const chunk = buffer.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  return null;
}

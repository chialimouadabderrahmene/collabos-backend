import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_DIMENSION, sniffFile } from './file-signature.util';

/** Minimal valid PNG header (signature + IHDR) with the given size. */
function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegHeader(width: number, height: number): Buffer {
  return Buffer.from([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    0x10, // APP0, length 16
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08, // SOF0, length 17, precision 8
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ]);
}

function gifHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(13);
  buffer.write('GIF89a', 0, 'latin1');
  buffer.writeUInt16LE(width, 6);
  buffer.writeUInt16LE(height, 8);
  return buffer;
}

function webpVp8xHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'latin1');
  buffer.writeUInt32LE(22, 4);
  buffer.write('WEBP', 8, 'latin1');
  buffer.write('VP8X', 12, 'latin1');
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe('sniffFile', () => {
  it('detects PNG and reads its dimensions', () => {
    expect(sniffFile(pngHeader(1200, 800))).toEqual({
      mimeType: 'image/png',
      extension: 'png',
      width: 1200,
      height: 800,
    });
  });

  it('detects JPEG and reads its dimensions from the SOF marker', () => {
    expect(sniffFile(jpegHeader(640, 480))).toMatchObject({
      mimeType: 'image/jpeg',
      width: 640,
      height: 480,
    });
  });

  it('detects GIF', () => {
    expect(sniffFile(gifHeader(32, 16))).toMatchObject({
      mimeType: 'image/gif',
      width: 32,
      height: 16,
    });
  });

  it('detects WEBP (VP8X)', () => {
    expect(sniffFile(webpVp8xHeader(2000, 3000))).toMatchObject({
      mimeType: 'image/webp',
      width: 2000,
      height: 3000,
    });
  });

  it('detects PDF without dimensions', () => {
    expect(sniffFile(Buffer.from('%PDF-1.7\n...'))).toEqual({
      mimeType: 'application/pdf',
      extension: 'pdf',
      width: null,
      height: null,
    });
  });

  it('rejects SVG (can carry script)', () => {
    expect(
      sniffFile(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      ),
    ).toBeNull();
  });

  it('rejects HTML disguised with an image extension', () => {
    expect(
      sniffFile(Buffer.from('<html><script>alert(1)</script></html>')),
    ).toBeNull();
  });

  it('rejects decompression-bomb dimensions', () => {
    expect(sniffFile(pngHeader(MAX_IMAGE_DIMENSION + 1, 10))).toBeNull();
  });

  it('rejects a truncated/malformed image', () => {
    expect(sniffFile(pngHeader(10, 10).subarray(0, 12))).toBeNull();
  });
});

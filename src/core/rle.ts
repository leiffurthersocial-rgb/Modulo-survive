/**
 * Run-length codec for chunk layers. Chunks are mostly long runs (air, stone),
 * so RLE typically shrinks a 1024-entry layer to a few dozen pairs. The encoded
 * form is a Uint16Array of [runLength, value] pairs — structured-clone friendly
 * for IndexedDB and postMessage, and the future network chunk format.
 */

export function rleEncode(data: Uint16Array | Uint8Array): Uint16Array {
  const out: number[] = [];
  const n = data.length;
  let i = 0;
  while (i < n) {
    const v = data[i];
    let run = 1;
    while (i + run < n && data[i + run] === v && run < 65535) run++;
    out.push(run, v);
    i += run;
  }
  return Uint16Array.from(out);
}

export function rleDecode16(encoded: Uint16Array, expectedLength: number): Uint16Array {
  const out = new Uint16Array(expectedLength);
  let o = 0;
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    const run = encoded[i];
    const v = encoded[i + 1];
    out.fill(v, o, Math.min(o + run, expectedLength));
    o += run;
  }
  if (o !== expectedLength) {
    throw new Error(`RLE decode length mismatch: got ${o}, expected ${expectedLength}`);
  }
  return out;
}

export function rleDecode8(encoded: Uint16Array, expectedLength: number): Uint8Array {
  const out = new Uint8Array(expectedLength);
  let o = 0;
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    const run = encoded[i];
    const v = encoded[i + 1];
    out.fill(v, o, Math.min(o + run, expectedLength));
    o += run;
  }
  if (o !== expectedLength) {
    throw new Error(`RLE decode length mismatch: got ${o}, expected ${expectedLength}`);
  }
  return out;
}

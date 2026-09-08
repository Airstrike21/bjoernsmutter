const encoder = new TextEncoder();

export async function onRequestPost({ request, env }) {
  if (!env.BUCKET) return text('R2-Binding BUCKET fehlt.', 500);

  const form = await request.formData();
  const mode = String(form.get('mode') || 'selected');
  const adminPassword = String(form.get('admin') || '');
  const expected = env.ADMIN_PASSWORD || '';
  const isAdmin = expected.length > 0 && adminPassword === expected;

  let keys = [];
  if (mode === 'all-approved') {
    keys = await listKeys(env.BUCKET, 'approved/');
  } else if (mode === 'all-uploads') {
    if (!isAdmin) return text('Nicht erlaubt.', 401);
    keys = await listKeys(env.BUCKET, 'uploads/');
  } else if (mode === 'all-everything') {
    if (!isAdmin) return text('Nicht erlaubt.', 401);
    const [uploads, approved] = await Promise.all([
      listKeys(env.BUCKET, 'uploads/'),
      listKeys(env.BUCKET, 'approved/')
    ]);
    keys = [...uploads, ...approved];
  } else {
    try {
      keys = JSON.parse(String(form.get('keys') || '[]'));
    } catch {
      return text('Ungültige Auswahl.', 400);
    }
    if (!Array.isArray(keys)) return text('Ungültige Auswahl.', 400);
    keys = [...new Set(keys.map(String))];

    if (isAdmin) {
      keys = keys.filter(validKey);
    } else {
      keys = keys.filter(key => key.startsWith('approved/'));
    }
  }

  if (keys.length === 0) return text('Keine Bilder ausgewählt.', 400);
  if (keys.length > 10000) return text('Zu viele Bilder für einen einzelnen Download.', 400);

  const objects = [];
  for (let i = 0; i < keys.length; i++) {
    const object = await env.BUCKET.get(keys[i]);
    if (!object) continue;
    const original = object.customMetadata?.originalFilename || keys[i].split('/').pop() || `bild-${i + 1}`;
    objects.push({
      object,
      key: keys[i],
      filename: `${String(i + 1).padStart(4, '0')}_${sanitizeFilename(original)}`
    });
  }

  if (objects.length === 0) return text('Keine Bilder gefunden.', 404);

  const stream = createZipStream(objects);
  const suffix = mode === 'all-approved' ? 'galerie' : mode === 'all-uploads' ? 'uploads' : mode === 'all-everything' ? 'alle' : 'auswahl';

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="hochzeitsbilder-${suffix}.zip"`,
      'Cache-Control': 'no-store'
    }
  });
}

async function listKeys(bucket, prefix) {
  let cursor;
  const keys = [];
  do {
    const result = await bucket.list({ prefix, cursor, limit: 1000 });
    keys.push(...result.objects.map(object => object.key));
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  return keys;
}

function createZipStream(entries) {
  return new ReadableStream({
    async start(controller) {
      const central = [];
      let offset = 0n;
      try {
        for (const entry of entries) {
          const nameBytes = encoder.encode(entry.filename);
          const localOffset = offset;
          const localHeader = localFileHeader(nameBytes);
          controller.enqueue(localHeader);
          offset += BigInt(localHeader.byteLength);

          let crc = 0xffffffff;
          let size = 0n;
          const reader = entry.object.body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;
            crc = crc32Update(crc, value);
            size += BigInt(value.byteLength);
            controller.enqueue(value);
            offset += BigInt(value.byteLength);
          }
          crc = (crc ^ 0xffffffff) >>> 0;

          if (size >= 0xffffffffn) throw new Error('Ein einzelnes Bild ist zu groß für den ZIP-Export.');

          const descriptor = dataDescriptor(crc, Number(size));
          controller.enqueue(descriptor);
          offset += BigInt(descriptor.byteLength);
          central.push({ nameBytes, crc, size, localOffset });
        }

        const centralStart = offset;
        for (const entry of central) {
          const header = centralDirectoryHeader(entry);
          controller.enqueue(header);
          offset += BigInt(header.byteLength);
        }
        const centralSize = offset - centralStart;

        const needsZip64 = central.length >= 0xffff || centralStart >= 0xffffffffn || centralSize >= 0xffffffffn;
        if (needsZip64) {
          const zip64Offset = offset;
          const z64 = zip64End(central.length, centralSize, centralStart);
          controller.enqueue(z64);
          offset += BigInt(z64.byteLength);
          const locator = zip64Locator(zip64Offset);
          controller.enqueue(locator);
          offset += BigInt(locator.byteLength);
        }

        controller.enqueue(endOfCentralDirectory(central.length, centralSize, centralStart, needsZip64));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

function localFileHeader(nameBytes) {
  const b = new Uint8Array(30 + nameBytes.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 0x0808, true); // UTF-8 + data descriptor
  v.setUint16(8, 0, true);      // STORE (no compression)
  v.setUint16(10, 0, true);
  v.setUint16(12, 0, true);
  v.setUint32(14, 0, true);
  v.setUint32(18, 0, true);
  v.setUint32(22, 0, true);
  v.setUint16(26, nameBytes.length, true);
  v.setUint16(28, 0, true);
  b.set(nameBytes, 30);
  return b;
}

function dataDescriptor(crc, size) {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, size, true);
  v.setUint32(12, size, true);
  return b;
}

function centralDirectoryHeader(entry) {
  const needsOffset64 = entry.localOffset >= 0xffffffffn;
  const extra = needsOffset64 ? zip64ExtraOffset(entry.localOffset) : new Uint8Array(0);
  const b = new Uint8Array(46 + entry.nameBytes.length + extra.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 45, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0x0808, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, 0, true);
  v.setUint16(14, 0, true);
  v.setUint32(16, entry.crc, true);
  v.setUint32(20, Number(entry.size), true);
  v.setUint32(24, Number(entry.size), true);
  v.setUint16(28, entry.nameBytes.length, true);
  v.setUint16(30, extra.length, true);
  v.setUint16(32, 0, true);
  v.setUint16(34, 0, true);
  v.setUint16(36, 0, true);
  v.setUint32(38, 0, true);
  v.setUint32(42, needsOffset64 ? 0xffffffff : Number(entry.localOffset), true);
  b.set(entry.nameBytes, 46);
  b.set(extra, 46 + entry.nameBytes.length);
  return b;
}

function zip64ExtraOffset(offset) {
  const b = new Uint8Array(12);
  const v = new DataView(b.buffer);
  v.setUint16(0, 0x0001, true);
  v.setUint16(2, 8, true);
  setUint64(v, 4, offset);
  return b;
}

function zip64End(count, centralSize, centralStart) {
  const b = new Uint8Array(56);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06064b50, true);
  setUint64(v, 4, 44n);
  v.setUint16(12, 45, true);
  v.setUint16(14, 45, true);
  v.setUint32(16, 0, true);
  v.setUint32(20, 0, true);
  setUint64(v, 24, BigInt(count));
  setUint64(v, 32, BigInt(count));
  setUint64(v, 40, centralSize);
  setUint64(v, 48, centralStart);
  return b;
}

function zip64Locator(zip64Offset) {
  const b = new Uint8Array(20);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x07064b50, true);
  v.setUint32(4, 0, true);
  setUint64(v, 8, zip64Offset);
  v.setUint32(16, 1, true);
  return b;
}

function endOfCentralDirectory(count, centralSize, centralStart, zip64) {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(4, 0, true);
  v.setUint16(6, 0, true);
  v.setUint16(8, zip64 ? 0xffff : count, true);
  v.setUint16(10, zip64 ? 0xffff : count, true);
  v.setUint32(12, zip64 ? 0xffffffff : Number(centralSize), true);
  v.setUint32(16, zip64 ? 0xffffffff : Number(centralStart), true);
  v.setUint16(20, 0, true);
  return b;
}

function setUint64(view, offset, value) {
  view.setUint32(offset, Number(value & 0xffffffffn), true);
  view.setUint32(offset + 4, Number((value >> 32n) & 0xffffffffn), true);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc, bytes) {
  let c = crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c >>> 0;
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .trim() || 'bild';
}

function validKey(key) {
  return key.startsWith('uploads/') || key.startsWith('approved/');
}

function text(message, status = 200) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

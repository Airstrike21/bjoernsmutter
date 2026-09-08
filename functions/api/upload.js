const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  try {
    if (!env.BUCKET) {
      return json({ error: "R2-Binding BUCKET fehlt." }, 500);
    }

    const form = await request.formData();
    const photo = form.get("photo");
    const guestName = cleanText(form.get("guestName") || "Gast", 60);
    if (!(photo instanceof File)) {
      return json({ error: "Es wurde kein Bild übertragen." }, 400);
    }

    if (!ALLOWED_TYPES.has(photo.type)) {
      return json({ error: "Dieser Bildtyp wird nicht unterstützt." }, 415);
    }

    if (photo.size <= 0 || photo.size > MAX_FILE_SIZE) {
      return json({ error: "Das Bild ist leer oder größer als 20 MB." }, 413);
    }

    const extension = extensionFor(photo.type);
    const now = new Date();
    const datePath = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const filename = `${timestamp}_${slug(guestName)}_${crypto.randomUUID().slice(0, 8)}.${extension}`;
    const objectKey = `uploads/${datePath}/${filename}`;

    await env.BUCKET.put(objectKey, photo.stream(), {
      httpMetadata: {
        contentType: photo.type,
        cacheControl: "private, max-age=0"
      },
      customMetadata: {
        guestName,
        originalFilename: cleanText(photo.name || "unbekannt", 180),
        uploadedAt: now.toISOString()
      }
    });

    return json({ ok: true, filename, objectKey, size: photo.size }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: "Beim Upload ist ein unerwarteter Fehler aufgetreten." }, 500);
  }
}

function extensionFor(type) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif"
  })[type];
}

function cleanText(value, maxLength) {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength) || "Gast";
}

function slug(value) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "Gast";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

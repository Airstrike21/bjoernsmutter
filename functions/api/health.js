export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    storage: env.BUCKET ? "r2" : "missing",
    bucketConnected: Boolean(env.BUCKET)
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

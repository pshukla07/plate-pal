const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL =
  "https://aurmaliya.app.n8n.cloud/webhook/924f15cc-176e-4ec9-aca0-57fd333fc050";

// Convert base64 data URL -> Blob (Deno-compatible)
function dataUrlToBlob(dataUrl: string): { blob: Blob; filename: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data URL");
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.split("/")[1]?.split("+")[0] ?? "jpg";
  return { blob: new Blob([bytes], { type: mime }), filename: `meal.${ext}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'image' (data URL) in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { blob, filename } = dataUrlToBlob(image);

    const form = new FormData();
    form.append("data", blob, filename);
    form.append("file", blob, filename);
    form.append("image", blob, filename);

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: form,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Webhook error [${response.status}]: ${text}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Webhook returned non-JSON response: ${text.slice(0, 500)}`);
    }

    // Normalize: webhook returns either an array [{ output: {...} }] or a single object
    let output: any = parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
      output = (parsed[0] as any)?.output ?? parsed[0];
    } else if ((parsed as any)?.output) {
      output = (parsed as any).output;
    }

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("analyze-meal error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

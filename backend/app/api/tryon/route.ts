import { NextRequest, NextResponse } from "next/server";

const FASHN_API = "https://api.fashn.ai/v1";

export async function POST(req: NextRequest) {
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FASHN_API_KEY not set on the server." }, { status: 500 });
  }

  let body: {
    humanImage: string;
    garmentImage: string;
    category?: string;
    garmentDescription?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { humanImage, garmentImage, category = "auto" } = body;

  if (!humanImage || !garmentImage) {
    return NextResponse.json({ error: "humanImage and garmentImage are required." }, { status: 400 });
  }

  // Start prediction
  const runRes = await fetch(`${FASHN_API}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: "tryon-max",
      inputs: {
        model_image: humanImage,
        garment_image: garmentImage,
        category,
        segmentation_free: true,
        garment_photo_type: "auto",
        output_format: "png",
        return_base64: false,
      },
    }),
  });

  if (!runRes.ok) {
    const err = await runRes.text();
    return NextResponse.json({ error: `Failed to start try-on: ${err}` }, { status: 502 });
  }

  const { id, error: runError } = await runRes.json();
  if (runError || !id) {
    return NextResponse.json({ error: runError || "No prediction ID returned." }, { status: 502 });
  }

  // Poll for result (max ~90s)
  for (let i = 0; i < 45; i++) {
    await sleep(2000);

    const statusRes = await fetch(`${FASHN_API}/status/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) continue;

    const poll = await statusRes.json();

    if (poll.status === "completed") {
      const output = Array.isArray(poll.output) ? poll.output[0] : poll.output;
      return NextResponse.json({ output });
    }

    if (poll.status === "failed" || poll.status === "canceled") {
      return NextResponse.json(
        { error: `Try-on ${poll.status}: ${poll.error || "Unknown error"}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "Timed out waiting for result. Try again." }, { status: 504 });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

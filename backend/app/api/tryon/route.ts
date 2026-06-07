import { NextRequest, NextResponse } from "next/server";

const REPLICATE_API = "https://api.replicate.com/v1/predictions";
// IDM-VTON model version
const MODEL_VERSION = "906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f";

export async function POST(req: NextRequest) {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "REPLICATE_API_KEY not set" }, { status: 500 });
  }

  let body: { humanImage: string; garmentImage: string; garmentDescription?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { humanImage, garmentImage, garmentDescription = "" } = body;
  if (!humanImage || !garmentImage) {
    return NextResponse.json({ error: "humanImage and garmentImage are required" }, { status: 400 });
  }

  // Start prediction
  const createRes = await fetch(REPLICATE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      version: MODEL_VERSION,
      input: {
        human_img: humanImage,
        garm_img: garmentImage,
        garment_des: garmentDescription,
        is_checked: true,
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    return NextResponse.json({ error: `Replicate error: ${err}` }, { status: 502 });
  }

  const prediction = await createRes.json();

  // If Prefer: wait already resolved it
  if (prediction.status === "succeeded") {
    return NextResponse.json({ output: prediction.output });
  }

  // Otherwise poll
  const predictionUrl = prediction.urls?.get;
  if (!predictionUrl) {
    return NextResponse.json({ error: "No polling URL returned" }, { status: 502 });
  }

  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const pollRes = await fetch(predictionUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const poll = await pollRes.json();

    if (poll.status === "succeeded") {
      return NextResponse.json({ output: poll.output });
    }
    if (poll.status === "failed" || poll.status === "canceled") {
      return NextResponse.json({ error: `Prediction ${poll.status}: ${poll.error}` }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Timed out waiting for prediction" }, { status: 504 });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

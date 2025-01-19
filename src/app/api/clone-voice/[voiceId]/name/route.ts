// app/api/clone-voice/[voiceId]/name/route.ts
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { voiceId: string } }
) {
  try {
    const body = await request.json();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/voices/${params.voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: body.name }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to rename voice");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to rename voice" },
      { status: 500 }
    );
  }
}

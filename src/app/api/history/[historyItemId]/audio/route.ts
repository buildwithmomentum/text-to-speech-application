// app/api/history/[historyItemId]/audio/route.ts
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { historyItemId: string } }
) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/history/${params.historyItemId}/audio`,
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch audio");
    }

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="tts-${params.historyItemId}.mp3"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch audio" },
      { status: 500 }
    );
  }
}

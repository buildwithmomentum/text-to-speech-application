// app/api/clone-voice/[voiceId]/route.ts
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: { voiceId: string } }
) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/voices/${params.voiceId}`,
      {
        method: "DELETE",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete voice");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete voice" },
      { status: 500 }
    );
  }
}

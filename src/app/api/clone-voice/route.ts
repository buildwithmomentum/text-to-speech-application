// app/api/clone-voice/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const name = formData.get("name") as string;

    if (!files || files.length === 0 || !name) {
      return NextResponse.json(
        { error: "You must upload at least one audio sample." },
        { status: 400 }
      );
    }

    // Create a new FormData instance for the ElevenLabs API
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append("name", name);

    // Append each file with the correct field name for ElevenLabs
    files.forEach((file) => {
      elevenLabsFormData.append("files", file);
    });

    // Call ElevenLabs API
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        Accept: "application/json",
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail?.message || "Failed to clone voice" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Ensure we have a voice ID
    if (!data.voice_id) {
      return NextResponse.json(
        { error: "Invalid response from ElevenLabs API" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      voice_id: data.voice_id,
      success: true,
      message: "Voice cloned successfully",
    });
  } catch (error: any) {
    console.error("Voice cloning error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clone voice" },
      { status: 500 }
    );
  }
}

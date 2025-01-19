// app/api/history/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/history", {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch history");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}




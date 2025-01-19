// app/api/history/[historyItemId]/route.ts
import { NextResponse } from "next/server";

export async function DELETE(
	request: Request,
	{ params }: { params: { historyItemId: string } }
) {
	try {
		const response = await fetch(
			`https://api.elevenlabs.io/v1/history/${params.historyItemId}`,
			{
				method: "DELETE",
				headers: {
					"xi-api-key": process.env.ELEVENLABS_API_KEY || "",
				},
			}
		);

		if (!response.ok) {
			throw new Error("Failed to delete history item");
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to delete history item" },
			{ status: 500 }
		);
	}
}
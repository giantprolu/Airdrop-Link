import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "fileName and fileType are required" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    // Generate unique filename with robust extension extraction
    let ext = "bin";
    try {
      const nameParts = fileName.split(".");
      if (nameParts.length > 1) {
        const rawExt = nameParts.pop() || "bin";
        ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      }
      if (!ext || ext === "bin") {
        const mimeExt = fileType.split("/").pop()?.replace(/[^a-z0-9]/g, "");
        if (mimeExt) ext = mimeExt;
      }
    } catch {
      ext = "bin";
    }

    const uniqueId = randomUUID();
    const filename = `${uniqueId}.${ext}`;
    const filePath = `${userId}/${filename}`;

    // Create signed upload URL (valid for 5 minutes)
    const { data, error } = await supabaseAdmin.storage
      .from("files")
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Error creating signed URL:", error);
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      filePath,
      fileName: filename,
    });
  } catch (error) {
    console.error("Upload URL error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

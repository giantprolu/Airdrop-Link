import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { filePath, fileName, fileType, fileSize, description } = body;

    if (!filePath || !fileName || !fileType || fileSize === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify that the file path belongs to the user
    if (!filePath.startsWith(`${userId}/`)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    // Verify the file exists in storage
    const { data: fileData, error: storageError } = await supabaseAdmin.storage
      .from("files")
      .list(userId, {
        search: filePath.replace(`${userId}/`, ""),
      });

    if (storageError || !fileData || fileData.length === 0) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      );
    }

    // Insert record in files table
    const { data: fileRecord, error: dbError } = await supabaseAdmin
      .from("files")
      .insert({
        user_id: userId,
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        description: description || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to save file metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({ file: fileRecord });
  } catch (error) {
    console.error("Register file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

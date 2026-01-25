import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const description = formData.get("description") as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedFiles = [];
    const errors = [];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 50MB)`);
        continue;
      }

      // Generate unique filename
      const ext = file.name.split(".").pop() || "bin";
      const uniqueId = crypto.randomUUID();
      const filename = `${uniqueId}.${ext}`;
      const filePath = `${userId}/${filename}`;

      try {
        // Upload to Supabase Storage
        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await supabaseAdmin.storage
          .from("files")
          .upload(filePath, arrayBuffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          errors.push(`${file.name}: Upload failed`);
          continue;
        }

        // Insert record in files table
        const { data: fileRecord, error: dbError } = await supabaseAdmin
          .from("files")
          .insert({
            user_id: userId,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type || "application/octet-stream",
            file_size: file.size,
            description: description || null,
          })
          .select()
          .single();

        if (dbError) {
          console.error("Database error:", dbError);
          // Clean up uploaded file
          await supabaseAdmin.storage.from("files").remove([filePath]);
          errors.push(`${file.name}: Failed to save metadata`);
          continue;
        }

        uploadedFiles.push(fileRecord);
      } catch (err) {
        console.error("File upload error:", err);
        errors.push(`${file.name}: Upload failed`);
      }
    }

    return NextResponse.json({
      success: uploadedFiles.length > 0,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's files
    const { data: files, error } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch files" },
        { status: 500 }
      );
    }

    // Generate signed URLs for each file
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const { data } = await supabaseAdmin.storage
          .from("files")
          .createSignedUrl(file.file_path, 3600); // 1 hour expiry

        return {
          ...file,
          url: data?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ files: filesWithUrls });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    // Get file to verify ownership and get file path
    const { data: file, error: fetchError } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from storage
    await supabaseAdmin.storage.from("files").remove([file.file_path]);

    // Delete from database
    await supabaseAdmin.from("files").delete().eq("id", fileId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

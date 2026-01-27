import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

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

      // Generate unique filename with robust extension extraction
      let ext = "bin";
      try {
        const nameParts = file.name.split(".");
        if (nameParts.length > 1) {
          const rawExt = nameParts.pop() || "bin";
          // Sanitize extension: only allow alphanumeric chars
          ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        }
        // Fallback based on MIME type if extension is invalid
        if (!ext || ext === "bin") {
          const mimeExt = file.type.split("/").pop()?.replace(/[^a-z0-9]/g, "");
          if (mimeExt) ext = mimeExt;
        }
      } catch {
        ext = "bin";
      }
      const uniqueId = randomUUID();
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

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_favorite, tags, generate_share_link, remove_share_link } = body;

    if (!id) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    // Verify ownership
    const { data: file, error: fetchError } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof is_favorite === "boolean") {
      updates.is_favorite = is_favorite;
    }

    if (Array.isArray(tags)) {
      updates.tags = tags;
    }

    if (generate_share_link) {
      updates.share_token = randomUUID();
    }

    if (remove_share_link) {
      updates.share_token = null;
    }

    const { data: updatedFile, error: updateError } = await supabaseAdmin
      .from("files")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
    }

    return NextResponse.json({ file: updatedFile });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

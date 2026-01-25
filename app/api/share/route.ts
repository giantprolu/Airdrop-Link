import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Share token required" }, { status: 400 });
    }

    // Find file by share token
    const { data: file, error } = await supabaseAdmin
      .from("files")
      .select("id, file_name, file_type, file_size, description, file_path, created_at")
      .eq("share_token", token)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found or not shared" }, { status: 404 });
    }

    // Generate signed URL for download
    const { data: urlData } = await supabaseAdmin.storage
      .from("files")
      .createSignedUrl(file.file_path, 3600);

    return NextResponse.json({
      file: {
        id: file.id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_size: file.file_size,
        description: file.description,
        created_at: file.created_at,
        url: urlData?.signedUrl || null,
      },
    });
  } catch (error) {
    console.error("Share fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

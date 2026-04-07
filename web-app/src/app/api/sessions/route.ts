import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/sessions — load saved session history
export async function GET() {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, title, style, sub_type, document, messages, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// POST /api/sessions — upsert a session (save or update)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, title, style, subType, document, messages } = body;

  if (!id || !style || !subType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabase.from("sessions").upsert({
    id,
    title: title ?? "Bài viết mới",
    style,
    sub_type: subType,
    document: document ?? "",
    messages: messages ?? [],
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

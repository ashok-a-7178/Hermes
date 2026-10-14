import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId, isProjectMember, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const before = new URL(request.url).searchParams.get("before");
  const messages = await prisma.message.findMany({
    where: { projectId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  return NextResponse.json(messages.reverse());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const input = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Message must contain 1–4000 characters." }, { status: 400 });

  const message = await prisma.message.create({
    data: { projectId, authorId: userId, body: input.data.body },
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json(message, { status: 201 });
}

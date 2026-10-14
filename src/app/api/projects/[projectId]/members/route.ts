import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;

  const inviter = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!inviter || (inviter.role !== "OWNER" && inviter.role !== "ADMIN")) {
    return NextResponse.json({ error: "Only project owners and admins can add teammates." }, { status: 403 });
  }

  const input = z.object({ email: z.string().trim().email().max(254) }).safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Enter a valid teammate email." }, { status: 400 });
  const teammate = await prisma.user.findUnique({
    where: { email: input.data.email.toLowerCase() },
    select: { id: true },
  });
  if (!teammate) return NextResponse.json({ error: "No account found for that email. Ask them to create a Hermes account first." }, { status: 404 });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: teammate.id } },
    create: { projectId, userId: teammate.id, role: "MEMBER" },
    update: {},
  });
  return NextResponse.json({ success: true }, { status: 200 });
}

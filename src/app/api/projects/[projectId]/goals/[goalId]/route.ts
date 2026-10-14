import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId, isProjectMember, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; goalId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId, goalId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  const input = z.object({ complete: z.boolean() }).safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Invalid goal update." }, { status: 400 });
  const result = await prisma.monthlyGoal.updateMany({
    where: { id: goalId, projectId },
    data: { complete: input.data.complete },
  });
  if (!result.count) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

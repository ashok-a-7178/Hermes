import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId, isProjectMember, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const goals = await prisma.monthlyGoal.findMany({ where: { projectId }, orderBy: { month: "desc" } });
  return NextResponse.json(goals);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const input = z.object({
    title: z.string().trim().min(2).max(160),
    details: z.string().trim().max(2000).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).refine((value) => {
      const month = Number(value.slice(5));
      return month >= 1 && month <= 12;
    }),
  }).safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Enter a goal, details, and valid month." }, { status: 400 });

  const [year, month] = input.data.month.split("-").map(Number);
  const goal = await prisma.monthlyGoal.create({
    data: { projectId, title: input.data.title, details: input.data.details ?? "", month: new Date(Date.UTC(year, month - 1, 1)) },
  });
  return NextResponse.json(goal, { status: 201 });
}

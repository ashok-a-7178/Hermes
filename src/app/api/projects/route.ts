import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      _count: { select: { workItems: true, members: true } },
      goals: { where: { complete: false }, orderBy: { month: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const input = projectSchema.safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Project name must be 2–80 characters." }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      name: input.data.name,
      description: input.data.description ?? "",
      members: { create: { userId, role: "OWNER" } },
    },
  });
  return NextResponse.json(project, { status: 201 });
}

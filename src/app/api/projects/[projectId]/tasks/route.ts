import { NextResponse } from "next/server";
import { WorkPriority, WorkStatus, WorkType } from "@prisma/client";
import { z } from "zod";
import { currentUserId, isProjectMember, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  type: z.nativeEnum(WorkType).default("TASK"),
  status: z.nativeEnum(WorkStatus).default("TODO"),
  priority: z.nativeEnum(WorkPriority).default("MEDIUM"),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const status = new URL(request.url).searchParams.get("status");
  if (status && status !== "ALL" && !Object.values(WorkStatus).includes(status as WorkStatus)) {
    return NextResponse.json({ error: "Invalid task status filter." }, { status: 400 });
  }
  const items = await prisma.workItem.findMany({
    where: {
      projectId,
      ...(status && status !== "ALL" ? { status: status as WorkStatus } : {}),
    },
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return NextResponse.json({ items, members: members.map(({ user }) => user) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const input = createSchema.safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Review the task details and try again." }, { status: 400 });
  if (input.data.assigneeId && !(await isProjectMember(projectId, input.data.assigneeId))) {
    return NextResponse.json({ error: "Assignee must be a member of this project." }, { status: 400 });
  }

  const item = await prisma.workItem.create({
    data: {
      title: input.data.title,
      description: input.data.description ?? "",
      type: input.data.type,
      status: input.data.status,
      priority: input.data.priority,
      dueDate: input.data.dueDate ? new Date(input.data.dueDate) : null,
      project: { connect: { id: projectId } },
      ...(input.data.assigneeId ? { assignee: { connect: { id: input.data.assigneeId } } } : {}),
      activities: {
        create: {
          action: "created",
          detail: input.data.title,
          project: { connect: { id: projectId } },
          actor: { connect: { id: userId } },
        },
      },
    },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(item, { status: 201 });
}

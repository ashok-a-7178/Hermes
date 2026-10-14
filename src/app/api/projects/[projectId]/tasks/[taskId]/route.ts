import { NextResponse } from "next/server";
import { WorkPriority, WorkStatus } from "@prisma/client";
import { z } from "zod";
import { currentUserId, isProjectMember, readJson, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.nativeEnum(WorkStatus).optional(),
  priority: z.nativeEnum(WorkPriority).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId, taskId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const input = updateSchema.safeParse(await readJson(request));
  if (!input.success || Object.keys(input.data ?? {}).length === 0) {
    return NextResponse.json({ error: "No valid task updates were provided." }, { status: 400 });
  }
  if (input.data.assigneeId && !(await isProjectMember(projectId, input.data.assigneeId))) {
    return NextResponse.json({ error: "Assignee must be a member of this project." }, { status: 400 });
  }

  const existing = await prisma.workItem.findFirst({ where: { id: taskId, projectId }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { dueDate, assigneeId, ...fields } = input.data;
  const updated = await prisma.workItem.update({
    where: { id: taskId },
    data: {
      ...fields,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(assigneeId !== undefined
        ? { assignee: assigneeId ? { connect: { id: assigneeId } } : { disconnect: true } }
        : {}),
      activities: {
        create: {
          project: { connect: { id: projectId } },
          actor: { connect: { id: userId } },
          action: input.data.status && input.data.status !== existing.status ? "changed status" : "updated",
          detail: input.data.status && input.data.status !== existing.status
            ? `${existing.status.replaceAll("_", " ")} → ${input.data.status.replaceAll("_", " ")}`
            : "",
        },
      },
    },
    include: { assignee: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

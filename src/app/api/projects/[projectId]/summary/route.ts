import { NextResponse } from "next/server";
import { currentUserId, isProjectMember, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [project, counts, overdue, contributors, activities, goals] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, description: true, color: true } }),
    prisma.workItem.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } }),
    prisma.workItem.count({
      where: { projectId, dueDate: { lt: now }, status: { not: "DONE" } },
    }),
    prisma.workItem.groupBy({
      by: ["assigneeId"],
      where: { projectId, updatedAt: { gte: monthStart } },
      _count: { _all: true },
      orderBy: { _count: { assigneeId: "desc" } },
      take: 5,
    }),
    prisma.activity.findMany({
      where: { projectId },
      include: { actor: { select: { id: true, name: true } }, workItem: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.monthlyGoal.findMany({
      where: { projectId },
      orderBy: { month: "desc" },
      take: 4,
    }),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const assigneeIds = contributors.map((item) => item.assigneeId).filter((id): id is string => Boolean(id));
  const people = await prisma.user.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, name: true },
  });
  return NextResponse.json({
    project,
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    overdue,
    contributors: contributors.map((row) => ({
      userId: row.assigneeId,
      name: people.find((person) => person.id === row.assigneeId)?.name ?? "Unassigned",
      count: row._count._all,
    })),
    activities,
    goals,
  });
}

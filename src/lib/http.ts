import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function currentUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function isProjectMember(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return Boolean(membership);
}

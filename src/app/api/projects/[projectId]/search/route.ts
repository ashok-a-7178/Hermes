import { NextResponse } from "next/server";
import { currentUserId, isProjectMember, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { projectId } = await params;
  if (!(await isProjectMember(projectId, userId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (query.length < 2) return NextResponse.json([]);
  const results = await prisma.$queryRaw<Array<{
    type: string;
    id: string;
    title: string;
    excerpt: string;
    score: number;
    createdAt: Date;
  }>>`
    SELECT type, id, title, excerpt, score, "createdAt"
    FROM (
      SELECT 'TASK'::text AS type, w.id, w.title,
        left(w.description, 220) AS excerpt,
        ts_rank_cd(
          to_tsvector('english', w.title || ' ' || w.description),
          websearch_to_tsquery('english', ${query})
        ) AS score, w."createdAt"
      FROM "WorkItem" w
      WHERE w."projectId" = ${projectId}
        AND to_tsvector('english', w.title || ' ' || w.description)
          @@ websearch_to_tsquery('english', ${query})
      UNION ALL
      SELECT 'CHAT'::text AS type, m.id, left(m.body, 120) AS title,
        left(m.body, 220) AS excerpt,
        ts_rank_cd(to_tsvector('english', m.body), websearch_to_tsquery('english', ${query})) AS score,
        m."createdAt"
      FROM "Message" m
      WHERE m."projectId" = ${projectId}
        AND to_tsvector('english', m.body) @@ websearch_to_tsquery('english', ${query})
      UNION ALL
      SELECT 'GOAL'::text AS type, g.id, g.title,
        left(g.details, 220) AS excerpt,
        ts_rank_cd(
          to_tsvector('english', g.title || ' ' || g.details),
          websearch_to_tsquery('english', ${query})
        ) AS score, g."createdAt"
      FROM "MonthlyGoal" g
      WHERE g."projectId" = ${projectId}
        AND to_tsvector('english', g.title || ' ' || g.details)
          @@ websearch_to_tsquery('english', ${query})
    ) matches
    ORDER BY score DESC, "createdAt" DESC
    LIMIT 30
  `;
  return NextResponse.json(results);
}

import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/http";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await readJson(request));
  if (!input.success) {
    return NextResponse.json({ error: "Enter a name, valid email, and password (10+ characters)." }, { status: 400 });
  }

  const email = input.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        name: input.data.name,
        email,
        passwordHash: await hash(input.data.password, 12),
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ id: user.id }, { status: 201 });
}

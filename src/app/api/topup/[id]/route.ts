import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  await prisma.topUp.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

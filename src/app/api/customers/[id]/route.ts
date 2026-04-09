import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()
  const { name, phone, email, notes } = body

  const customer = await prisma.customer.update({
    where: { id },
    data: { name, phone, email, notes },
  })

  return NextResponse.json(customer)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  await prisma.customer.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

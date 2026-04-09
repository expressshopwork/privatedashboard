import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''

  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { sales: true } },
    },
  })

  return NextResponse.json(customers)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, email, notes } = body

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const customer = await prisma.customer.create({
    data: { name, phone, email, notes },
  })

  return NextResponse.json(customer, { status: 201 })
}

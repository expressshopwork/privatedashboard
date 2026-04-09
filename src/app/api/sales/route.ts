import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')

  const sales = await prisma.sale.findMany({
    where: {
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { date: 'desc' },
    include: { customer: { select: { name: true } } },
  })

  return NextResponse.json(sales)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { customerId, type, quantity, unitPrice, totalAmount, pointsEarned, date, notes } = body

  if (!type || totalAmount === undefined) {
    return NextResponse.json({ error: 'Type and totalAmount are required' }, { status: 400 })
  }

  const sale = await prisma.sale.create({
    data: {
      customerId: customerId ? parseInt(customerId) : null,
      type,
      quantity: quantity !== null && quantity !== undefined && quantity !== '' ? parseFloat(quantity) : null,
      unitPrice: unitPrice !== null && unitPrice !== undefined && unitPrice !== '' ? parseFloat(unitPrice) : null,
      totalAmount: parseFloat(totalAmount),
      pointsEarned: pointsEarned !== null && pointsEarned !== undefined && pointsEarned !== '' ? parseFloat(pointsEarned) : null,
      date: date ? new Date(date) : new Date(),
      notes,
    },
    include: { customer: { select: { name: true } } },
  })

  return NextResponse.json(sale, { status: 201 })
}

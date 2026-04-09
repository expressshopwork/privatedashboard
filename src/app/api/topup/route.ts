import { NextRequest, NextResponse } from 'next/server'
import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const topups = await prisma.topUp.findMany({
    orderBy: { expireDate: 'asc' },
    include: { customer: { select: { name: true } } },
  })
  return NextResponse.json(topups)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { customerId, customerPhone, customerName, product, lastTopUpDate, paymentPeriod } = body

  const months = parseInt(paymentPeriod)
  if (isNaN(months) || months < 1) {
    return NextResponse.json({ error: 'paymentPeriod must be a positive integer' }, { status: 400 })
  }

  const last = new Date(lastTopUpDate)
  const expire = addMonths(last, months)

  const topup = await prisma.topUp.create({
    data: {
      customerId: customerId ? parseInt(customerId) : null,
      customerPhone,
      customerName,
      product,
      lastTopUpDate: last,
      paymentPeriod: parseInt(paymentPeriod),
      expireDate: expire,
    },
  })

  return NextResponse.json(topup, { status: 201 })
}

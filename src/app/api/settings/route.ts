import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  let settings = await prisma.kPISetting.findFirst()
  if (!settings) {
    settings = await prisma.kPISetting.create({
      data: {
        dailyUnitTarget: 0,
        dailyPointTarget: 0,
        monthlyRevenueTarget: 0,
        customerGrowthTarget: 0,
      },
    })
  }
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { dailyUnitTarget, dailyPointTarget, monthlyRevenueTarget, customerGrowthTarget } = body

  let settings = await prisma.kPISetting.findFirst()
  if (settings) {
    settings = await prisma.kPISetting.update({
      where: { id: settings.id },
      data: {
        dailyUnitTarget: parseFloat(dailyUnitTarget),
        dailyPointTarget: parseFloat(dailyPointTarget),
        monthlyRevenueTarget: parseFloat(monthlyRevenueTarget),
        customerGrowthTarget: parseFloat(customerGrowthTarget),
      },
    })
  } else {
    settings = await prisma.kPISetting.create({
      data: {
        dailyUnitTarget: parseFloat(dailyUnitTarget),
        dailyPointTarget: parseFloat(dailyPointTarget),
        monthlyRevenueTarget: parseFloat(monthlyRevenueTarget),
        customerGrowthTarget: parseFloat(customerGrowthTarget),
      },
    })
  }
  return NextResponse.json(settings)
}

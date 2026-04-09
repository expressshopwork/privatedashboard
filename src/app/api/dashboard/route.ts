import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      salesToday,
      revenueTodayAgg,
      totalCustomers,
      activeTopups,
      recentSales,
      expiringTopups,
      weeklySales,
    ] = await Promise.all([
      prisma.sale.count({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.sale.aggregate({
        where: { date: { gte: today, lt: tomorrow } },
        _sum: { totalAmount: true },
      }),
      prisma.customer.count(),
      prisma.topUp.count({ where: { expireDate: { gte: new Date() } } }),
      prisma.sale.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
      }),
      prisma.topUp.findMany({
        where: {
          expireDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { expireDate: 'asc' },
        take: 5,
      }),
      // Last 7 days sales grouped by day
      prisma.sale.findMany({
        where: {
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { date: true, type: true, totalAmount: true, quantity: true, pointsEarned: true },
      }),
    ])

    // Process weekly data
    const weeklyMap: Record<string, { date: string; units: number; points: number; revenue: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      weeklyMap[key] = { date: key, units: 0, points: 0, revenue: 0 }
    }
    for (const sale of weeklySales) {
      const key = sale.date.toISOString().split('T')[0]
      if (weeklyMap[key]) {
        weeklyMap[key].revenue += sale.totalAmount
        if (sale.type === 'unit') {
          weeklyMap[key].units += sale.quantity ?? 0
        } else {
          weeklyMap[key].points += sale.pointsEarned ?? 0
        }
      }
    }

    return NextResponse.json({
      kpis: {
        salesToday,
        revenueToday: revenueTodayAgg._sum.totalAmount ?? 0,
        totalCustomers,
        activeTopups,
      },
      recentSales,
      expiringTopups,
      weeklyData: Object.values(weeklyMap),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function PortfolioTrend({
  data,
}: {
  data: { day: string; iso: string; covers: number; bookings: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="cov" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c9a25a" stopOpacity={0.65} />
              <stop offset="95%" stopColor="#c9a25a" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--muted-foreground))" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
              background: "hsl(var(--card))",
            }}
          />
          <Area type="monotone" dataKey="covers" stroke="#c9a25a" fill="url(#cov)" strokeWidth={2} name="Coperti" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function aggregateByDate(signatures) {
  const map = {};
  for (const s of signatures) {
    const d = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    map[d] = (map[d] || 0) + 1;
  }
  const sorted = Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  let cum = 0;
  return sorted.map(([date, count]) => {
    cum += count;
    return { date, count, cumulative: cum };
  });
}

export default function SignatureChart({ signatures, title }) {
  const data = useMemo(() => aggregateByDate(signatures), [signatures]);

  if (data.length === 0) return null;

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">{title || 'Signatures Over Time'}</h3>
      <div className="h-48" style={{ minHeight: 0 }}>
        <ResponsiveContainer width="100%" height={192} minWidth={0} minHeight={0}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a3a3a3' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#a3a3a3' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: 8, fontSize: 12, color: '#d4d4d4' }}
              labelStyle={{ color: '#a3a3a3', fontSize: 10 }}
            />
            <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} fill="url(#sigGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

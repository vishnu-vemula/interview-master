/** Recharts theme aligned to the design palette. */
export const CHART = {
  blue: '#1B82EC',
  blueSoft: '#9ACDF8',
  blueMist: '#DCEBFF',
  lime: '#D7F94B',
  limeInk: '#4E7A00',
  ink: '#0E1116',
  coral: '#F2A27E',
  coralInk: '#B8431A',
  grid: '#E6E9E4',
  axis: '#8A9099',
  series: ['#1B82EC', '#0E1116', '#9ACDF8', '#B8D63A', '#F2A27E', '#5B6470'],
  axisProps: { stroke: '#8A9099', fontSize: 11, tickLine: false, axisLine: false, fontFamily: 'Geist Mono, monospace' },
};

export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-r14 border border-line-2 bg-white px-3.5 py-2.5 shadow-pop">
      {label !== undefined && <p className="mono-label mb-1.5 text-muted">{label}</p>}
      {payload.map((item) => (
        <p key={item.dataKey ?? item.name} className="flex items-center gap-2 text-[13px] text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color || item.fill }} />
          {item.name}: <span className="font-medium tabular">{formatter ? formatter(item.value) : item.value}</span>
        </p>
      ))}
    </div>
  );
}

import { cn } from "@/lib/utils/cn";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional future/forecast styling (outlined bars). */
  projected?: boolean;
}

/**
 * Minimal SVG bar chart in the lime-on-black style of the references. The
 * visual is decorative for assistive tech; the same data is exposed as a
 * visually hidden table.
 */
export function BarChart({
  data,
  caption,
  formatValue = (value) => String(value),
  height = 160,
  className,
}: {
  data: BarDatum[];
  caption: string;
  formatValue?: (value: number) => string;
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const gap = 4;
  const width = Math.max(data.length * 16, 1);
  const barWidth = data.length ? width / data.length - gap : 0;
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <figure className={cn("w-full", className)} aria-label={caption}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        aria-hidden
      >
        {data.map((datum, index) => {
          const barHeight = datum.value === 0 ? 1 : Math.max(2, (datum.value / max) * (height - 4));
          const x = index * (barWidth + gap) + gap / 2;
          return (
            <rect
              key={`${datum.label}-${index}`}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={2}
              className={datum.projected ? "fill-transparent stroke-accent" : datum.value === 0 ? "fill-border" : "fill-accent"}
              strokeDasharray={datum.projected ? "3 2" : undefined}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${datum.label}: ${formatValue(datum.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[0.6875rem] text-faint" aria-hidden>
        {data
          .filter((_, index) => index % labelEvery === 0)
          .map((datum, index) => (
            <span key={`${datum.label}-${index}`}>{datum.label}</span>
          ))}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((datum, index) => (
            <tr key={`${datum.label}-${index}`}>
              <th scope="row">
                {datum.label}
                {datum.projected ? " (forecast)" : ""}
              </th>
              <td>{formatValue(datum.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

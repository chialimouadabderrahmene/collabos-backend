export interface RevenuePrediction {
  trend: 'up' | 'down' | 'flat';
  predicted: number[];
}

const TREND_THRESHOLD = 0.05;

export function predictRevenue(
  history: number[],
  monthsAhead: number,
): RevenuePrediction {
  if (history.length === 0) {
    return {
      trend: 'flat',
      predicted: Array.from({ length: monthsAhead }, () => 0),
    };
  }

  if (history.length === 1) {
    return {
      trend: 'flat',
      predicted: Array.from({ length: monthsAhead }, () => history[0]),
    };
  }

  const n = history.length;
  const xMean = (n - 1) / 2;
  const yMean = history.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  history.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const relativeSlope = yMean !== 0 ? slope / yMean : 0;

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (relativeSlope > TREND_THRESHOLD) {
    trend = 'up';
  } else if (relativeSlope < -TREND_THRESHOLD) {
    trend = 'down';
  }

  const lastValue = history[n - 1];
  const predicted: number[] = [];
  for (let i = 1; i <= monthsAhead; i++) {
    predicted.push(Math.max(0, Math.round(lastValue + slope * i)));
  }

  return { trend, predicted };
}

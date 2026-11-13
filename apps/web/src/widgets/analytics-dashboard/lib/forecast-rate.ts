export const FORECAST_RATE = { min: 1, max: 10, step: 0.5 } as const;

export const rateOnStep = (rate: number) =>
  Math.min(
    Math.max(Math.round(rate / FORECAST_RATE.step) * FORECAST_RATE.step, FORECAST_RATE.min),
    FORECAST_RATE.max,
  );

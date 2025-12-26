/**
 * Utility functions for handling time periods
 */

export type PeriodType = "7d" | "30d" | "90d" | "1y";

/**
 * Get the previous period equivalent to the current period
 */
export function getPreviousPeriod(period: PeriodType): PeriodType {
  // For the same period type, return the same (will be used with offset dates)
  return period;
}

/**
 * Get period label in Portuguese
 */
export function getPeriodLabel(period: PeriodType): string {
  const labels: Record<PeriodType, string> = {
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    "1y": "Último ano",
  };
  return labels[period];
}

/**
 * Calculate the start date for a period
 */
export function getPeriodStartDate(period: PeriodType, offset: number = 0): Date {
  const now = new Date();
  let daysBack = 0;

  switch (period) {
    case "7d":
      daysBack = 7;
      break;
    case "30d":
      daysBack = 30;
      break;
    case "90d":
      daysBack = 90;
      break;
    case "1y":
      daysBack = 365;
      break;
  }

  // Add offset (for previous period comparison)
  daysBack += offset * daysBack;

  return new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
}



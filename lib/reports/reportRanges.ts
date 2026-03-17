import "server-only";

export function getPreviousWeekRangeFrom(baseDate?: string) {
  const base = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  const current = new Date(base);
  current.setHours(0, 0, 0, 0);

  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const currentWeekMonday = new Date(current);
  currentWeekMonday.setDate(current.getDate() + diffToMonday);

  const previousWeekMonday = new Date(currentWeekMonday);
  previousWeekMonday.setDate(currentWeekMonday.getDate() - 7);

  const previousWeekSunday = new Date(previousWeekMonday);
  previousWeekSunday.setDate(previousWeekMonday.getDate() + 6);

  return {
    weekStart: previousWeekMonday.toISOString().slice(0, 10),
    weekEnd: previousWeekSunday.toISOString().slice(0, 10),
  };
}

export function isValidMonth(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function getPreviousFullMonthFrom(baseMonth?: string | null) {
  if (isValidMonth(baseMonth)) {
    const [yearStr, monthStr] = baseMonth.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    return {
      month: baseMonth,
      monthStart: start.toISOString().slice(0, 10),
      monthEnd: end.toISOString().slice(0, 10),
    };
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    monthStart: start.toISOString().slice(0, 10),
    monthEnd: end.toISOString().slice(0, 10),
  };
}

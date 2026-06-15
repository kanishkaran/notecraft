export type MonthCell = { day: number; current: boolean; date: Date };

export function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    return dd;
  });
}

export function getMonthDates(year: number, month: number): MonthCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: prevDays - i, current: false, date: new Date(year, month - 1, prevDays - i) });
  for (let i = 1; i <= daysInMonth; i++)
    cells.push({ day: i, current: true, date: new Date(year, month, i) });
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++)
    cells.push({ day: i, current: false, date: new Date(year, month + 1, i) });
  return cells;
}

export function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function timeStr(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

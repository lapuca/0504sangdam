import type { Timestamp } from 'firebase/firestore';

export type SlotNumber = 1 | 2;

export interface CounselingSlot {
  id: string;
  date: string;
  slotNumber: SlotNumber;
  studentName: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ScheduleDay {
  date: string; // YYYY-MM-DD
  year: number;
  month: number; // 11 or 12
  day: number;
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
  weekdayLabel: string;
  dayIndex: number; // 1..27
  isToday: boolean;
}

export interface CalendarCell {
  date: string;
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  isCurrentMonth: boolean;
  scheduleDay: ScheduleDay | null;
}

export interface CalendarMonthBlock {
  year: number;
  month: number;
  title: string;
  subtitle: string;
  cells: CalendarCell[];
}

export const TOTAL_DAYS = 27;
export const TARGET_STUDENT_COUNT = 27;
export const START_DATE = '2026-11-17';
export const END_DATE = '2026-12-13';

// Synchronized verbatim with firebase-blueprint.json
export const STUDENT_NAME_MAX_LENGTH = 30;
export const STUDENT_NAME_MIN_LENGTH = 1;
export const VALID_DATE_REGEX = /^2026-(11-(1[7-9]|2[0-9]|30)|12-(0[1-9]|1[0-3]))$/;
export const NON_WHITESPACE_REGEX = /\S/;

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getSlotId(date: string, slotNumber: SlotNumber): string {
  return `${date}_${slotNumber}`;
}

export function validateStudentName(rawName: string): {
  valid: boolean;
  trimmed: string;
  error?: string;
} {
  const trimmed = rawName.trim();
  if (trimmed.length < STUDENT_NAME_MIN_LENGTH || !NON_WHITESPACE_REGEX.test(trimmed)) {
    return {
      valid: false,
      trimmed,
      error: '학생 이름을 입력해 주세요.',
    };
  }
  if (trimmed.length > STUDENT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      trimmed,
      error: `이름은 ${STUDENT_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`,
    };
  }
  return { valid: true, trimmed };
}

export function generateScheduleDays(): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  // Start at 2026-11-17 (local noon to avoid DST edge cases)
  const start = new Date(2026, 10, 17, 12, 0, 0);

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayOfWeek = d.getDay();
    const dateStr = toDateString(year, month, day);

    days.push({
      date: dateStr,
      year,
      month,
      day,
      dayOfWeek,
      weekdayLabel: WEEKDAY_LABELS[dayOfWeek],
      dayIndex: i + 1,
      isToday: dateStr === START_DATE,
    });
  }
  return days;
}

export const SCHEDULE_DAYS: ScheduleDay[] = generateScheduleDays();

const SCHEDULE_DAY_MAP = new Map<string, ScheduleDay>(
  SCHEDULE_DAYS.map((d) => [d.date, d])
);

export function getScheduleDay(dateStr: string): ScheduleDay | undefined {
  return SCHEDULE_DAY_MAP.get(dateStr);
}

export function formatKoreanDate(dateStr: string): string {
  const found = SCHEDULE_DAY_MAP.get(dateStr);
  if (found) {
    return `${found.month}월 ${found.day}일 (${found.weekdayLabel})`;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[dt.getDay()]})`;
}

export function getCalendarMonths(): CalendarMonthBlock[] {
  // November 2026: Active range 11/17 ~ 11/30.
  // Show weeks covering 11/15 (Sun) through 12/05 (Sat) or cleanly Nov 15..30 + Dec 1..5 trailing,
  // OR Nov 15..30 padded to week end & Dec 1..13 padded to week start/end.
  // Let's build two crisp month calendars showing the active weeks of each month:
  // 1) 2026년 11월: Weeks from 2026-11-15 (Sun) to 2026-12-05 (Sat) -> wait, if 12/1..12/5 is in Nov's last row,
  //    better to show each month cleanly: Nov 15..30 (with Dec 1..5 muted as next-month cells), and Dec 1..13 (with Nov 29..30 muted & Dec 14..19 muted).
  //    Wait: even cleaner! In Nov 2026, Nov 30 is Monday. If Nov shows Nov 15~Nov 30 + Dec 1~5 as non-currentMonth empty cells (like Google Calendar / Naver Calendar),
  //    and Dec shows Nov 29~30 as non-currentMonth empty cells + Dec 1~13 + Dec 14~19 muted, there's zero confusion!

  const buildMonthWeeks = (
    year: number,
    month: number,
    startDay: number,
    endDay: number
  ): CalendarCell[] => {
    const firstVisible = new Date(year, month - 1, startDay, 12, 0, 0);
    const startOffset = firstVisible.getDay(); // days before startDay back to Sunday
    const gridStart = new Date(firstVisible);
    gridStart.setDate(firstVisible.getDate() - startOffset);

    const lastVisible = new Date(year, month - 1, endDay, 12, 0, 0);
    const endOffset = 6 - lastVisible.getDay(); // days after endDay up to Saturday
    const gridEnd = new Date(lastVisible);
    gridEnd.setDate(lastVisible.getDate() + endOffset);

    const cells: CalendarCell[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const cy = cursor.getFullYear();
      const cm = cursor.getMonth() + 1;
      const cd = cursor.getDate();
      const dow = cursor.getDay();
      const dateStr = toDateString(cy, cm, cd);
      const isCurrentMonth = cy === year && cm === month;
      const scheduleDay = isCurrentMonth ? SCHEDULE_DAY_MAP.get(dateStr) ?? null : null;

      cells.push({
        date: dateStr,
        year: cy,
        month: cm,
        day: cd,
        dayOfWeek: dow,
        isCurrentMonth,
        scheduleDay,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  };

  return [
    {
      year: 2026,
      month: 11,
      title: '2026년 11월',
      subtitle: '11월 17일(화) – 11월 30일(월) · 14일간',
      cells: buildMonthWeeks(2026, 11, 15, 30),
    },
    {
      year: 2026,
      month: 12,
      title: '2026년 12월',
      subtitle: '12월 1일(화) – 12월 13일(일) · 13일간',
      cells: buildMonthWeeks(2026, 12, 1, 13),
    },
  ];
}

export const CALENDAR_MONTHS = getCalendarMonths();

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
  dayOfWeek: number; // 1 = Mon ... 5 = Fri
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
export const END_DATE = '2026-12-23';

// Synchronized verbatim with firebase-blueprint.json
export const STUDENT_NAME_MAX_LENGTH = 30;
export const STUDENT_NAME_MIN_LENGTH = 1;
export const VALID_DATE_REGEX =
  /^2026-(11-(1[7-9]|20|2[3-7]|30)|12-(0[1-47-9]|1[014-8]|2[1-3]))$/;
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
  if (
    trimmed.length < STUDENT_NAME_MIN_LENGTH ||
    !NON_WHITESPACE_REGEX.test(trimmed)
  ) {
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
  // Start at 2026-11-17 (local noon to avoid DST edge cases), skipping Saturday (6) and Sunday (0)
  const cursor = new Date(2026, 10, 17, 12, 0, 0);

  while (days.length < TOTAL_DAYS) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      const day = cursor.getDate();
      const dateStr = toDateString(year, month, day);

      days.push({
        date: dateStr,
        year,
        month,
        day,
        dayOfWeek,
        weekdayLabel: WEEKDAY_LABELS[dayOfWeek],
        dayIndex: days.length + 1,
        isToday: dateStr === START_DATE,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
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
  // Build 5-column Mon-Fri weekday calendar blocks (excluding Saturday and Sunday)
  const buildWeekdayMonthBlock = (
    year: number,
    month: number,
    firstActiveDay: number,
    lastActiveDay: number
  ): CalendarCell[] => {
    const firstVisible = new Date(year, month - 1, firstActiveDay, 12, 0, 0);
    // Align back to Monday (getDay() === 1)
    const startOffset = firstVisible.getDay() - 1;
    const gridStart = new Date(firstVisible);
    gridStart.setDate(firstVisible.getDate() - startOffset);

    const lastVisible = new Date(year, month - 1, lastActiveDay, 12, 0, 0);
    // Align forward to Friday (getDay() === 5)
    const endOffset = 5 - lastVisible.getDay();
    const gridEnd = new Date(lastVisible);
    gridEnd.setDate(lastVisible.getDate() + endOffset);

    const cells: CalendarCell[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        const cy = cursor.getFullYear();
        const cm = cursor.getMonth() + 1;
        const cd = cursor.getDate();
        const dateStr = toDateString(cy, cm, cd);
        const isCurrentMonth = cy === year && cm === month;
        const scheduleDay = isCurrentMonth
          ? SCHEDULE_DAY_MAP.get(dateStr) ?? null
          : null;

        cells.push({
          date: dateStr,
          year: cy,
          month: cm,
          day: cd,
          dayOfWeek: dow,
          isCurrentMonth,
          scheduleDay,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  };

  return [
    {
      year: 2026,
      month: 11,
      title: '2026년 11월',
      subtitle: '11월 17일(화) – 11월 30일(월) · 평일 10일간',
      cells: buildWeekdayMonthBlock(2026, 11, 17, 30),
    },
    {
      year: 2026,
      month: 12,
      title: '2026년 12월',
      subtitle: '12월 1일(화) – 12월 23일(수) · 평일 17일간',
      cells: buildWeekdayMonthBlock(2026, 12, 1, 23),
    },
  ];
}

export const CALENDAR_MONTHS = getCalendarMonths();

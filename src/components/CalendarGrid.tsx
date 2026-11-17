import React from 'react';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  CALENDAR_MONTHS,
  getSlotId,
  type CalendarCell,
  type CounselingSlot,
  type SlotNumber,
} from '../utils/schedule';

interface CalendarGridProps {
  slotMap: Map<string, CounselingSlot>;
  monthFilter: 'all' | '11' | '12';
  searchQuery: string;
  onlyAvailable: boolean;
  quickName: string;
  isAdmin: boolean;
  onSelectSlot: (date: string, slotNumber: SlotNumber) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  slotMap,
  monthFilter,
  searchQuery,
  onlyAvailable,
  quickName,
  isAdmin,
  onSelectSlot,
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const trimmedQuickName = quickName.trim();

  const visibleMonths = CALENDAR_MONTHS.filter((m) => {
    if (monthFilter === '11') return m.month === 11;
    if (monthFilter === '12') return m.month === 12;
    return true;
  });

  const renderSlotRow = (
    date: string,
    slotNumber: SlotNumber,
    slot: CounselingSlot | undefined
  ) => {
    const isMatched =
      normalizedQuery.length > 0 &&
      slot?.studentName.toLowerCase().includes(normalizedQuery);

    if (slot) {
      return (
        <button
          key={slotNumber}
          type="button"
          onClick={() => onSelectSlot(date, slotNumber)}
          title={
            isAdmin
              ? `${slotNumber}타임: ${slot.studentName} (클릭하여 수정/삭제)`
              : `${slotNumber}타임: ${slot.studentName} (예약 완료)`
          }
          className={`group w-full flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-colors min-h-[38px] ${
            isMatched
              ? 'bg-blue-50 border-blue-500 text-blue-950 ring-1 ring-blue-500'
              : 'bg-slate-100/90 border-slate-200 text-slate-900 hover:bg-slate-200/70'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-mono-tabular font-semibold text-slate-500 shrink-0">
              {slotNumber}T
            </span>
            <span className="text-xs font-semibold truncate">
              {slot.studentName}
            </span>
          </div>
          {isAdmin ? (
            <span className="flex items-center gap-1 text-slate-400 group-hover:text-blue-700 shrink-0">
              <Pencil className="w-3 h-3" />
              <Trash2 className="w-3 h-3 text-red-400 group-hover:text-red-600" />
            </span>
          ) : (
            <Lock
              className="w-3 h-3 text-slate-400 shrink-0"
              aria-label="수정 잠금"
            />
          )}
        </button>
      );
    }

    return (
      <button
        key={slotNumber}
        type="button"
        onClick={() => onSelectSlot(date, slotNumber)}
        title={`${date} ${slotNumber}타임 신청하기`}
        className="group w-full flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-slate-300 bg-white text-slate-600 hover:border-blue-600 hover:bg-blue-50/50 hover:text-blue-800 transition-colors min-h-[38px]"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-mono-tabular font-semibold text-slate-400 group-hover:text-blue-600 shrink-0">
            {slotNumber}T
          </span>
          <span className="text-xs font-medium truncate">
            {trimmedQuickName
              ? `${trimmedQuickName} 신청`
              : `${slotNumber === 1 ? '1타임' : '2타임'} 신청`}
          </span>
        </div>
        <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
      </button>
    );
  };

  const renderCell = (cell: CalendarCell) => {
    const { scheduleDay, isCurrentMonth, dayOfWeek, day, month } = cell;

    // Out of 27-day counseling window or adjacent month padding
    if (!scheduleDay) {
      return (
        <div
          key={cell.date}
          className={`hidden md:flex flex-col justify-between p-3 min-h-[132px] border-b border-r border-slate-200 ${
            isCurrentMonth ? 'bg-slate-50/70' : 'bg-slate-100/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-medium tabular-nums ${
                isCurrentMonth ? 'text-slate-400' : 'text-slate-300'
              }`}
            >
              {isCurrentMonth ? day : `${month}.${day}`}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {isCurrentMonth ? '상담 기간 외' : ''}
          </span>
        </div>
      );
    }

    const slot1 = slotMap.get(getSlotId(scheduleDay.date, 1));
    const slot2 = slotMap.get(getSlotId(scheduleDay.date, 2));
    const isFull = Boolean(slot1 && slot2);

    const hasSearchMatch =
      normalizedQuery.length > 0 &&
      (slot1?.studentName.toLowerCase().includes(normalizedQuery) ||
        slot2?.studentName.toLowerCase().includes(normalizedQuery));

    const isDimmedByFilter =
      (onlyAvailable && isFull) ||
      (normalizedQuery.length > 0 && !hasSearchMatch);

    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    return (
      <div
        key={cell.date}
        className={`flex flex-col justify-between p-3 min-h-[132px] border-b border-r border-slate-200 transition-opacity ${
          scheduleDay.isToday ? 'bg-blue-50/40' : 'bg-white'
        } ${isDimmedByFilter ? 'opacity-35' : 'opacity-100'}`}
      >
        {/* Cell Header */}
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-sm font-bold tabular-nums ${
                scheduleDay.isToday
                  ? 'text-blue-700'
                  : isSunday
                    ? 'text-red-600'
                    : isSaturday
                      ? 'text-blue-600'
                      : 'text-slate-900'
              }`}
            >
              {scheduleDay.day}일
            </span>
            <span className="md:hidden text-xs font-medium text-slate-500">
              ({scheduleDay.weekdayLabel})
            </span>
            {scheduleDay.isToday && (
              <span className="text-[11px] font-bold text-blue-700">오늘</span>
            )}
          </div>
          <span className="text-[11px] font-mono-tabular text-slate-400">
            {scheduleDay.dayIndex}일차
          </span>
        </div>

        {/* Two Counseling Time Slots */}
        <div className="space-y-1.5">
          {renderSlotRow(scheduleDay.date, 1, slot1)}
          {renderSlotRow(scheduleDay.date, 2, slot2)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {visibleMonths.map((monthBlock) => (
        <section
          key={`${monthBlock.year}-${monthBlock.month}`}
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          {/* Month Header */}
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-bold text-slate-900 tabular-nums">
              {monthBlock.title}
            </h2>
            <p className="text-xs font-medium text-slate-500 tabular-nums">
              {monthBlock.subtitle}
            </p>
          </div>

          {/* Weekday Column Headers (Desktop / Tablet 7-col Calendar) */}
          <div className="hidden md:grid grid-cols-7 border-b border-slate-200 bg-slate-50/40">
            {WEEKDAYS.map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-2.5 px-3 text-xs font-semibold text-center border-r last:border-r-0 border-slate-200 ${
                  idx === 0
                    ? 'text-red-600'
                    : idx === 6
                      ? 'text-blue-600'
                      : 'text-slate-600'
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 [&>*:nth-child(7n)]:md:border-r-0">
            {monthBlock.cells.map((cell) => renderCell(cell))}
          </div>
        </section>
      ))}
    </div>
  );
};

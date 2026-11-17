import React from 'react';
import { Lock, Pencil, Plus, Download } from 'lucide-react';
import {
  getSlotId,
  SCHEDULE_DAYS,
  type CounselingSlot,
  type SlotNumber,
} from '../utils/schedule';

interface ScheduleTableViewProps {
  slotMap: Map<string, CounselingSlot>;
  searchQuery: string;
  onlyAvailable: boolean;
  isAdmin: boolean;
  onSelectSlot: (date: string, slotNumber: SlotNumber) => void;
}

export const ScheduleTableView: React.FC<ScheduleTableViewProps> = ({
  slotMap,
  searchQuery,
  onlyAvailable,
  isAdmin,
  onSelectSlot,
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredDays = SCHEDULE_DAYS.filter((day) => {
    const s1 = slotMap.get(getSlotId(day.date, 1));
    const s2 = slotMap.get(getSlotId(day.date, 2));

    if (onlyAvailable && s1 && s2) {
      return false;
    }

    if (normalizedQuery) {
      const m1 = s1?.studentName.toLowerCase().includes(normalizedQuery);
      const m2 = s2?.studentName.toLowerCase().includes(normalizedQuery);
      const dateMatch = `${day.month}월 ${day.day}일`.includes(normalizedQuery);
      return Boolean(m1 || m2 || dateMatch);
    }

    return true;
  });

  const handleExportCsv = () => {
    const rows: string[] = ['일차,날짜,요일,첫번째 타임(1타임),두번째 타임(2타임)'];
    for (const day of SCHEDULE_DAYS) {
      const s1 = slotMap.get(getSlotId(day.date, 1))?.studentName ?? '';
      const s2 = slotMap.get(getSlotId(day.date, 2))?.studentName ?? '';
      const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
      rows.push(
        [
          `${day.dayIndex}일차`,
          day.date,
          day.weekdayLabel,
          escape(s1),
          escape(s2),
        ].join(',')
      );
    }
    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '상담일정_2026_11_17_27일.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            27일간 상담 일정 전체 명단
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            빈 자리를 클릭하면 바로 이름을 등록할 수 있습니다.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV 내보내기</span>
          </button>
        )}
      </div>

      {filteredDays.length === 0 ? (
        <div className="py-12 px-6 text-center text-sm text-slate-500">
          조건에 맞는 날짜나 학생이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                <th className="py-3 px-4 w-20">일차</th>
                <th className="py-3 px-4 w-36">날짜</th>
                <th className="py-3 px-4">첫번째 타임 (1타임)</th>
                <th className="py-3 px-4">두번째 타임 (2타임)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredDays.map((day) => {
                const slot1 = slotMap.get(getSlotId(day.date, 1));
                const slot2 = slotMap.get(getSlotId(day.date, 2));
                const isSunday = day.dayOfWeek === 0;
                const isSaturday = day.dayOfWeek === 6;

                const renderSlotButton = (
                  slot: CounselingSlot | undefined,
                  slotNum: SlotNumber
                ) => {
                  const isMatch =
                    normalizedQuery.length > 0 &&
                    slot?.studentName.toLowerCase().includes(normalizedQuery);

                  if (slot) {
                    return (
                      <button
                        type="button"
                        onClick={() => onSelectSlot(day.date, slotNum)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                          isMatch
                            ? 'bg-blue-50 border-blue-400 text-blue-950 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-medium truncate">
                          {slot.studentName}
                        </span>
                        {isAdmin ? (
                          <Pencil className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={() => onSelectSlot(day.date, slotNum)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-white text-slate-500 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50/40 transition-colors"
                    >
                      <span className="text-xs font-medium">신청 가능</span>
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  );
                };

                return (
                  <tr
                    key={day.date}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      day.isToday ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 text-xs font-mono-tabular text-slate-500">
                      {day.dayIndex}일차
                    </td>
                    <td className="py-2.5 px-4 tabular-nums whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          isSunday
                            ? 'text-red-600'
                            : isSaturday
                              ? 'text-blue-600'
                              : 'text-slate-900'
                        }`}
                      >
                        {day.month}월 {day.day}일 ({day.weekdayLabel})
                      </span>
                      {day.isToday && (
                        <span className="ml-2 text-xs font-semibold text-blue-700">
                          오늘
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 min-w-[180px]">
                      {renderSlotButton(slot1, 1)}
                    </td>
                    <td className="py-2.5 px-4 min-w-[180px]">
                      {renderSlotButton(slot2, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

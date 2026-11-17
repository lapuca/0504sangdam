import React, { useEffect, useState } from 'react';
import { X, Lock, Trash2, Check, AlertCircle, UserCheck } from 'lucide-react';
import {
  formatKoreanDate,
  getScheduleDay,
  STUDENT_NAME_MAX_LENGTH,
  validateStudentName,
  type CounselingSlot,
  type SlotNumber,
} from '../utils/schedule';

interface SlotModalProps {
  isOpen: boolean;
  date: string;
  slotNumber: SlotNumber;
  existingSlot: CounselingSlot | undefined;
  allSlots: CounselingSlot[];
  defaultStudentName: string;
  isAdmin: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onCreate: (date: string, slotNumber: SlotNumber, studentName: string) => Promise<void>;
  onUpdate: (slotId: string, newStudentName: string) => Promise<void>;
  onDelete: (slotId: string) => Promise<void>;
  onTeacherLogin: () => Promise<void>;
}

export const SlotModal: React.FC<SlotModalProps> = ({
  isOpen,
  date,
  slotNumber,
  existingSlot,
  allSlots,
  defaultStudentName,
  isAdmin,
  isSubmitting,
  errorMessage,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onTeacherLogin,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      setConfirmDelete(false);
      if (existingSlot) {
        setNameInput(existingSlot.studentName);
      } else {
        setNameInput(defaultStudentName);
      }
    }
  }, [isOpen, existingSlot, defaultStudentName, date, slotNumber]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const scheduleDay = getScheduleDay(date);
  const dateLabel = formatKoreanDate(date);
  const slotLabel = slotNumber === 1 ? '첫번째 타임 (1타임)' : '두번째 타임 (2타임)';

  const trimmedInput = nameInput.trim();
  const duplicateBooking = !existingSlot && trimmedInput.length > 0
    ? allSlots.find(
        (s) => s.studentName.trim().toLowerCase() === trimmedInput.toLowerCase()
      )
    : undefined;

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateStudentName(nameInput);
    if (!validation.valid) {
      setLocalError(validation.error ?? '이름을 확인해 주세요.');
      return;
    }
    setLocalError(null);
    await onCreate(date, slotNumber, validation.trimmed);
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingSlot) return;
    const validation = validateStudentName(nameInput);
    if (!validation.valid) {
      setLocalError(validation.error ?? '이름을 확인해 주세요.');
      return;
    }
    if (validation.trimmed === existingSlot.studentName) {
      onClose();
      return;
    }
    setLocalError(null);
    await onUpdate(existingSlot.id, validation.trimmed);
  };

  const handleDelete = async () => {
    if (!existingSlot) return;
    setLocalError(null);
    await onDelete(existingSlot.id);
  };

  const formatCreatedTime = (slot: CounselingSlot) => {
    if (!slot.createdAt || typeof slot.createdAt.toDate !== 'function') {
      return '방금 등록됨';
    }
    const dt = slot.createdAt.toDate();
    return dt.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const combinedError = localError || errorMessage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 tabular-nums">
              {scheduleDay && <span>{scheduleDay.dayIndex}일차</span>}
              {scheduleDay && <span aria-hidden="true">·</span>}
              <span>{slotLabel}</span>
            </div>
            <h2
              id="slot-modal-title"
              className="text-lg font-bold text-slate-900 tabular-nums"
            >
              {dateLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="창 닫기"
            className="p-2 -mr-2 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {combinedError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{combinedError}</span>
            </div>
          )}

          {/* Case 1: Empty Slot -> Registration Form */}
          {!existingSlot && (
            <form onSubmit={handleSubmitCreate} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="student-name-input"
                  className="block text-sm font-semibold text-slate-800"
                >
                  학생 이름
                </label>
                <input
                  id="student-name-input"
                  type="text"
                  autoFocus
                  maxLength={STUDENT_NAME_MAX_LENGTH}
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="본인의 이름을 입력하세요 (예: 김민수)"
                  className="w-full px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>실명으로 정확하게 입력해 주세요.</span>
                  <span className="tabular-nums">
                    {nameInput.trim().length} / {STUDENT_NAME_MAX_LENGTH}자
                  </span>
                </div>
              </div>

              {duplicateBooking && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>{duplicateBooking.studentName}</strong> 학생이 이미{' '}
                    {formatKoreanDate(duplicateBooking.date)}{' '}
                    {duplicateBooking.slotNumber}타임에 등록되어 있습니다. 동명이인이
                    아니라면 기존 일정을 먼저 확인해 주세요.
                  </span>
                </div>
              )}

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1">
                <p className="font-semibold text-slate-700">등록 전 확인사항</p>
                <p>
                  이름을 등록하면 모든 친구가 볼 수 있으며, 한 번 등록된 일정은 학생이
                  직접 수정하거나 삭제할 수 없습니다. 변경이 필요한 경우 담임 선생님에게
                  요청해 주세요.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || trimmedInput.length === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? '등록 중...' : '이 시간에 등록하기'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Case 2: Occupied Slot + Student View (Locked) */}
          {existingSlot && !isAdmin && (
            <div className="space-y-5">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">예약 학생</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>수정 잠금</span>
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {existingSlot.studentName}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  등록 일시: {formatCreatedTime(existingSlot)}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                이미 등록된 상담 일정은 학생이 임의로 수정하거나 삭제할 수 없습니다.
                일정 변경이나 취소가 필요하면 담임 선생님(관리자 모드)의 확인을 받아
                주세요.
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={onTeacherLogin}
                  disabled={isSubmitting}
                  className="text-xs font-medium text-slate-500 hover:text-blue-700 underline underline-offset-4 transition-colors"
                >
                  교사 계정으로 로그인
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  확인
                </button>
              </div>
            </div>
          )}

          {/* Case 3: Occupied Slot + Teacher Admin Mode */}
          {existingSlot && isAdmin && (
            <form onSubmit={handleSubmitUpdate} className="space-y-5">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>교사 관리자 모드 — 이름을 수정하거나 예약을 삭제할 수 있습니다.</span>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="admin-student-name-input"
                  className="block text-sm font-semibold text-slate-800"
                >
                  등록된 학생 이름 수정
                </label>
                <input
                  id="admin-student-name-input"
                  type="text"
                  autoFocus
                  maxLength={STUDENT_NAME_MAX_LENGTH}
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-slate-500 tabular-nums">
                  최초 등록: {formatCreatedTime(existingSlot)}
                </p>
              </div>

              {confirmDelete ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-3">
                  <p className="text-sm font-semibold text-red-900">
                    ‘{existingSlot.studentName}’ 학생의 예약을 정말 삭제할까요?
                  </p>
                  <p className="text-xs text-red-700 leading-relaxed">
                    삭제하면 이 시간 자리가 즉시 빈 자리로 전환되어 다른 학생이 신청할 수
                    있게 됩니다.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? '삭제 중...' : '삭제 확정'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>예약 삭제</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      닫기
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || trimmedInput.length === 0}
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      {isSubmitting ? '저장 중...' : '수정 저장'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

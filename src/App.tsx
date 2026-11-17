import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  Copy,
  KeyRound,
  ListChecks,
  Search,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import {
  collection,
  db,
  doc,
  handleFirestoreError,
  onSnapshot,
  OperationType,
  serverTimestamp,
  setDoc,
  writeBatch,
} from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CalendarGrid } from './components/CalendarGrid';
import { ScheduleTableView } from './components/ScheduleTableView';
import { SlotModal } from './components/SlotModal';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import {
  getSlotId,
  STUDENT_NAME_MAX_LENGTH,
  TARGET_STUDENT_COUNT,
  TOTAL_DAYS,
  validateStudentName,
  type CounselingSlot,
  type SlotNumber,
} from './utils/schedule';

type ViewMode = 'calendar' | 'table';
type MonthFilter = 'all' | '11' | '12';

interface ModalTarget {
  date: string;
  slotNumber: SlotNumber;
}

function CounselingSchedulerApp() {
  const [adminPasscode, setAdminPasscode] = useState<string | null>(null);

  const [slots, setSlots] = useState<CounselingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const isAdmin = adminPasscode !== null;

  useEffect(() => {
    const slotsRef = collection(db, 'counselingSlots');
    const unsubscribe = onSnapshot(
      slotsRef,
      (snapshot) => {
        const nextSlots: CounselingSlot[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (
            typeof data.date === 'string' &&
            (data.slotNumber === 1 || data.slotNumber === 2) &&
            typeof data.studentName === 'string'
          ) {
            nextSlots.push({
              id: docSnap.id,
              date: data.date,
              slotNumber: data.slotNumber,
              studentName: data.studentName,
              createdAt: data.createdAt ?? null,
              updatedAt: data.updatedAt ?? null,
            });
          }
        });
        setSlots(nextSlots);
        setLoadingSlots(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'counselingSlots');
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const slotMap = useMemo(() => {
    const map = new Map<string, CounselingSlot>();
    for (const slot of slots) {
      map.set(slot.id, slot);
    }
    return map;
  }, [slots]);

  const totalSlots = TOTAL_DAYS * 2;
  const bookedCount = slots.length;
  const remainingSlots = Math.max(0, totalSlots - bookedCount);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleOpenAdminModal = async () => {
    setAdminModalOpen(true);
  };

  const handleExitAdminMode = () => {
    setAdminPasscode(null);
    showToast('관리자 모드가 해제되었습니다. (학생 신청 모드)');
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      showToast('상담 일정 링크가 복사되었습니다. 학생들에게 공유하세요.');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('브라우저 주소창의 링크를 직접 복사해 주세요.');
    }
  };

  const handleSelectSlot = (date: string, slotNumber: SlotNumber) => {
    setModalError(null);
    setModalTarget({ date, slotNumber });
  };

  const handleCreateSlot = async (
    date: string,
    slotNumber: SlotNumber,
    studentName: string
  ) => {
    const validation = validateStudentName(studentName);
    if (!validation.valid) {
      setModalError(validation.error ?? '학생 이름을 확인해 주세요.');
      return;
    }

    const slotId = getSlotId(date, slotNumber);
    if (slotMap.has(slotId)) {
      setModalError('방금 다른 학생이 이 시간을 먼저 등록했습니다.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    const path = `counselingSlots/${slotId}`;

    try {
      await setDoc(doc(db, 'counselingSlots', slotId), {
        date,
        slotNumber,
        studentName: validation.trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setModalTarget(null);
      setQuickName('');
      showToast(`${validation.trimmed} 학생의 상담 일정이 등록되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSlot = async (slotId: string, newStudentName: string) => {
    if (!adminPasscode) {
      setModalError('수정은 관리자 모드에서만 가능합니다.');
      return;
    }

    const validation = validateStudentName(newStudentName);
    if (!validation.valid) {
      setModalError(validation.error ?? '학생 이름을 확인해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    const path = `counselingSlots/${slotId}`;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'adminVerifications', slotId), {
        passcode: adminPasscode,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'counselingSlots', slotId), {
        studentName: validation.trimmed,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setModalTarget(null);
      showToast(`‘${validation.trimmed}’으로 이름이 수정되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!adminPasscode) {
      setModalError('삭제는 관리자 모드에서만 가능합니다.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    const path = `counselingSlots/${slotId}`;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'adminVerifications', slotId), {
        passcode: adminPasscode,
        updatedAt: serverTimestamp(),
      });
      batch.delete(doc(db, 'counselingSlots', slotId));
      await batch.commit();
      setModalTarget(null);
      showToast('상담 예약이 삭제되어 빈 자리로 복구되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeExistingSlot = modalTarget
    ? slotMap.get(getSlotId(modalTarget.date, modalTarget.slotNumber))
    : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones (Brand — Nav Links — Primary Action) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            학급 상담 일정
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="주요 메뉴"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                viewMode === 'calendar'
                  ? 'text-blue-700 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              달력 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                viewMode === 'table'
                  ? 'text-blue-700 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              예약 현황
            </button>
            <a
              href="#guide"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              이용 안내
            </a>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleExitAdminMode}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>관리자 모드 · 해제</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdminModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <KeyRound className="w-4 h-4" />
                <span>관리자 모드</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="top"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
      >
        {/* Workspace Hero & Summary Strip */}
        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 tabular-nums">
                <span>2026년 11월 17일 – 12월 13일</span>
                <span aria-hidden="true">·</span>
                <span>총 {TOTAL_DAYS}일간</span>
                <span aria-hidden="true">·</span>
                <span>하루 2타임 (1타임 / 2타임)</span>
                <span aria-hidden="true">·</span>
                <span>학급 인원 {TARGET_STUDENT_COUNT}명</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                1:1 학급 상담 일정 신청
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                아래 캘린더에서 상담 가능한 날짜의{' '}
                <strong className="font-semibold text-slate-800">1타임</strong> 또는{' '}
                <strong className="font-semibold text-slate-800">2타임</strong> 칸을
                선택해 본인의 이름을 입력하세요. 등록 후 수정이나 삭제는 교사 확인이
                필요합니다.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>링크 복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>학생 공유 링크 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4-column Tabular Status Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-slate-500">현재 신청 인원</p>
              <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                {bookedCount}
                <span className="text-sm font-medium text-slate-500 ml-1">
                  / {TARGET_STUDENT_COUNT}명
                </span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-slate-500">남은 빈 자리</p>
              <p className="mt-1 text-xl font-bold text-blue-700 tabular-nums">
                {remainingSlots}
                <span className="text-sm font-medium text-slate-500 ml-1">
                  / {totalSlots}석
                </span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-slate-500">상담 진행 기간</p>
              <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                27일간
                <span className="text-xs font-medium text-slate-500 ml-1.5">
                  11.17 – 12.13
                </span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-slate-500">권한 상태</p>
              <p className="mt-1 text-sm font-bold text-slate-900 flex items-center gap-1.5 min-h-[28px]">
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                    <span className="text-blue-800">교사 관리자 (수정·삭제 가능)</span>
                  </>
                ) : (
                  <>
                    <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>학생 신청 모드 (입력 전용)</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Student Name Entry + Filter Toolbar */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            {/* Direct Student Name Input Box */}
            <div className="md:col-span-5 space-y-1.5">
              <label
                htmlFor="quick-student-name"
                className="block text-xs font-semibold text-slate-700"
              >
                본인 이름 입력 (입력 후 캘린더에서 원하는 날짜·타임 선택)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="quick-student-name"
                  type="text"
                  maxLength={STUDENT_NAME_MAX_LENGTH}
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="이름을 입력해 두면 달력 클릭 시 바로 적용됩니다"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            {/* Search Student / Date */}
            <div className="md:col-span-4 space-y-1.5">
              <label
                htmlFor="search-student-name"
                className="block text-xs font-semibold text-slate-700"
              >
                신청 명단 검색
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="search-student-name"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="친구 또는 본인 이름 검색"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            {/* Filter & View Switcher */}
            <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-2">
              <button
                type="button"
                onClick={() => setOnlyAvailable((prev) => !prev)}
                className={`px-3.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  onlyAvailable
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {onlyAvailable ? '빈 자리만 보는 중' : '빈 자리만 보기'}
              </button>

              <div className="flex md:hidden items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  aria-label="달력 보기"
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="표 보기"
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Month Filter + Legend Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            {viewMode === 'calendar' ? (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMonthFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    monthFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  전체 (11월·12월)
                </button>
                <button
                  type="button"
                  onClick={() => setMonthFilter('11')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    monthFilter === '11'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  11월 (17–30일)
                </button>
                <button
                  type="button"
                  onClick={() => setMonthFilter('12')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    monthFilter === '12'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  12월 (1–13일)
                </button>
              </div>
            ) : (
              <div className="text-xs font-medium text-slate-600">
                전체 27일 일정 표 보기
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 rounded border border-dashed border-slate-400 bg-white inline-block" />
                <span>신청 가능 (빈 자리)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 rounded border border-slate-300 bg-slate-100 inline-block" />
                <span>예약 완료 (수정 잠금)</span>
              </span>
              <span className="text-slate-400 tabular-nums">
                1T = 첫번째 타임 · 2T = 두번째 타임
              </span>
            </div>
          </div>
        </section>

        {/* Main Calendar or Table Viewport */}
        {loadingSlots ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              {Array.from({ length: 14 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-28 bg-slate-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarGrid
            slotMap={slotMap}
            monthFilter={monthFilter}
            searchQuery={searchQuery}
            onlyAvailable={onlyAvailable}
            quickName={quickName}
            isAdmin={isAdmin}
            onSelectSlot={handleSelectSlot}
          />
        ) : (
          <ScheduleTableView
            slotMap={slotMap}
            searchQuery={searchQuery}
            onlyAvailable={onlyAvailable}
            isAdmin={isAdmin}
            onSelectSlot={handleSelectSlot}
          />
        )}

        {/* Clear Rules Guide Section */}
        <section
          id="guide"
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            상담 일정 신청 안내
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600 leading-relaxed">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                01. 누구나 링크로 바로 입력
              </p>
              <p>
                별도 로그인 없이 공유된 링크로 들어와 친구들이 신청한 현황을
                확인하고, 비어 있는 1타임 또는 2타임 자리에 이름을 등록할 수
                있습니다.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                02. 등록 후 수정·삭제 제한
              </p>
              <p>
                한 번 입력한 일정은 다른 친구가 임의로 지우거나 바꿀 수 없도록
                자동으로 잠깁니다. 날짜와 타임을 정확히 확인한 뒤 등록해 주세요.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                03. 교사 관리자 모드 확인
              </p>
              <p>
                잘못 입력했거나 일정 변경·삭제가 필요한 경우 담임 선생님에게
                요청하면 교사 관리자 모드에서 수정 및 삭제를 진행해 드립니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>2026년 학급 상담 일정 캘린더 · 11월 17일 – 12월 13일</span>
          <span>총 27일간 · 하루 2타임 운영</span>
        </div>
      </footer>

      {/* Slot Registration / View / Admin Edit Modal */}
      <SlotModal
        isOpen={Boolean(modalTarget)}
        date={modalTarget?.date ?? ''}
        slotNumber={modalTarget?.slotNumber ?? 1}
        existingSlot={activeExistingSlot}
        allSlots={slots}
        defaultStudentName={quickName}
        isAdmin={isAdmin}
        isSubmitting={isSubmitting}
        errorMessage={modalError}
        onClose={() => {
          if (!isSubmitting) {
            setModalTarget(null);
            setModalError(null);
          }
        }}
        onCreate={handleCreateSlot}
        onUpdate={handleUpdateSlot}
        onDelete={handleDeleteSlot}
        onTeacherLogin={async () => {
          setModalTarget(null);
          await handleOpenAdminModal();
        }}
      />

      {/* Admin Passcode Modal */}
      <TeacherLoginModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onSuccess={(verifiedPasscode) => {
          setAdminPasscode(verifiedPasscode);
          setAdminModalOpen(false);
          showToast('교사 관리자 모드로 전환되었습니다.');
        }}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CounselingSchedulerApp />
    </ErrorBoundary>
  );
}

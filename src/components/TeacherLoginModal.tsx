import React, { useEffect, useState } from 'react';
import { AlertCircle, KeyRound, ShieldCheck, X } from 'lucide-react';
import { verifyAdminPasscode } from '../firebase';

interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (passcode: string) => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [passcode, setPasscode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setErrorMessage(null);
      setIsChecking(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isChecking) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isChecking, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setErrorMessage('비밀번호를 입력해 주세요.');
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);
    try {
      const ok = await verifyAdminPasscode(passcode);
      if (ok) {
        onSuccess(passcode);
      } else {
        setErrorMessage('비밀번호가 일치하지 않습니다.');
        setPasscode('');
      }
    } catch {
      setErrorMessage('확인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-passcode-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isChecking) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <ShieldCheck className="w-4 h-4" />
              <span>교사 전용</span>
            </div>
            <h2
              id="admin-passcode-title"
              className="text-lg font-bold text-slate-900"
            >
              관리자 모드 전환
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isChecking}
            aria-label="닫기"
            className="p-2 -mr-2 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            예약을 수정하거나 삭제하려면 관리자 비밀번호를 입력하세요.
          </p>

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="admin-passcode-input"
              className="block text-xs font-semibold text-slate-700"
            >
              관리자 비밀번호
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-passcode-input"
                type="password"
                autoFocus
                autoComplete="off"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="비밀번호 입력"
                disabled={isChecking}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isChecking}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isChecking || passcode.length === 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              {isChecking ? '확인 중...' : '확인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

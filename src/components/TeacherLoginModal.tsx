import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  LogIn,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  auth,
  GoogleAuthProvider,
  OAUTH_CLIENT_ID,
  signInWithCredential,
  type User,
} from '../firebase';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      width?: number;
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      locale?: string;
    }
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

interface TeacherLoginModalProps {
  isOpen: boolean;
  errorMessage: string | null;
  isLoggingIn: boolean;
  onClose: () => void;
  onPopupLogin: () => Promise<void>;
  onRedirectLogin: () => Promise<void>;
  onCredentialSuccess: (user: User) => void;
  onCredentialError: (message: string) => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  errorMessage,
  isLoggingIn,
  onClose,
  onPopupLogin,
  onRedirectLogin,
  onCredentialSuccess,
  onCredentialError,
}) => {
  const gisButtonRef = useRef<HTMLDivElement | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [gisFailed, setGisFailed] = useState(false);
  const [gisSubmitting, setGisSubmitting] = useState(false);

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoggingIn && !gisSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoggingIn, gisSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen || !OAUTH_CLIENT_ID) return;

    let cancelled = false;

    const initGisButton = () => {
      if (cancelled) return;
      const gsiId = window.google?.accounts?.id;
      if (!gsiId || !gisButtonRef.current) return;

      try {
        gisButtonRef.current.innerHTML = '';
        gsiId.initialize({
          client_id: OAUTH_CLIENT_ID,
          auto_select: false,
          callback: async (response) => {
            if (!response.credential) {
              onCredentialError('Google 인증 토큰을 받지 못했습니다.');
              return;
            }
            setGisSubmitting(true);
            try {
              const credential = GoogleAuthProvider.credential(
                response.credential
              );
              const result = await signInWithCredential(auth, credential);
              onCredentialSuccess(result.user);
            } catch (err) {
              const code =
                err && typeof err === 'object' && 'code' in err
                  ? String((err as { code?: unknown }).code)
                  : '';
              const msg =
                err instanceof Error ? err.message : '인증 처리에 실패했습니다.';
              onCredentialError(
                code ? `Google 로그인 실패 (${code}): ${msg}` : msg
              );
            } finally {
              setGisSubmitting(false);
            }
          },
        });

        gsiId.renderButton(gisButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: 'signin_with',
          locale: 'ko',
        });
        setGisReady(true);
        setGisFailed(false);
      } catch {
        setGisFailed(true);
      }
    };

    if (window.google?.accounts?.id) {
      initGisButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', initGisButton);
      existingScript.addEventListener('error', () => {
        if (!cancelled) setGisFailed(true);
      });
      return () => {
        cancelled = true;
        existingScript.removeEventListener('load', initGisButton);
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGisButton;
    script.onerror = () => {
      if (!cancelled) setGisFailed(true);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [isOpen, onCredentialError, onCredentialSuccess]);

  if (!isOpen) return null;

  const busy = isLoggingIn || gisSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-login-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <ShieldCheck className="w-4 h-4" />
              <span>교사 관리자 인증</span>
            </div>
            <h2
              id="teacher-login-title"
              className="text-lg font-bold text-slate-900"
            >
              선생님 Google 로그인
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="p-2 -mr-2 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            예약 수정 및 삭제가 가능한 관리자 모드로 전환하려면 교사 계정(
            <strong className="font-semibold text-slate-900">
              {ADMIN_EMAIL}
            </strong>
            )으로 로그인하세요.
          </p>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="break-all">{errorMessage}</span>
            </div>
          )}

          {/* Method 1: Official Google Identity Services Button */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              방법 1. Google 계정으로 바로 로그인
            </p>
            <div className="min-h-[44px] flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              {gisSubmitting ? (
                <span className="text-xs font-medium text-slate-600">
                  Google 계정 확인 중...
                </span>
              ) : gisFailed ? (
                <span className="text-xs text-slate-500">
                  Google 버튼을 불러오지 못했습니다. 아래 다른 방법을 이용해
                  주세요.
                </span>
              ) : (
                <div
                  ref={gisButtonRef}
                  className="flex items-center justify-center w-full overflow-hidden"
                />
              )}
              {!gisReady && !gisFailed && !gisSubmitting && (
                <span className="text-xs text-slate-400">
                  Google 로그인 버튼 준비 중...
                </span>
              )}
            </div>
          </div>

          {/* Method 2 & 3: Firebase Popup / Redirect */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700">
              방법 2. 팝업 또는 리디렉션 로그인
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onPopupLogin}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isLoggingIn ? '창 여는 중...' : '팝업으로 로그인'}</span>
              </button>
              <button
                type="button"
                onClick={onRedirectLogin}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>화면 이동 로그인</span>
              </button>
            </div>
          </div>

          {/* Iframe escape hatch */}
          {isInIframe && (
            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
              <p className="text-xs text-blue-900 leading-relaxed">
                미리보기 창(iframe) 안에서 브라우저의 팝업 차단이나 쿠키 제한으로
                로그인이 막히는 경우, 아래 버튼을 눌러 새 탭에서 열면 정상적으로
                로그인됩니다.
              </p>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>새 탭에서 열어 로그인하기</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

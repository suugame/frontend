'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

export type MessageType = 'info' | 'success' | 'warning' | 'error';

export interface MessageProps {
  message: string;
  type: MessageType;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
  title?: string;
}

const Message = ({
  message,
  type,
  onClose,
  autoClose = true,
  duration = 5000,
  title,
}: MessageProps) => {
  const { t } = useI18n();
  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return 'alert-success';
      case 'error':
        return 'alert-error';
      case 'warning':
        return 'alert-warning';
      case 'info':
      default:
        return 'alert-info';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="h-6 w-6 shrink-0 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-md animate-[slideDown_0.3s_ease-out]">
      <div
        role="alert"
        className={`alert ${getAlertStyles()} shadow-2xl border-2`}
      >
        {getIcon()}
        <div className="flex-1">
          {title && <h3 className="font-bold text-base mb-1">{title}</h3>}
          <div className="text-sm whitespace-pre-line">{message}</div>
        </div>
        {onClose && (
          <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>
      )}
      </div>
    </div>
  );
};

export default Message;
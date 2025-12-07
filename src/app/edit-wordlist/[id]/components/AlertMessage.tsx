// components/AlertMessage.tsx
"use client";

import React from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';

export interface AlertMessageProps {
  message: string;
  type: 'warning' | 'error';
  onClose: () => void;
}


export const AlertMessage: React.FC<AlertMessageProps> = ({ 
  message, 
  type, 
  onClose 
}) => {
  return (
    <div className={`
      fixed top-6 left-1/2 transform -translate-x-1/2 z-50
      flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg border animate-slideDown
      ${type === 'warning' 
        ? 'bg-amber-50 text-amber-800 border-amber-200' 
        : 'bg-red-50 text-red-800 border-red-200'
      }
    `}>
      {type === 'warning' ? (
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
      )}
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-4 p-1 rounded-full hover:bg-white/30 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
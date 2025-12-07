// components/ConfirmDialog.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认删除',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full transform animate-scaleIn">
          <div className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="mt-1 flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 hover:bg-gray-100"
            >
              {cancelText}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
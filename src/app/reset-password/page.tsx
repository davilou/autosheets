'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { ArrowLeft } from 'lucide-react';

function ResetPasswordContent() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header com botão voltar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link
              href="/login"
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao login
            </Link>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      </div>

      {/* Formulário de redefinição de senha */}
      <ResetPasswordForm />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
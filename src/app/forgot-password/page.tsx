'use client';

import Link from 'next/link';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
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
              href="/register"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Não tem uma conta? Registre-se
            </Link>
          </div>
        </div>
      </div>

      {/* Formulário de recuperação de senha */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
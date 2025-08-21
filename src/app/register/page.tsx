'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RegisterForm from '@/components/auth/RegisterForm';
import { ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleRegistrationSuccess = () => {
    setRegistrationSuccess(true);
    // Redirecionar para login após 3 segundos
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  };

  const handleSwitchToLogin = () => {
    router.push('/login');
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Registro realizado com sucesso!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Você será redirecionado para a página de login em alguns segundos...
            </p>
            <div className="mt-4">
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Ir para login agora
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header com botão voltar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Já tem uma conta? Faça login
            </Link>
          </div>
        </div>
      </div>

      {/* Formulário de registro */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <RegisterForm 
            onSuccess={handleRegistrationSuccess} 
            onSwitchToLogin={handleSwitchToLogin}
          />
        </div>
      </div>
    </div>
  );
}
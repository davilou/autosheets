"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Se já estiver autenticado, redireciona para o dashboard e evita ficar na página de login
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const resp = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          router.replace('/');
        }
      } catch {}
    };

    checkExistingSession();
  }, [router]);

  // Garante persistência ao voltar (bfcache)
  useEffect(() => {
    const onPageShow = async (_e: any) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const resp = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          router.replace('/');
        }
      } catch {}
    };

    window.addEventListener('pageshow', onPageShow as any);
    return () => window.removeEventListener('pageshow', onPageShow as any);
  }, [router]);

  const handleLoginSuccess = () => {
    setLoginSuccess(true);
    // Redirecionar para dashboard após login bem-sucedido, usando replace para não manter a página de login no histórico
    setTimeout(() => {
      router.replace('/');
    }, 1000);
  };

  if (loginSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-green-600">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Login realizado com sucesso!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Redirecionando para o dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-indigo-600">
                AutoSheets
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Não tem uma conta?</span>
              <Link
                href="/register"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Registrar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <LoginForm 
            onSuccess={handleLoginSuccess}
          />
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, ArrowLeft, Mail } from 'lucide-react';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token de verificação não encontrado');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const result = await response.json();

        if (result.success) {
          setStatus('success');
          setMessage(result.message);
          // Redirecionar para login após 3 segundos
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(result.message);
        }
      } catch (error) {
        console.error('Erro ao verificar email:', error);
        setStatus('error');
        setMessage('Erro ao verificar email. Tente novamente.');
      }
    };

    verifyEmail();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Verificando email...
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Aguarde enquanto verificamos seu email.
            </p>
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
              href="/login"
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ir para login
            </Link>
          </div>
        </div>
      </div>

      {/* Resultado da verificação */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className={`mx-auto h-12 w-12 flex items-center justify-center rounded-full ${
              status === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {status === 'success' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {status === 'success' ? 'Email verificado!' : 'Erro na verificação'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {message}
            </p>
            
            <div className="mt-6 space-y-3">
              {status === 'success' ? (
                <>
                  <p className="text-sm text-gray-500">
                    Você será redirecionado para o login em alguns segundos...
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Ir para login agora
                  </Link>
                </>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Ir para login
                  </Link>
                  <div>
                    <Link
                      href="/register"
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      Criar nova conta
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
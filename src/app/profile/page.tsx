'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProfileDashboard from '@/components/auth/ProfileDashboard';
import Navigation from '@/components/ui/navigation';
import { User } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  telegramId?: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        // Em outros erros, não desloga automaticamente; apenas informa
        setError('Não foi possível carregar o perfil agora. Tente novamente.');
        return;
      }

      const result = await response.json();

      if (result.success) {
        setUser(result.user);
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      // Não remove token em erros de rede
      setError('Erro ao carregar perfil do usuário');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Revalida ao voltar via bfcache
  useEffect(() => {
    const onPageShow = () => {
      setIsLoading(true);
      fetchUserProfile();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileUpdate = (updatedUser: UserProfile) => {
    setUser(updatedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const goBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <User className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Erro ao carregar perfil</h2>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <div className="mt-6 space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Tentar novamente
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Fazer logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Usuário não encontrado</p>
          <button
            onClick={handleLogout}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Navigation showBackButton={true} title="Perfil do Usuário" />
        
        <div className="flex justify-between items-center mb-6 p-4 bg-white shadow-sm rounded-lg">
          <span className="text-lg font-medium text-gray-800">Olá, {user.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-600 hover:text-red-500 px-4 py-2 rounded-md border border-red-300 hover:bg-red-50"
          >
            Sair
          </button>
        </div>

        <ProfileDashboard 
          user={user} 
          onProfileUpdate={handleProfileUpdate}
        />
      </div>
    </div>
  );
}
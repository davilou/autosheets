'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Edit3, 
  Save, 
  X,
  Eye,
  EyeOff
} from 'lucide-react';

// Schema de validação para perfil
const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  telegramId: z.string().optional(),
});

// Schema de validação para mudança de senha
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string()
    .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Nova senha deve conter pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  telegramId?: string;
  emailVerified: boolean;
  createdAt: string;
}

interface ProfileDashboardProps {
  user: UserProfile;
  onProfileUpdate?: (user: UserProfile) => void;
}

export default function ProfileDashboard({ user, onProfileUpdate }: ProfileDashboardProps) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Form para perfil
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      telegramId: user.telegramId || ''
    }
  });

  // Form para mudança de senha
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema)
  });

  const onSubmitProfile = async (data: ProfileFormData) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        setIsEditingProfile(false);
        onProfileUpdate?.(result.user);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitPassword = async (data: ChangePasswordFormData) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setIsChangingPassword(false);
        passwordForm.reset();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setMessage({ type: 'error', text: 'Erro ao alterar senha. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const requestEmailVerification = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/request-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Email de verificação enviado!' });
        setVerificationSent(true);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Erro ao solicitar verificação:', error);
      setMessage({ type: 'error', text: 'Erro ao enviar verificação. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center mt-2">
              {user.emailVerified ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Email verificado
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Email não verificado
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`rounded-md p-4 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Informações do Perfil */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Informações do Perfil</h2>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Editar
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                {...profileForm.register('name')}
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {profileForm.formState.errors.name && (
                <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                {...profileForm.register('email')}
                type="email"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {profileForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">ID do Telegram (opcional)</label>
              <input
                {...profileForm.register('telegramId')}
                type="text"
                placeholder="@seu_usuario"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  profileForm.reset();
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Nome</p>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </div>
            
            {user.telegramId && (
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Telegram</p>
                  <p className="text-sm text-gray-600">{user.telegramId}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verificação de Email */}
      {!user.emailVerified && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-yellow-800">Verificação de Email</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Seu email ainda não foi verificado. Clique no botão para receber um email de verificação.
              </p>
            </div>
            <button
              onClick={requestEmailVerification}
              disabled={isLoading || verificationSent}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {verificationSent ? 'Email enviado' : 'Verificar email'}
            </button>
          </div>
        </div>
      )}

      {/* Segurança */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Segurança</h2>
          </div>
          {!isChangingPassword && (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Alterar senha
            </button>
          )}
        </div>

        {isChangingPassword ? (
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Senha atual</label>
              <div className="mt-1 relative">
                <input
                  {...passwordForm.register('currentPassword')}
                  type={showPasswords.current ? 'text' : 'password'}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-10 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => togglePasswordVisibility('current')}
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.currentPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nova senha</label>
              <div className="mt-1 relative">
                <input
                  {...passwordForm.register('newPassword')}
                  type={showPasswords.new ? 'text' : 'password'}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-10 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => togglePasswordVisibility('new')}
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.newPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar nova senha</label>
              <div className="mt-1 relative">
                <input
                  {...passwordForm.register('confirmPassword')}
                  type={showPasswords.confirm ? 'text' : 'password'}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-10 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => togglePasswordVisibility('confirm')}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Alterando...' : 'Alterar senha'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  passwordForm.reset();
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              Última alteração: {new Date(user.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
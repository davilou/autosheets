'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, Lock, CheckCircle } from 'lucide-react';

interface ConnectCredentialsProps {
  credentialId: string;
  phoneNumber: string;
  sessionName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ConnectionStep {
  step: 'send-code' | 'verify-code' | 'password' | 'success';
  needsPhoneCode?: boolean;
  needsPassword?: boolean;
  message?: string;
}

export default function ConnectCredentials({
  credentialId,
  phoneNumber,
  sessionName,
  onSuccess,
  onCancel
}: ConnectCredentialsProps) {
  const [currentStep, setCurrentStep] = useState<ConnectionStep>({ step: 'send-code' });
  const [phoneCode, setPhoneCode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const sendVerificationCode = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/telegram/connect', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ credentialId })
      });

      const result = await response.json();

      if (result.success && result.data?.codeSent) {
        setCurrentStep({ step: 'verify-code' });
        toast({
          title: 'Código enviado!',
          description: `Código de verificação enviado para ${result.data.phoneNumber}`,
        });
      } else {
        setError(result.message || 'Erro ao enviar código');
      }
    } catch (error) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const connectCredentials = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          credentialId,
          phoneCode: phoneCode.trim(),
          password: password.trim()
        })
      });

      const result = await response.json();

      if (result.success) {
        if (result.needsPhoneCode) {
          // Código enviado, ir para verificação
          setCurrentStep({ step: 'verify-code' });
          setPhoneCode('');
          toast({
            title: 'Código enviado!',
            description: result.message,
          });
        } else {
          // Autenticação completa
          setCurrentStep({ step: 'success' });
          toast({
            title: 'Sucesso!',
            description: 'Credenciais conectadas com sucesso!',
          });
          setTimeout(() => {
            onSuccess?.();
          }, 2000);
        }
      } else {
        if (result.needsPassword) {
          setCurrentStep({ step: 'password', needsPassword: true, message: result.message });
        } else if (result.needsNewCode) {
          // Código expirado, voltar para enviar novo código
          setCurrentStep({ step: 'send-code' });
          setPhoneCode('');
          setPassword('');
          setError(result.message || 'Código expirado');
        } else if (result.needsPhoneCode) {
          // Código inválido, manter na tela de verificação
          setError(result.message || 'Código inválido');
          setPhoneCode(''); // Limpar código inválido
        } else {
          setError(result.message || 'Erro na autenticação');
        }
      }
    } catch (error) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep.step === 'verify-code' || currentStep.step === 'password') {
      connectCredentials();
    }
  };

  const renderStepContent = () => {
    switch (currentStep.step) {
      case 'send-code':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto text-blue-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Conectar ao Telegram</h3>
              <p className="text-gray-600 mb-4">
                Vamos enviar um código de verificação para o número:
                <br />
                <strong>{phoneNumber}</strong>
              </p>
            </div>
            
            <Button 
              onClick={sendVerificationCode} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando código...
                </>
              ) : (
                'Enviar código de verificação'
              )}
            </Button>
          </div>
        );

      case 'verify-code':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto text-blue-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Código de verificação</h3>
              <p className="text-gray-600 mb-4">
                Digite o código de verificação que você recebeu no Telegram
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneCode">Código de verificação</Label>
              <Input
                id="phoneCode"
                type="text"
                placeholder="123456"
                value={phoneCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Apenas números
                  setPhoneCode(value);
                }}
                maxLength={6}
                className="text-center text-lg tracking-widest"
                autoFocus
              />
              <p className="text-sm text-gray-500 text-center">
                Digite o código de 5-6 dígitos recebido no Telegram
              </p>
            </div>
            
            <Button 
              type="submit" 
              disabled={isLoading || !phoneCode.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar código'
              )}
            </Button>
          </form>
        );

      case 'password':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto text-orange-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Autenticação 2FA</h3>
              <p className="text-gray-600 mb-4">
                Sua conta possui autenticação de dois fatores habilitada.
                Digite sua senha 2FA:
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha 2FA</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha 2FA"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isLoading || !password.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Autenticar'
              )}
            </Button>
          </form>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h3 className="text-lg font-medium text-green-700">Conectado com sucesso!</h3>
            <p className="text-gray-600">
              Suas credenciais do Telegram foram conectadas e uma sessão ativa foi criada.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Conectar Credenciais</CardTitle>
        <CardDescription>
          Sessão: {sessionName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {currentStep.message && (
          <Alert className="mb-4">
            <AlertDescription>{currentStep.message}</AlertDescription>
          </Alert>
        )}
        
        {renderStepContent()}
        
        {currentStep.step !== 'success' && (
          <div className="mt-6 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="w-full"
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
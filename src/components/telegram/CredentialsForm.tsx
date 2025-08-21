'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Info } from 'lucide-react';

const credentialsSchema = z.object({
  apiId: z.string()
    .min(6, 'API ID deve ter pelo menos 6 dígitos')
    .max(10, 'API ID deve ter no máximo 10 dígitos')
    .regex(/^\d+$/, 'API ID deve conter apenas números'),
  apiHash: z.string()
    .length(32, 'API Hash deve ter exatamente 32 caracteres')
    .regex(/^[a-f0-9]{32}$/i, 'API Hash deve ser um hash MD5 válido'),
  phoneNumber: z.string()
    .min(10, 'Número de telefone muito curto')
    .regex(/^\+?[1-9]\d{1,14}$/, 'Formato de telefone inválido (use formato internacional)'),
  sessionName: z.string()
    .min(3, 'Nome da sessão deve ter pelo menos 3 caracteres')
    .max(50, 'Nome da sessão deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nome da sessão deve conter apenas letras, números, _ e -'),
  driveEmail: z.string()
    .email('Email do Google Drive inválido')
    .min(1, 'Email do Google Drive é obrigatório')
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;

interface CredentialsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CredentialsForm({ onSuccess, onCancel }: CredentialsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showApiHash, setShowApiHash] = useState(false);
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
  });

  const onSubmit = async (data: CredentialsFormData) => {
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/telegram/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: 'Credenciais do Telegram adicionadas com sucesso.',
        });
        
        reset();
        onSuccess?.();
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao adicionar credenciais.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Adicionar Credenciais do Telegram</CardTitle>
        <CardDescription>
          Configure suas credenciais do Telegram para conectar o bot
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Como obter suas credenciais:</strong>
            <br />1. Acesse <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">my.telegram.org</a>
            <br />2. Faça login com seu número de telefone
            <br />3. Vá em "API Development Tools"
            <br />4. Crie uma nova aplicação e copie o API ID e API Hash
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiId">API ID</Label>
              <Input
                id="apiId"
                type="text"
                placeholder="1234567"
                {...register('apiId')}
              />
              {errors.apiId && (
                <p className="text-sm text-red-500">{errors.apiId.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="apiHash">API Hash</Label>
              <div className="relative">
                <Input
                  id="apiHash"
                  type={showApiHash ? 'text' : 'password'}
                  placeholder="abcdef1234567890abcdef1234567890"
                  {...register('apiHash')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiHash(!showApiHash)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showApiHash ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.apiHash && (
                <p className="text-sm text-red-500">{errors.apiHash.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de Telefone</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+5511999999999"
              {...register('phoneNumber')}
            />
            {errors.phoneNumber && (
              <p className="text-sm text-red-500">{errors.phoneNumber.message}</p>
            )}
            <p className="text-sm text-gray-500">
              Use o formato internacional com código do país (ex: +55 para Brasil)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionName">Nome da Sessão</Label>
            <Input
              id="sessionName"
              type="text"
              placeholder="minha-sessao-principal"
              {...register('sessionName')}
            />
            {errors.sessionName && (
              <p className="text-sm text-red-500">{errors.sessionName.message}</p>
            )}
            <p className="text-sm text-gray-500">
              Nome único para identificar esta sessão (apenas letras, números, _ e -)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driveEmail">Email do Google Drive</Label>
            <Input
              id="driveEmail"
              type="email"
              placeholder="seu-email@gmail.com"
              {...register('driveEmail')}
            />
            {errors.driveEmail && (
              <p className="text-sm text-red-500">{errors.driveEmail.message}</p>
            )}
            <p className="text-sm text-gray-500">
              Email onde a planilha será compartilhada automaticamente
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Adicionando...' : 'Adicionar Credenciais'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
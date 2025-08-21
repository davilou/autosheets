'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import ConnectCredentials from './ConnectCredentials';
import { 
  Trash2, 
  RefreshCw, 
  Phone, 
  Key, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Wifi,
  MessageSquare
} from 'lucide-react';

interface TelegramCredential {
  id: string;
  apiId: string;
  phoneNumber: string;
  sessionName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';
  lastConnection?: string;
  createdAt: string;
  activeSessions?: number;
  isActive: boolean;
}

interface CredentialsListProps {
  onAddNew?: () => void;
  refreshTrigger?: number;
}

const statusConfig = {
  CONNECTED: {
    label: 'Conectado',
    color: 'bg-green-500',
    icon: CheckCircle,
    variant: 'default' as const
  },
  DISCONNECTED: {
    label: 'Desconectado',
    color: 'bg-gray-500',
    icon: XCircle,
    variant: 'secondary' as const
  },
  ERROR: {
    label: 'Erro',
    color: 'bg-red-500',
    icon: AlertCircle,
    variant: 'destructive' as const
  },
  PENDING: {
    label: 'Pendente',
    color: 'bg-yellow-500',
    icon: Clock,
    variant: 'outline' as const
  }
};

export default function CredentialsList({ onAddNew, refreshTrigger }: CredentialsListProps) {
  const [credentials, setCredentials] = useState<TelegramCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApiIds, setShowApiIds] = useState<Record<string, boolean>>({});
  const [connectingCredential, setConnectingCredential] = useState<string | null>(null);
  // Removido: showInactive
  const { toast } = useToast();
  // Removido: startingId
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      // Removido filtro por inativas; busca única
      const response = await fetch('/api/telegram/credentials', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setCredentials(result.data || []);
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao carregar credenciais.',
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

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta credencial? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch(`/api/telegram/credentials/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: 'Credencial removida com sucesso.',
        });
        fetchCredentials();
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao remover credencial.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch(`/api/telegram/credentials/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: 'Status atualizado com sucesso.',
        });
        fetchCredentials();
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao atualizar status.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleStartBotChat = async (credentialId: string) => {
    try {
      setStartingChatId(credentialId);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/telegram/start-bot-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ credentialId })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const botUsername = result?.data?.botUsername ? `@${result.data.botUsername.replace('@','')}` : 'o bot';
        const command = result?.data?.command || '/start <seu_token>';
        toast({
          title: 'Chat iniciado com o bot',
          description: `Se não receber resposta automática, abra ${botUsername} no Telegram e envie: ${command}`
        });
      } else {
        toast({
          title: 'Não foi possível iniciar o chat',
          description: result?.message || 'Verifique sua conexão e tente novamente.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão ao iniciar o chat com o bot.',
        variant: 'destructive'
      });
    } finally {
      setStartingChatId(null);
    }
  };

  const toggleApiIdVisibility = (id: string) => {
    setShowApiIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const maskApiId = (apiId: string) => {
    if (!apiId || typeof apiId !== 'string') return '****';
    if (apiId.length <= 4) return apiId;
    return apiId.substring(0, 2) + '*'.repeat(apiId.length - 4) + apiId.substring(apiId.length - 2);
  };

  useEffect(() => {
    fetchCredentials();
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando credenciais...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Credenciais do Telegram</h2>
          <p className="text-gray-600">Gerencie suas conexões com o Telegram</p>
        </div>
        <div className="flex gap-2">
          {/* Removidos: Mostrar/Ocultar Inativas e Atualizar */}
          {onAddNew && (
            <Button onClick={onAddNew}>
              Adicionar Credencial
            </Button>
          )}
        </div>
      </div>

      {credentials.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma credencial encontrada</h3>
              <p className="text-gray-600 mb-4">
                Adicione suas credenciais do Telegram para começar a usar o sistema.
              </p>
              {onAddNew && (
                <Button onClick={onAddNew}>
                  Adicionar Primeira Credencial
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {credentials.map((credential) => {
            const statusInfo = statusConfig[credential.status];
            const StatusIcon = statusInfo.icon;
            
            return (
              <Card key={credential.id} className={!credential.isActive ? 'opacity-60 border-dashed' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        {credential.phoneNumber}
                        <Badge variant={statusInfo.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        {!credential.isActive && (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            Inativa
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Sessão: {credential.sessionName}
                        {!credential.isActive && ' (Credencial removida)'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {credential.status === 'DISCONNECTED' && (
                        <Button
                          onClick={() => setConnectingCredential(credential.id)}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Wifi className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Removido botão "Iniciar Monitoramento" */}
                      {credential.status === 'CONNECTED' && (
                        <Button
                          onClick={() => handleStartBotChat(credential.id)}
                          size="sm"
                          disabled={startingChatId === credential.id}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <MessageSquare className={`h-4 w-4 mr-2 ${startingChatId === credential.id ? 'animate-pulse' : ''}`} />
                          {startingChatId === credential.id ? 'Abrindo...' : 'Iniciar Chat com Bot'}
                        </Button>
                      )}
                      <Button
                        onClick={() => handleUpdateStatus(credential.id, 'CONNECTED')}
                        variant="outline"
                        size="sm"
                        disabled={credential.status === 'CONNECTED'}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(credential.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <label className="font-medium text-gray-700">API ID:</label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {showApiIds[credential.id] ? credential.apiId : maskApiId(credential.apiId)}
                        </span>
                        <button
                          onClick={() => toggleApiIdVisibility(credential.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showApiIds[credential.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="font-medium text-gray-700">Sessões Ativas:</label>
                      <p>{credential.activeSessions || 0}</p>
                    </div>
                    
                    <div>
                      <label className="font-medium text-gray-700">Criado em:</label>
                      <p>{formatDate(credential.createdAt)}</p>
                    </div>
                  </div>
                  
                  {credential.lastConnection && (
                    <div className="mt-3 pt-3 border-t">
                      <label className="font-medium text-gray-700">Última Conexão:</label>
                      <p className="text-sm">{formatDate(credential.lastConnection)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {connectingCredential && (
        <ConnectCredentials
          credentialId={connectingCredential}
          phoneNumber={credentials.find(c => c.id === connectingCredential)?.phoneNumber || ''}
          sessionName={credentials.find(c => c.id === connectingCredential)?.sessionName || ''}
          onSuccess={() => {
            setConnectingCredential(null);
            fetchCredentials();
          }}
          onCancel={() => setConnectingCredential(null)}
        />
      )}
    </div>
  );
}
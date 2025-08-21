'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  Database
} from 'lucide-react';

interface TelegramSession {
  id: string;
  credentialId: string;
  sessionName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastActivity?: string;
  createdAt: string;
  connectionLogs: {
    timestamp: string;
    event: string;
    message: string;
    details?: any;
  }[];
  hasBackup: boolean;
}

interface SessionManagerProps {
  credentialId: string;
  onClose?: () => void;
}

const statusConfig = {
  ACTIVE: {
    label: 'Ativa',
    color: 'bg-green-500',
    icon: CheckCircle,
    variant: 'default' as const
  },
  INACTIVE: {
    label: 'Inativa',
    color: 'bg-gray-500',
    icon: XCircle,
    variant: 'secondary' as const
  },
  ERROR: {
    label: 'Erro',
    color: 'bg-red-500',
    icon: AlertCircle,
    variant: 'destructive' as const
  }
};

export default function SessionManager({ credentialId, onClose }: SessionManagerProps) {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch(`/api/telegram/sessions?credentialId=${credentialId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setSessions(result.data || []);
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao carregar sessões.',
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

  const createSession = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const sessionName = prompt('Nome da nova sessão:');
      if (!sessionName) return;

      const response = await fetch('/api/telegram/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          credentialId,
          sessionName,
          sessionData: {} // Dados iniciais vazios
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: 'Sessão criada com sucesso.',
        });
        fetchSessions();
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao criar sessão.',
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

  const handleSessionAction = async (sessionId: string, action: string, data?: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch(`/api/telegram/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...data })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: result.message,
        });
        
        if (action === 'restore' && result.data) {
          // Aqui você pode processar os dados restaurados
          console.log('Dados restaurados:', result.data);
        }
        
        fetchSessions();
      } else {
        toast({
          title: 'Erro',
          description: result.message || 'Erro ao executar ação.',
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

  const toggleLogs = (sessionId: string) => {
    setShowLogs(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const addTestLog = async (sessionId: string) => {
    await handleSessionAction(sessionId, 'log', {
      event: 'TEST',
      message: 'Log de teste adicionado',
      details: { timestamp: new Date().toISOString() }
    });
  };

  useEffect(() => {
    fetchSessions();
  }, [credentialId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando sessões...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Sessões</h2>
          <p className="text-gray-600">Gerencie as sessões ativas do Telegram</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createSession}>
            <Play className="h-4 w-4 mr-2" />
            Nova Sessão
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Fechar
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma sessão encontrada</h3>
              <p className="text-gray-600 mb-4">
                Crie uma nova sessão para começar a usar o Telegram.
              </p>
              <Button onClick={createSession}>
                <Play className="h-4 w-4 mr-2" />
                Criar Primeira Sessão
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const statusInfo = statusConfig[session.status];
            const StatusIcon = statusInfo.icon;
            
            return (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        {session.sessionName}
                        <Badge variant={statusInfo.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        {session.hasBackup && (
                          <Badge variant="outline">
                            <Database className="h-3 w-3 mr-1" />
                            Backup
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        ID: {session.id.substring(0, 8)}...
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {session.status === 'ACTIVE' ? (
                        <Button
                          onClick={() => handleSessionAction(session.id, 'deactivate')}
                          variant="outline"
                          size="sm"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleSessionAction(session.id, 'update', { sessionData: {} })}
                          variant="outline"
                          size="sm"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => handleSessionAction(session.id, 'backup', { sessionData: { timestamp: Date.now() } })}
                        variant="outline"
                        size="sm"
                        title="Criar Backup"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      {session.hasBackup && (
                        <Button
                          onClick={() => handleSessionAction(session.id, 'restore')}
                          variant="outline"
                          size="sm"
                          title="Restaurar Backup"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => addTestLog(session.id)}
                        variant="outline"
                        size="sm"
                        title="Adicionar Log de Teste"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <label className="font-medium text-gray-700">Criado em:</label>
                      <p>{formatDate(session.createdAt)}</p>
                    </div>
                    
                    {session.lastActivity && (
                      <div>
                        <label className="font-medium text-gray-700">Última Atividade:</label>
                        <p>{formatDate(session.lastActivity)}</p>
                      </div>
                    )}
                  </div>
                  
                  {session.connectionLogs.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <label className="font-medium text-gray-700">Logs de Conexão:</label>
                        <Button
                          onClick={() => toggleLogs(session.id)}
                          variant="ghost"
                          size="sm"
                        >
                          {showLogs[session.id] ? 'Ocultar' : 'Mostrar'} ({session.connectionLogs.length})
                        </Button>
                      </div>
                      
                      {showLogs[session.id] && (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {session.connectionLogs.slice(-5).map((log, index) => (
                            <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                              <div className="flex justify-between items-start">
                                <span className="font-medium">{log.event}</span>
                                <span className="text-gray-500">
                                  {formatDate(log.timestamp)}
                                </span>
                              </div>
                              <p className="text-gray-700 mt-1">{log.message}</p>
                              {log.details && (
                                <pre className="text-gray-600 mt-1 text-xs">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
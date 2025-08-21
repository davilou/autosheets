'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/ui/navigation';
import CredentialsForm from '@/components/telegram/CredentialsForm';
import CredentialsList from '@/components/telegram/CredentialsList';
import SessionManager from '@/components/telegram/SessionManager';
import { 
  MessageSquare, 
  Key, 
  Activity, 
  Plus, 
  ArrowLeft,
  Shield,
  Zap,
  Users
} from 'lucide-react';

interface TelegramStats {
  credentials: {
    active: number;
    inactive: number;
    total: number;
  };
  sessions: {
    active: number;
  };
  groups: {
    monitored: number;
  };
  activity: {
    messagesProcessed24h: number;
    recentSessions: any[];
  };
}

type ViewMode = 'dashboard' | 'add-credentials' | 'manage-sessions';

export default function TelegramPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Função para buscar estatísticas
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/telegram/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Buscar estatísticas quando o componente montar ou quando refreshTrigger mudar
  useEffect(() => {
    if (viewMode === 'dashboard') {
      fetchStats();
    }
  }, [viewMode, refreshTrigger]);

  const handleAddCredentials = () => {
    setViewMode('add-credentials');
  };

  const handleCredentialsSuccess = () => {
    setViewMode('dashboard');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleManageSessions = (credentialId: string) => {
    setSelectedCredentialId(credentialId);
    setViewMode('manage-sessions');
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setSelectedCredentialId(null);
  };

  const renderHeader = () => {
    switch (viewMode) {
      case 'add-credentials':
        return (
          <div className="flex items-center gap-4 mb-6">
            <Button onClick={handleBackToDashboard} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Adicionar Credenciais</h1>
              <p className="text-gray-600">Configure uma nova conexão com o Telegram</p>
            </div>
          </div>
        );
      
      case 'manage-sessions':
        return (
          <div className="flex items-center gap-4 mb-6">
            <Button onClick={handleBackToDashboard} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gerenciar Sessões</h1>
              <p className="text-gray-600">Controle as sessões ativas do Telegram</p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold">Telegram Dashboard</h1>
              <Badge variant="outline" className="ml-2">
                Beta
              </Badge>
            </div>
            <p className="text-gray-600">
              Gerencie suas credenciais e sessões do Telegram de forma segura
            </p>
          </div>
        );
    }
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'add-credentials':
        return (
          <CredentialsForm
            onSuccess={handleCredentialsSuccess}
            onCancel={handleBackToDashboard}
          />
        );
      
      case 'manage-sessions':
        return selectedCredentialId ? (
          <SessionManager
            credentialId={selectedCredentialId}
            onClose={handleBackToDashboard}
          />
        ) : null;
      
      default:
        return (
          <Tabs defaultValue="credentials" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credentials" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Credenciais
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Visão Geral
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="credentials" className="space-y-6">
              <CredentialsList
                onAddNew={handleAddCredentials}
                refreshTrigger={refreshTrigger}
              />
            </TabsContent>
            
            <TabsContent value="overview" className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Estatísticas do Sistema</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Credenciais Ativas
                    </CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoadingStats ? '...' : (stats?.credentials.active || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Conexões configuradas
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Sessões Ativas
                    </CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoadingStats ? '...' : (stats?.sessions.active || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sessões em execução
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Grupos Monitorados
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoadingStats ? '...' : (stats?.groups.monitored || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Grupos ativos
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recursos Disponíveis</CardTitle>
                  <CardDescription>
                    Funcionalidades do sistema de gerenciamento do Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        Segurança
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Criptografia AES-256-GCM</li>
                        <li>• Armazenamento seguro de credenciais</li>
                        <li>• Validação de API do Telegram</li>
                        <li>• Logs de auditoria</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        Gerenciamento
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Múltiplas sessões por usuário</li>
                        <li>• Reconexão automática</li>
                        <li>• Backup e restauração</li>
                        <li>• Monitoramento em tempo real</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Navigation showBackButton={true} title="Telegram" />
      {renderHeader()}
      {renderContent()}
    </div>
  );
}
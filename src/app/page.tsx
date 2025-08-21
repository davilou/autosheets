'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Settings, User, FileSpreadsheet, Activity } from 'lucide-react';
import { normalizeScore } from '@/lib/utils';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [sheetsData, setSheetsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  // Revalida sessão ao voltar usando bfcache
  useEffect(() => {
    const onPageShow = () => {
      const token = localStorage.getItem('token');
      if (token) {
        verifyToken(token);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.status === 200) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
      } else if (response.status === 401) {
        // Somente remove o token quando de fato não é autorizado
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      } else {
        // Em erros do servidor (5xx) ou outros códigos, preserva o token e estado
        // Opcional: exibir um aviso sem deslogar o usuário
        // toast({ title: 'Aviso', description: 'Não foi possível validar a sessão agora.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      // Não remover o token em erros de rede para evitar logout indevido
    }
  };

  const handleLoginSuccess = (token: string) => {
    setIsAuthenticated(true);
    loadSheetsData();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    setSheetsData([]);
  };

  const loadSheetsData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/sheets/data', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSheetsData(data.data || []);
      } else {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar dados das apostas.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoginForm onSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Auto Sheets</h1>
            <p className="text-gray-600">Sistema de Coleta de Apostas do Telegram</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Bem-vindo, {user?.username || 'Usuário'}
            </span>
            <Button 
              onClick={() => router.push('/profile')} 
              variant="outline" 
              size="sm"
            >
              <User className="h-4 w-4 mr-2" />
              Perfil
            </Button>
            <Button onClick={handleLogout} variant="outline">
              Sair
            </Button>
          </div>
        </div>

        {/* Navegação Rápida */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/telegram')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Telegram</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Gerenciar</div>
              <p className="text-xs text-muted-foreground">
                Credenciais e sessões
              </p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/spreadsheets')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Spreadsheets</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Gerenciar</div>
              <p className="text-xs text-muted-foreground">
                Planilhas e templates
              </p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/monitoring')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monitoramento</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">Gerenciar</div>
              <p className="text-xs text-muted-foreground">
                Grupos e sessões
              </p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/profile')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Configurações</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">Perfil</div>
              <p className="text-xs text-muted-foreground">
                Conta e segurança
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Online</div>
              <p className="text-xs text-muted-foreground">
                Sistema operacional
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Total de Apostas</CardTitle>
              <CardDescription>Apostas coletadas hoje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sheetsData.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Status do Bot</CardTitle>
              <CardDescription>Telegram Bot</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Ativo</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Google Sheets</CardTitle>
              <CardDescription>Sincronização</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Conectado</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados das Apostas</CardTitle>
            <CardDescription>
              Últimas apostas coletadas do Telegram
            </CardDescription>
            <Button onClick={loadSheetsData} disabled={loading}>
              {loading ? 'Carregando...' : 'Atualizar'}
            </Button>
          </CardHeader>
          <CardContent>
            {sheetsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2">BetId</th>
                      <th className="border border-gray-300 p-2">Data</th>
                      <th className="border border-gray-300 p-2">Hora</th>
                      <th className="border border-gray-300 p-2">Jogo</th>
                      <th className="border border-gray-300 p-2">Placar</th>
                      <th className="border border-gray-300 p-2">Mercado</th>
                      <th className="border border-gray-300 p-2">Linha da Aposta</th>
                      <th className="border border-gray-300 p-2">Odd Tipster</th>
                      <th className="border border-gray-300 p-2">Pegou</th>
                      <th className="border border-gray-300 p-2">Odd Real</th>
                      <th className="border border-gray-300 p-2">Stake</th>
+                     <th className="border border-gray-300 p-2">Grupo</th>
                      <th className="border border-gray-300 p-2">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetsData.slice(1).map((row, index) => (
                      <tr key={index}>
                        {row.map((cell: unknown, cellIndex: number) => (
                          <td key={cellIndex} className="border border-gray-300 p-2">
                            {cellIndex === 4 ? normalizeScore(String(cell)) : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Nenhuma aposta encontrada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [sheetsData, setSheetsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      localStorage.removeItem('auth_token');
    }
  };

  const handleLoginSuccess = (token: string) => {
    setIsAuthenticated(true);
    loadSheetsData();
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    setSheetsData([]);
  };

  const loadSheetsData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
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
            <Button onClick={handleLogout} variant="outline">
              Sair
            </Button>
          </div>
        </div>

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
                      <th className="border border-gray-300 p-2">ID</th>
                      <th className="border border-gray-300 p-2">Data/Hora</th>
                      <th className="border border-gray-300 p-2">Username</th>
                      <th className="border border-gray-300 p-2">Tipo</th>
                      <th className="border border-gray-300 p-2">Valor</th>
                      <th className="border border-gray-300 p-2">Odds</th>
                      <th className="border border-gray-300 p-2">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetsData.slice(1).map((row, index) => (
                      <tr key={index}>
                        {row.map((cell: any, cellIndex: number) => (
                          <td key={cellIndex} className="border border-gray-300 p-2">
                            {cell}
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

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, FileSpreadsheet, Plus, ExternalLink, ArrowLeft } from 'lucide-react';
import { BETTING_TEMPLATES } from '@/lib/spreadsheets/templates';
import SpreadsheetManager from '@/components/spreadsheets/SpreadsheetManager';

interface UserSpreadsheet {
  id: string;
  name: string;
  url: string;
  lastModified: string;
  isActive: boolean;
}

export default function SpreadsheetsPage() {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userSpreadsheet, setUserSpreadsheet] = useState<UserSpreadsheet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isReapplying, setIsReapplying] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUserToken(token);
      loadUserSpreadsheet(token);
    }
    setIsLoading(false);
  }, []);

  const loadUserSpreadsheet = async (token: string) => {
    try {
      const response = await fetch('/api/google-drive/user-spreadsheet', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserSpreadsheet(data.spreadsheet);
      }
    } catch (error) {
      console.error('Erro ao carregar planilha do usuário:', error);
    }
  };

  const createBasicSpreadsheet = async () => {
    if (!userToken) {
      setError('Token de usuário não encontrado');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/google-drive/create-spreadsheet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: 'BASIC_BETTING',
          name: 'Minha Planilha de Apostas'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Planilha criada com sucesso!');
        await loadUserSpreadsheet(userToken);
      } else {
        setError(data.error || 'Erro ao criar planilha');
      }
    } catch (error) {
      console.error('Erro ao criar planilha:', error);
      setError('Erro de conexão ao criar planilha');
    } finally {
      setIsCreating(false);
    }
  };

  const reapplyResultadoValidation = async () => {
    if (!userToken || !userSpreadsheet?.id) {
      setError('Não foi possível identificar sua planilha ativa.');
      return;
    }

    setIsReapplying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/spreadsheets/${userSpreadsheet.id}/reapply-validation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ column: 'Resultado' })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setSuccess('Validação da coluna "Resultado" reaplicada com sucesso!');
      } else {
        setError(data.message || data.error || 'Não foi possível reaplicar a validação.');
      }
    } catch (error) {
      console.error('Erro ao reaplicar validação:', error);
      setError('Erro de conexão ao reaplicar a validação.');
    } finally {
      setIsReapplying(false);
    }
  };

  const applyChanges = async () => {
    if (!userToken || !userSpreadsheet?.id) {
      setError('Não foi possível identificar sua planilha ativa.');
      return;
    }

    setIsApplying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/spreadsheets/${userSpreadsheet.id}/apply-changes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success) {
        setSuccess(data.message || 'Alterações aplicadas com sucesso!');
      } else {
        setError(data.message || data.error || 'Não foi possível aplicar as alterações.');
      }
    } catch (error) {
      console.error('Erro ao aplicar alterações:', error);
      setError('Erro de conexão ao aplicar alterações.');
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!userToken) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você precisa estar logado para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <a href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </a>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Planilhas</h1>
            <p className="text-muted-foreground">
              Gerencie suas planilhas de apostas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <FileSpreadsheet className="h-3 w-3" />
            Google Sheets
          </Badge>
        </div>
      </div>

      <Separator />

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Use SpreadsheetManager component */}
      <SpreadsheetManager userToken={userToken} />
    </div>
  );
}
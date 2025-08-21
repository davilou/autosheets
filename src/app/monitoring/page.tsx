'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import Navigation from '@/components/ui/navigation';
import { 
  Activity, 
  Users, 
  MessageSquare, 
  Target, 
  Play, 
  Square, 
  RotateCcw,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  List,
  Send,
  Trash2,
  RefreshCw
} from 'lucide-react';
import GroupManager from '@/components/monitoring/GroupManager';
import PendingBetCard from '@/components/monitoring/PendingBetCard';
import { useToast } from '@/hooks/use-toast';
import { normalizeScore } from '@/lib/utils';
import { formatOddBrazilian } from '@/lib/utils';

// Função para decodificar JWT e extrair userId
function decodeJWT(token: string): { userId?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Erro ao decodificar JWT:', error);
    return null;
  }
}

interface SessionStatus {
  id: string;
  userId: string;
  userName: string;
  credentialId: string;
  phoneNumber: string;
  sessionId: string;
  isActive: boolean;
  lastHeartbeat: string;
  processedMessages: number;
  errorCount: number;
  uptime: number;
  isHealthy: boolean;
}

interface GeneralStats {
  activeSessions: number;
  totalGroups: number;
  queueStats: Record<string, number>;
  recentBets: number;
  performanceMetrics: any;
  timestamp: string;
}

interface QueueItem {
  id: string;
  userId: string;
  sessionId: string;
  messageData: any;
  priority: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  attempts: number;
  maxAttempts: number;
  scheduledFor?: string;
  createdAt: string;
  processedAt?: string;
  errorMessage?: string;
}

interface PendingBet {
  key: string;
  id?: string;
  betData: any;
  createdAt: string;
  status: string;
}

interface QueueData {
  queueItems: QueueItem[];
  pendingBets: PendingBet[];
  stats: {
    totalQueueItems: number;
    totalPendingBets: number;
    queueByStatus: Record<string, number>;
  };
  timestamp: string;
}

export default function MonitoringPage() {
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [stats, setStats] = useState<GeneralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedBets, setSelectedBets] = useState<string[]>([]);
  const [oddSubmissionLoading, setOddSubmissionLoading] = useState(false);
  const { toast } = useToast();

  // Store per-bet input values (odd/stake) keyed by queue item id
  const [betInputs, setBetInputs] = useState<Record<string, { odd?: number; stake?: number }>>({});

  // Toggle selection for a given pending bet
  const toggleSelectBet = (queueId: string) => {
    setSelectedBets((prev) =>
      prev.includes(queueId) ? prev.filter((id) => id !== queueId) : [...prev, queueId]
    );
  };

  // Update stored inputs for a given queue item id
  const updateBetInputs = (queueId: string, values: { odd?: number; stake?: number }) => {
    setBetInputs((prev) => ({
      ...prev,
      [queueId]: { ...prev[queueId], ...values },
    }));
  };

  // Helper to resolve queueId from a PendingBet
  const getQueueId = (bet: PendingBet) => (
    bet.id && bet.id.length > 0
      ? bet.id
      : (bet.key?.startsWith('queue_') ? bet.key.slice(6) : bet.key)
  );

  // Select/Deselect all visible pending bets
  const toggleSelectAll = () => {
    if (!queueData?.pendingBets?.length) {
      setSelectedBets([]);
      return;
    }
    const allIds = queueData.pendingBets.map((b) => getQueueId(b));
    const allSelected = allIds.every((id) => selectedBets.includes(id));
    setSelectedBets(allSelected ? [] : allIds);
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadUserData();
    loadData();
    loadQueueData();
    
    // Atualizar dados a cada 30 segundos
    const interval = setInterval(() => {
      loadData();
      loadQueueData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) return;

      // Carregar dados do usuário
      const userResponse = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success) {
          setUser(userData.user);
        }
      }

      // Carregar credenciais do usuário
      const credentialsResponse = await fetch('/api/telegram/credentials', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (credentialsResponse.ok) {
        const credentialsData = await credentialsResponse.json();
        if (credentialsData.success) {
          setCredentials(credentialsData.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  const loadData = async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Extrair userId do token
      let userId = '';
      if (token) {
        const decoded = decodeJWT(token);
        if (decoded && decoded.userId) {
          userId = decoded.userId;
        }
      }

      const sessionsUrl = userId ? `/api/monitoring/sessions?userId=${userId}` : '/api/monitoring/sessions';
      // Solicitar estatísticas detalhadas para obter queueStats filtrado por usuário
      const statsUrl = userId 
        ? `/api/monitoring/stats?userId=${userId}&includeDetails=true`
        : '/api/monitoring/stats';

      const [sessionsRes, statsRes] = await Promise.all([
        fetch(sessionsUrl, { headers }),
        fetch(statsUrl, { headers })
      ]);

      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();

        // Se estivermos filtrando por usuário e a API retornar dados do usuário,
        // mapeamos para a estrutura esperada pelo UI para evitar exibir totais globais
        if (userId && statsData.user) {
          // Extrair apenas os counts de queueStats detalhado
          const queueCounts: Record<string, number> = statsData.detailed && statsData.detailed.queueStats
            ? Object.fromEntries(
                Object.entries(statsData.detailed.queueStats).map(([status, info]: [string, any]) => [status, (info && typeof info.count === 'number') ? info.count : 0])
              )
            : {};

          const scopedStats: GeneralStats = {
            activeSessions: statsData.user.userSessions || 0,
            totalGroups: statsData.user.activeGroups || 0,
            recentBets: statsData.user.betsDetected || 0,
            queueStats: queueCounts,
            performanceMetrics: statsData.user,
            timestamp: new Date().toISOString()
          };
          setStats(scopedStats);
        } else {
          setStats(statsData.general);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados do monitoramento',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQueueData = async () => {
    try {
      setQueueLoading(true);
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Extrair userId do token
      let userId = '';
      if (token) {
        const decoded = decodeJWT(token);
        if (decoded && decoded.userId) {
          userId = decoded.userId;
        }
      }

      const url = userId ? `/api/monitoring/queue?userId=${userId}` : '/api/monitoring/queue';
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setQueueData(data);
      } else {
        const errorText = await response.text();
        console.error('Erro HTTP ao carregar fila:', response.status, errorText);
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Erro ao carregar dados da fila:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao carregar dados da fila de processamento',
        variant: 'destructive'
      });
    } finally {
      setQueueLoading(false);
    }
  };

  const processPendingBets = async () => {
    try {
      setActionLoading('process-bets');
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      if (!selectedBets || selectedBets.length === 0) {
        toast({ title: 'Aviso', description: 'Nenhuma aposta selecionada.' });
        return;
      }

      // Build items with odd/stake for each selected bet
      const items = selectedBets
        .map((queueId) => ({
          betId: queueId,
          oddReal: betInputs[queueId]?.odd,
          stake: betInputs[queueId]?.stake,
        }))
        .filter((it) => typeof it.oddReal === 'number');

      if (items.length === 0) {
        toast({ title: 'Aviso', description: 'Informe a odd para pelo menos uma aposta selecionada.' });
        return;
      }

      const response = await fetch('/api/monitoring/queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'process_multiple_with_odds',
          items,
        })
      });

      if (response.ok) {
        const result = await response.json();
        const ok = Number(result.processedCount || 0);
        const failures = (Array.isArray(result.results) ? result.results.filter((r: any) => !r.success).length : 0);
        toast({
          title: 'Processamento concluído',
          description: `${ok} apostas processadas com sucesso${failures ? `, ${failures} falharam` : ''}`,
        });
        // Clear selection and inputs for processed items
        setSelectedBets([]);
        setBetInputs((prev) => {
          const clone = { ...prev };
          items.forEach((it) => { delete clone[it.betId]; });
          return clone;
        });
        await loadQueueData();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Falha ao processar apostas');
      }
    } catch (error) {
      console.error('Erro ao processar apostas:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao processar apostas pendentes',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Process selected bets using the tipster odd as real odd (bulk)
  const processSelectedWithTipsterOdds = async () => {
    try {
      setActionLoading('process-tipster-odds');
      if (!queueData?.pendingBets || queueData.pendingBets.length === 0) {
        toast({ title: 'Aviso', description: 'Não há apostas pendentes.' });
        return;
      }
      if (!selectedBets || selectedBets.length === 0) {
        toast({ title: 'Aviso', description: 'Nenhuma aposta selecionada.' });
        return;
      }

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Build items from selected, pulling odd_tipster from bet data
      const items = queueData.pendingBets
        .map((bet) => {
          const qid = getQueueId(bet);
          if (!selectedBets.includes(qid)) return null;
          const data = extractBetDataFromQueue(bet);
          let tipsterOdd = data?.odd_tipster;
          if (typeof tipsterOdd === 'string') {
            tipsterOdd = parseFloat(String(tipsterOdd).replace(',', '.'));
          }
          if (typeof tipsterOdd !== 'number' || isNaN(tipsterOdd)) return null;
          const stake = betInputs[qid]?.stake; // use user-provided stake if any
          return { betId: qid, oddReal: tipsterOdd as number, stake };
        })
        .filter(Boolean) as { betId: string; oddReal: number; stake?: number }[];

      if (!items.length) {
        toast({ title: 'Aviso', description: 'Nenhuma odd do tipster válida encontrada nas selecionadas.' });
        return;
      }

      const response = await fetch('/api/monitoring/queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'process_multiple_with_odds', items })
      });

      if (response.ok) {
        const result = await response.json();
        const ok = Number(result.processedCount || 0);
        const failures = (Array.isArray(result.results) ? result.results.filter((r: any) => !r.success).length : 0);
        toast({
          title: 'Processamento concluído',
          description: `${ok} apostas processadas com sucesso${failures ? `, ${failures} falharam` : ''}`,
        });
        setSelectedBets([]);
        setBetInputs((prev) => {
          const clone = { ...prev };
          items.forEach((it) => { delete clone[it.betId]; });
          return clone;
        });
        await loadQueueData();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Falha ao processar odd do tipster');
      }
    } catch (error) {
      console.error('Erro ao enviar odd do tipster:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao enviar odd do tipster',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete selected bets from queue (bulk)
  const deleteSelectedBets = async () => {
    try {
      setActionLoading('delete-bets');
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      if (!selectedBets || selectedBets.length === 0) {
        toast({ title: 'Aviso', description: 'Nenhuma aposta selecionada para remover.' });
        return;
      }

      const response = await fetch('/api/monitoring/queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'delete_selected',
          betIds: selectedBets,
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({ title: 'Sucesso', description: result.message || 'Itens removidos da fila' });
        // Clear selection and inputs for removed items
        setBetInputs((prev) => {
          const clone = { ...prev };
          selectedBets.forEach((id) => { delete clone[id]; });
          return clone;
        });
        setSelectedBets([]);
        await loadQueueData();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Falha ao remover itens selecionados');
      }
    } catch (error) {
      console.error('Erro ao remover itens selecionados:', error);
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Falha ao remover selecionadas', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const clearQueue = async (status?: string) => {
    try {
      setActionLoading('clear-queue');
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch('/api/monitoring/queue', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Sucesso',
          description: `${result.deleted || 0} itens removidos da fila`
        });
        await loadQueueData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao limpar fila');
      }
    } catch (error) {
      console.error('Erro ao limpar fila:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao limpar fila',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOddSubmission = async (oddReal: number, bet: PendingBet, stake?: number) => {
    try {
      setOddSubmissionLoading(true);
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Determinar corretamente o ID do item na fila
      const queueId = (bet.id && bet.id.length > 0)
        ? bet.id
        : (bet.key?.startsWith('queue_') ? bet.key.slice(6) : bet.key);

      // Enviar a aposta para a planilha com a odd informada
      const response = await fetch('/api/monitoring/queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'process_with_odd',
          betId: queueId,
          oddReal: oddReal,
          stake: stake
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Sucesso',
          description: oddReal > 0 
            ? `Aposta enviada para planilha com odd ${formatOddBrazilian(oddReal)}${stake ? ` e stake ${stake}` : ''}`
            : 'Aposta marcada como não pega'
        });
        await loadQueueData();
      } else {
        const error = await response.json();
        throw new Error(error?.error || error?.message || 'Falha ao processar aposta');
      }
    } catch (error: any) {
      console.error('Erro ao processar aposta:', error);
      toast({
        title: 'Erro',
        description: (error && error.message) ? error.message : 'Falha ao processar aposta',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setOddSubmissionLoading(false);
    }
  };

  const extractBetDataFromQueue = (item: any) => {
    try {
      // Primeiro, verificar se há dados nas colunas específicas da tabela MonitorQueue
      if (item.jogo || item.mercado || item.linhaDaAposta || item.oddTipster) {
        return {
          jogo: item.jogo || 'Processando...',
          mercado: item.mercado || 'Detectando...',
          linha_da_aposta: item.linhaDaAposta || 'Analisando...',
          odd_tipster: item.oddTipster || 'Detectando...',
          placar: item.placar ? normalizeScore(item.placar) : '0-0',
          data: item.data ? new Date(item.data) : new Date(item.createdAt),
          createdAt: item.createdAt
        };
      }
      
      // Segundo, verificar se há dados processados no messageData
      if (item.messageData?.processedData) {
        const { jogo, mercado, linha_da_aposta, odd_tipster, placar, data } = item.messageData.processedData;
        return {
          jogo,
          mercado,
          linha_da_aposta,
          odd_tipster,
          placar: placar ? normalizeScore(placar) : '0-0',
          data: data ? new Date(data) : new Date(item.createdAt),
          createdAt: item.createdAt
        };
      }
      
      // Se é uma aposta pendente (tem betData)
      if ('betData' in item && item.betData) {
        const betData = item.betData;
        
        // Se já tem dados processados diretamente no betData
        if (betData.jogo || betData.mercado || betData.linha_da_aposta) {
          return {
            jogo: betData.jogo || 'Processando...',
            mercado: betData.mercado || 'Detectando...',
            linha_da_aposta: betData.linha_da_aposta || 'Analisando...',
            odd_tipster: betData.odd_tipster || 'Detectando...',
            placar: betData.placar ? normalizeScore(betData.placar) : '0-0',
            data: betData.data ? new Date(betData.data) : new Date(item.createdAt),
            createdAt: item.createdAt
          };
        }
        
        // Se tem messageData dentro do betData
        if (betData.messageData) {
          const messageData = betData.messageData;
          
          // Se já tem dados processados no messageData
          if (messageData.jogo || messageData.mercado || messageData.linha_da_aposta || messageData.odd_tipster) {
            return {
              jogo: messageData.jogo || 'Processando...',
              mercado: messageData.mercado || 'Detectando...',
              linha_da_aposta: messageData.linha_da_aposta || 'Analisando...',
              odd_tipster: messageData.odd_tipster || 'Detectando...',
              placar: messageData.placar ? normalizeScore(messageData.placar) : '0-0',
              data: messageData.data ? new Date(messageData.data) : new Date(item.createdAt),
              createdAt: item.createdAt
            };
          }
          
          // Se tem texto da mensagem original mas ainda não foi processado
          if (messageData.text) {
            return {
              jogo: 'Analisando jogo...',
              mercado: 'Detectando mercado...',
              linha_da_aposta: 'Identificando linha...',
              odd_tipster: 'Extraindo odd...',
              placar: '0-0',
              data: messageData.data ? new Date(messageData.data) : new Date(item.createdAt),
              createdAt: item.createdAt
            };
          }
        }
      }
      
      // Se o item tem messageData diretamente (vem da fila de processamento)
      if (item.messageData) {
        const messageData = item.messageData;
        
        // Se já tem dados processados
        if (messageData.jogo || messageData.mercado || messageData.linha_da_aposta || messageData.odd_tipster) {
          return {
            jogo: messageData.jogo || 'Processando...',
            mercado: messageData.mercado || 'Detectando...',
            linha_da_aposta: messageData.linha_da_aposta || 'Analisando...',
            odd_tipster: messageData.odd_tipster || 'Detectando...',
            placar: messageData.placar ? normalizeScore(messageData.placar) : '0-0',
            data: messageData.data ? new Date(messageData.data) : new Date(item.createdAt),
            createdAt: item.createdAt
          };
        }
        
        // Se tem texto da mensagem original mas ainda não foi processado
        if (messageData.text) {
          return {
            jogo: 'Analisando jogo...',
            mercado: 'Detectando mercado...',
            linha_da_aposta: 'Identificando linha...',
            odd_tipster: 'Extraindo odd...',
            placar: '0-0',
            data: messageData.data ? new Date(messageData.data) : new Date(item.createdAt),
            createdAt: item.createdAt
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao extrair dados da aposta:', error);
      return null;
    }
  };

  const handleStartSession = async (credentialId: string) => {
    setActionLoading(`start-${credentialId}`);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch('/api/monitoring/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ credentialId })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: data.message
        });
        await loadData();
      } else {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao iniciar monitoramento',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopSession = async (credentialId: string) => {
    setActionLoading(`stop-${credentialId}`);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(`/api/monitoring/sessions/${credentialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: data.message
        });
        await loadData();
      } else {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao parar monitoramento',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartSession = async (credentialId: string) => {
    setActionLoading(`restart-${credentialId}`);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(`/api/monitoring/sessions/${credentialId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'restart' })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: data.message
        });
        await loadData();
      } else {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao reiniciar monitoramento',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatUptime = (uptimeMs: number) => {
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatLastHeartbeat = (heartbeat: string) => {
    const diff = Date.now() - new Date(heartbeat).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m atrás`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    </div>
  );
}

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Navigation showBackButton={true} title="Monitoramento Telegram" />
      
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Gerencie grupos monitorados e sessões de usuários
          </p>
        </div>
        <Button 
          onClick={() => {
            loadData();
            loadQueueData();
          }} 
          variant="outline"
          disabled={loading || queueLoading}
        >
          {(loading || queueLoading) ? (
            <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Atualizar Tudo
        </Button>
      </div>

      {/* Estatísticas Gerais */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grupos Monitorados</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGroups}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Apostas (24h)</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentBets}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fila de Processamento</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(stats.queueStats).reduce((sum, count) => sum + count, 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessões Ativas</TabsTrigger>
          <TabsTrigger value="queue">Fila de Processamento</TabsTrigger>
          <TabsTrigger value="groups">Gerenciar Grupos</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sessões de Monitoramento</CardTitle>
              <CardDescription>
                Controle as sessões ativas de monitoramento do Telegram
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma sessão de monitoramento ativa encontrada.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <Card key={session.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={session.isHealthy ? 'default' : 'destructive'}
                              className="flex items-center space-x-1"
                            >
                              {session.isHealthy ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              <span>{session.isHealthy ? 'Saudável' : 'Problema'}</span>
                            </Badge>
                            <span className="font-medium">{session.userName}</span>
                            <span className="text-sm text-muted-foreground">
                              ({session.phoneNumber})
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Mensagens:</span>
                              <span className="ml-1 font-medium">{session.processedMessages}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Erros:</span>
                              <span className="ml-1 font-medium">{session.errorCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Uptime:</span>
                              <span className="ml-1 font-medium">{formatUptime(session.uptime)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Último heartbeat:</span>
                              <span className="ml-1 font-medium">
                                {formatLastHeartbeat(session.lastHeartbeat)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestartSession(session.credentialId)}
                            disabled={actionLoading === `restart-${session.credentialId}`}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reiniciar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStopSession(session.credentialId)}
                            disabled={actionLoading === `stop-${session.credentialId}`}
                          >
                            <Square className="h-4 w-4 mr-1" />
                            Parar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          {/* Estatísticas da Fila */}
          {/* Removido conforme solicitação: Cards de Itens na Fila, Apostas Pendentes e Ações */}
          
          {/* Apostas Pendentes */}
          {queueData?.pendingBets && queueData.pendingBets.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Apostas Pendentes</CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 mr-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        onChange={toggleSelectAll}
                        checked={
                          !!(queueData?.pendingBets?.length &&
                          queueData.pendingBets.every((b) => selectedBets.includes(getQueueId(b))))
                        }
                      />
                      <span className="text-sm">Selecionar todos</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={processSelectedWithTipsterOdds}
                      disabled={actionLoading === 'process-tipster-odds'}
                    >
                      {actionLoading === 'process-tipster-odds' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                      Enviar Odd do Tipster
                      {selectedBets.length > 0 && ` (${selectedBets.length})`}
                    </Button>
                    <Button
                      size="sm"
                      onClick={processPendingBets}
                      disabled={actionLoading === 'process-bets'}
                    >
                      {actionLoading === 'process-bets' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Processar Selecionadas
                      {selectedBets.length > 0 && ` (${selectedBets.length})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={deleteSelectedBets}
                      disabled={actionLoading === 'delete-bets'}
                    >
                      {actionLoading === 'delete-bets' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remover Selecionadas
                      {selectedBets.length > 0 && ` (${selectedBets.length})`}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {queueData.pendingBets.map((bet) => {
                    const queueId = getQueueId(bet);
                    return (
                      <PendingBetCard
                        key={queueId}
                        bet={bet}
                        betData={bet.betData}
                        isLoading={oddSubmissionLoading}
                        selected={selectedBets.includes(queueId)}
                        onToggleSelect={() => toggleSelectBet(queueId)}
                        onInputsChange={(values) => updateBetInputs(queueId, values)}
                        onOddSubmit={(odd) => handleOddSubmission(odd, bet, betInputs[queueId]?.stake)}
                        />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}



          {/* Estado vazio */}
          {(!queueData?.pendingBets || queueData.pendingBets.length === 0) && (
            <Card>
              <CardContent className="p-6 text-center">
                <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma aposta pendente</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={loadQueueData}
                  disabled={queueLoading}
                >
                  {queueLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Carregar Dados
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          {credentials.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Credenciais necessárias</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Você precisa ter pelo menos uma credencial do Telegram conectada para gerenciar grupos.
                </p>
                <Button onClick={() => window.location.href = '/telegram'}>
                  Ir para Credenciais
                </Button>
              </CardContent>
            </Card>
          ) : (
            <GroupManager 
              userId={user?.id}
              credentialId={credentials.find(c => c.status === 'CONNECTED')?.id || credentials[0]?.id}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
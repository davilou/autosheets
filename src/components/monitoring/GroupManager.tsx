'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Plus, 
  Settings, 
  Users, 
  MessageSquare, 
  Activity, 
  Filter,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Hash,
  Clock,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface MonitoredGroup {
  id: string;
  chatId: string;
  chatTitle: string;
  chatType: 'channel' | 'group' | 'supergroup';
  isActive: boolean;
  keywords?: string[];
  excludeKeywords?: string[];
  allowedUsers?: string[];
  blockedUsers?: string[];
  minOdds?: number;
  maxOdds?: number;
  timeFilters?: {
    startTime: string;
    endTime: string;
    days: string[];
  };
  lastActivity?: Date;
  messageCount: number;
  betCount: number;
  createdAt: Date;
}

interface GroupSearchResult {
  id: string;
  title: string;
  type: 'channel' | 'group' | 'supergroup';
  memberCount?: number;
  description?: string;
  isPrivate: boolean;
}

interface GroupManagerProps {
  userId: string;
  credentialId: string;
}

// Pequeno helper para extrair userId do JWT quando necessário
function decodeJWT(token: string): { userId?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export default function GroupManager({ userId, credentialId }: GroupManagerProps) {
  const [monitoredGroups, setMonitoredGroups] = useState<MonitoredGroup[]>([]);
  const [searchResults, setSearchResults] = useState<GroupSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MonitoredGroup | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  // Se não há credentialId, não podemos fazer nada
  if (!credentialId) {
    return (
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
    );
  }

  // Estados para o formulário de configuração
  const [formData, setFormData] = useState({
    keywords: '',
    excludeKeywords: '',
    allowedUsers: '',
    blockedUsers: '',
    minOdds: '',
    maxOdds: '',
    timeFilters: {
      startTime: '00:00',
      endTime: '23:59',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }
  });

  useEffect(() => {
    loadMonitoredGroups();
  }, [userId, credentialId]);

  const loadMonitoredGroups = async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const resolvedUserId = userId || (token ? decodeJWT(token || '')?.userId : undefined);
      if (!resolvedUserId || !credentialId) return;
      setLoading(true);

      const response = await fetch(`/api/monitoring/groups?userId=${resolvedUserId}&credentialId=${credentialId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const groups = await response.json();
        setMonitoredGroups(groups);
      }
    } catch (error) {
      console.error('Erro ao carregar grupos monitorados:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGroups = async () => {
    if (!searchQuery.trim() || !credentialId) return;
    
    try {
      setIsSearching(true);
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
       const response = await fetch(`/api/telegram/search-groups?query=${encodeURIComponent(searchQuery)}&credentialId=${credentialId}`, {
         headers: {
           'Authorization': `Bearer ${token}`
         }
       });
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      } else {
        console.error('Erro na resposta da API:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Detalhes do erro:', errorData);
      }
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addGroupToMonitoring = async (group: GroupSearchResult) => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const resolvedUserId = userId || (token ? decodeJWT(token || '')?.userId : undefined);
      if (!resolvedUserId || !credentialId || !token) {
        console.error('Parâmetros ausentes ao adicionar grupo', {
          hasUserId: !!resolvedUserId,
          hasCredentialId: !!credentialId,
          hasToken: !!token,
        });
        return;
      }

      // Normalizar chatId conforme o formato usado no monitor:
      // - Canais/Supergrupos => "-100" + id
      // - Grupos comuns => "-" + id
      const normalizedChatId = (() => {
        const raw = String(group.id);
        if (group.type === 'channel' || group.type === 'supergroup') {
          if (raw.startsWith('-100')) return raw;
          return `-100${raw.replace(/^-100/, '').replace(/^-/, '')}`;
        }
        if (raw.startsWith('-') && !raw.startsWith('-100')) return raw;
        return `-${raw.replace(/^-100/, '').replace(/^-/, '')}`;
      })();

      const response = await fetch('/api/monitoring/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: resolvedUserId,
          credentialId,
          chatId: normalizedChatId,
          chatTitle: group.title,
          chatType: group.type,
          ...formData,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
          excludeKeywords: formData.excludeKeywords.split(',').map(k => k.trim()).filter(k => k),
          allowedUsers: formData.allowedUsers.split(',').map(u => u.trim()).filter(u => u),
          blockedUsers: formData.blockedUsers.split(',').map(u => u.trim()).filter(u => u),
          minOdds: formData.minOdds ? parseFloat(formData.minOdds) : undefined,
          maxOdds: formData.maxOdds ? parseFloat(formData.maxOdds) : undefined,
        }),
      });

      if (response.ok) {
        await loadMonitoredGroups();
        setIsAddDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Erro ao adicionar grupo:', error);
    }
  };

  const updateGroup = async (groupId: string) => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
       const response = await fetch(`/api/monitoring/groups/${groupId}`, {
         method: 'PUT',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`,
         },
         body: JSON.stringify({
           ...formData,
           keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
           excludeKeywords: formData.excludeKeywords.split(',').map(k => k.trim()).filter(k => k),
           allowedUsers: formData.allowedUsers.split(',').map(u => u.trim()).filter(u => u),
           blockedUsers: formData.blockedUsers.split(',').map(u => u.trim()).filter(u => u),
           minOdds: formData.minOdds ? parseFloat(formData.minOdds) : undefined,
           maxOdds: formData.maxOdds ? parseFloat(formData.maxOdds) : undefined,
         }),
       });

      if (response.ok) {
        await loadMonitoredGroups();
        setIsEditDialogOpen(false);
        setSelectedGroup(null);
        resetForm();
      }
    } catch (error) {
      console.error('Erro ao atualizar grupo:', error);
    }
  };

  const toggleGroupStatus = async (groupId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
       const response = await fetch(`/api/monitoring/groups/${groupId}/toggle`, {
         method: 'PATCH',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`,
         },
         body: JSON.stringify({ isActive }),
       });

      if (response.ok) {
        await loadMonitoredGroups();
      }
    } catch (error) {
      console.error('Erro ao alterar status do grupo:', error);
    }
  };

  const removeGroup = async (groupId: string) => {
    if (!confirm('Tem certeza que deseja remover este grupo do monitoramento?')) return;
    
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
       const response = await fetch(`/api/monitoring/groups/${groupId}`, {
         method: 'DELETE',
         headers: {
           'Authorization': `Bearer ${token}`,
         },
       });

      if (response.ok) {
        await loadMonitoredGroups();
      }
    } catch (error) {
      console.error('Erro ao remover grupo:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      keywords: '',
      excludeKeywords: '',
      allowedUsers: '',
      blockedUsers: '',
      minOdds: '',
      maxOdds: '',
      timeFilters: {
        startTime: '00:00',
        endTime: '23:59',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }
    });
  };

  const openEditDialog = (group: MonitoredGroup) => {
    setSelectedGroup(group);
    setFormData({
      keywords: group.keywords?.join(', ') || '',
      excludeKeywords: group.excludeKeywords?.join(', ') || '',
      allowedUsers: group.allowedUsers?.join(', ') || '',
      blockedUsers: group.blockedUsers?.join(', ') || '',
      minOdds: group.minOdds?.toString() || '',
      maxOdds: group.maxOdds?.toString() || '',
      timeFilters: group.timeFilters || {
        startTime: '00:00',
        endTime: '23:59',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }
    });
    setIsEditDialogOpen(true);
  };

  const getGroupTypeIcon = (type: string) => {
    switch (type) {
      case 'channel': return <Hash className="h-4 w-4" />;
      case 'group': return <Users className="h-4 w-4" />;
      case 'supergroup': return <MessageSquare className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getGroupTypeBadge = (type: string) => {
    const colors = {
      channel: 'bg-blue-100 text-blue-800',
      group: 'bg-green-100 text-green-800',
      supergroup: 'bg-purple-100 text-purple-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Grupos Monitorados</h2>
          <p className="text-muted-foreground">
            Gerencie os grupos e canais que você deseja monitorar para apostas
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Grupo ao Monitoramento</DialogTitle>
              <DialogDescription>
                Busque e configure um grupo ou canal para monitoramento
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Buscar Grupos</TabsTrigger>
                <TabsTrigger value="config">Configurar Filtros</TabsTrigger>
              </TabsList>
              
              <TabsContent value="search" className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Digite o nome do grupo ou canal..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchGroups()}
                  />
                  <Button onClick={searchGroups} disabled={isSearching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {searchResults.map((group) => {
                      const token = (typeof window !== 'undefined') ? (localStorage.getItem('auth_token') || localStorage.getItem('token')) : null;
                      const resolvedUserId = userId || (token ? decodeJWT(token || '')?.userId : undefined);
                       return (
                        <Card key={group.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {getGroupTypeIcon(group.type)}
                              <div>
                                <h4 className="font-medium">{group.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {group.memberCount ? `${group.memberCount} membros` : 'Membros não disponíveis'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getGroupTypeBadge(group.type)}>
                                {group.type}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => addGroupToMonitoring(group)}
                                disabled={!resolvedUserId || !credentialId || !token}
                              >
                                Adicionar
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="config" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
                    <Textarea
                      id="keywords"
                      placeholder="aposta, tip, odd, jogo..."
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="excludeKeywords">Palavras para excluir</Label>
                    <Textarea
                      id="excludeKeywords"
                      placeholder="spam, promoção..."
                      value={formData.excludeKeywords}
                      onChange={(e) => setFormData({ ...formData, excludeKeywords: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="minOdds">Odd mínima</Label>
                    <Input
                      id="minOdds"
                      type="number"
                      step="0.01"
                      placeholder="1.50"
                      value={formData.minOdds}
                      onChange={(e) => setFormData({ ...formData, minOdds: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="maxOdds">Odd máxima</Label>
                    <Input
                      id="maxOdds"
                      type="number"
                      step="0.01"
                      placeholder="10.00"
                      value={formData.maxOdds}
                      onChange={(e) => setFormData({ ...formData, maxOdds: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de grupos monitorados */}
      <div className="grid gap-4">
        {monitoredGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum grupo monitorado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Adicione grupos ou canais para começar a monitorar apostas automaticamente
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Grupo
              </Button>
            </CardContent>
          </Card>
        ) : (
          monitoredGroups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getGroupTypeIcon(group.chatType)}
                    <div>
                      <CardTitle className="text-lg">{group.chatTitle}</CardTitle>
                      <CardDescription>
                        ID: {group.chatId} • Tipo: {group.chatType}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getGroupTypeBadge(group.chatType)}>
                      {group.chatType}
                    </Badge>
                    <Switch
                      checked={group.isActive}
                      onCheckedChange={(checked) => toggleGroupStatus(group.id, checked)}
                    />
                    {group.isActive ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">{group.messageCount}</p>
                      <p className="text-xs text-muted-foreground">Mensagens</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">{group.betCount}</p>
                      <p className="text-xs text-muted-foreground">Apostas</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {group.lastActivity ? new Date(group.lastActivity).toLocaleDateString() : 'Nunca'}
                      </p>
                      <p className="text-xs text-muted-foreground">Última atividade</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {group.isActive ? 'Ativo' : 'Inativo'}
                      </p>
                      <p className="text-xs text-muted-foreground">Status</p>
                    </div>
                  </div>
                </div>
                
                {/* Filtros configurados */}
                {(group.keywords?.length || group.excludeKeywords?.length || group.minOdds || group.maxOdds) && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="flex items-center space-x-2 text-sm">
                      <Filter className="h-4 w-4" />
                      <span className="font-medium">Filtros:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.keywords?.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          +{keyword}
                        </Badge>
                      ))}
                      {group.excludeKeywords?.map((keyword, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          -{keyword}
                        </Badge>
                      ))}
                      {group.minOdds && (
                        <Badge variant="outline" className="text-xs">
                          Min: {group.minOdds}
                        </Badge>
                      )}
                      {group.maxOdds && (
                        <Badge variant="outline" className="text-xs">
                          Max: {group.maxOdds}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(group)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeGroup(group.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Configurações do Grupo</DialogTitle>
            <DialogDescription>
              {selectedGroup?.chatTitle}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-keywords">Palavras-chave</Label>
                <Textarea
                  id="edit-keywords"
                  placeholder="aposta, tip, odd, jogo..."
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-excludeKeywords">Palavras para excluir</Label>
                <Textarea
                  id="edit-excludeKeywords"
                  placeholder="spam, promoção..."
                  value={formData.excludeKeywords}
                  onChange={(e) => setFormData({ ...formData, excludeKeywords: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-minOdds">Odd mínima</Label>
                <Input
                  id="edit-minOdds"
                  type="number"
                  step="0.01"
                  value={formData.minOdds}
                  onChange={(e) => setFormData({ ...formData, minOdds: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-maxOdds">Odd máxima</Label>
                <Input
                  id="edit-maxOdds"
                  type="number"
                  step="0.01"
                  value={formData.maxOdds}
                  onChange={(e) => setFormData({ ...formData, maxOdds: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => selectedGroup && updateGroup(selectedGroup.id)}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
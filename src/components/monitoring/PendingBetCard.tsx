'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { normalizeScore, formatOddBrazilian } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PendingBetCardProps {
  bet: any;
  betData: any;
  onOddSubmit: (oddValue: number, bet: any, stake?: number) => Promise<void>;
  isLoading: boolean;
  // New props for bulk selection and input tracking
  selected?: boolean;
  onToggleSelect?: () => void;
  onInputsChange?: (values: { odd?: number; stake?: number }) => void;
}

export default function PendingBetCard({ bet, betData, onOddSubmit, isLoading, selected = false, onToggleSelect, onInputsChange }: PendingBetCardProps) {
  const [oddValue, setOddValue] = useState('');
  const [stakeValue, setStakeValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const propagateInputs = (oddStr: string, stakeStr: string) => {
    // Try to parse numbers, allow empty
    const oddNum = oddStr.trim() === '' ? undefined : parseFloat(oddStr.replace(',', '.'));
    const stakeNum = stakeStr.trim() === '' ? undefined : parseFloat(stakeStr.replace(',', '.'));
    if (onInputsChange) {
      onInputsChange({
        odd: isNaN(Number(oddNum)) ? undefined : oddNum,
        stake: isNaN(Number(stakeNum)) ? undefined : stakeNum,
      });
    }
  };

  const handleSubmit = async () => {
    if (!oddValue || oddValue.trim() === '') {
      toast({
        title: 'Erro',
        description: 'Por favor, digite uma odd válida.',
        variant: 'destructive',
      });
      return;
    }

    const numericOdd = parseFloat(oddValue.replace(',', '.'));
    if (isNaN(numericOdd) || numericOdd < 0) {
      toast({
        title: 'Erro',
        description: 'A odd deve ser um número válido maior ou igual a 0.',
        variant: 'destructive',
      });
      return;
    }

    let numericStake: number | undefined = undefined;
    if (stakeValue.trim() !== '') {
      const parsed = parseFloat(stakeValue.replace(',', '.'));
      if (isNaN(parsed) || parsed < 0) {
        toast({
          title: 'Erro',
          description: 'O stake deve ser um número válido maior ou igual a 0.',
          variant: 'destructive',
        });
        return;
      }
      numericStake = parsed;
    }

    try {
      setSubmitting(true);
      await onOddSubmit(numericOdd, bet, numericStake);
      setOddValue('');
      setStakeValue('');
      // propagate cleared inputs
      propagateInputs('', '');
      toast({
        title: 'Sucesso',
        description: 'Odd informada com sucesso!',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao processar a odd. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue || dateValue === 'Data não disponível') {
      return 'Data não disponível';
    }
    
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'Data não disponível';
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  return (
    <div className="flex items-start justify-between p-3 border rounded">
      <div className="flex items-start mr-3 pt-1">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={!!selected}
          onChange={() => onToggleSelect && onToggleSelect()}
          disabled={isLoading}
        />
      </div>
      <div className="flex-1">
        {betData ? (
          <>
            <p className="font-medium">{betData.jogo}</p>
            <p className="text-sm text-muted-foreground">
              Linha - {betData.linha_da_aposta}
            </p>
            <p className="text-sm text-muted-foreground">
              Odd Tipster: {typeof betData.odd_tipster === 'number' ? formatOddBrazilian(betData.odd_tipster) : betData.odd_tipster}
            </p>
            {betData.stake !== undefined && (
              <p className="text-sm text-muted-foreground">Stake: {betData.stake}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Placar: {normalizeScore(betData.placar || '0-0')}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(betData.data || betData.createdAt || bet.createdAt)}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Processando aposta...</p>
            <p className="text-sm text-muted-foreground">
              Aguardando análise dos dados
            </p>
          </>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Digite a odd"
          value={oddValue}
          onChange={(e) => { setOddValue(e.target.value); propagateInputs(e.target.value, stakeValue); }}
          onKeyPress={handleKeyPress}
          className="w-24 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!betData || isLoading || submitting}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Stake (opcional)"
          value={stakeValue}
          onChange={(e) => { setStakeValue(e.target.value); propagateInputs(oddValue, e.target.value); }}
          onKeyPress={handleKeyPress}
          className="w-28 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!betData || isLoading || submitting}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!betData || isLoading || submitting || !oddValue}
        >
          {submitting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            'Enviar'
          )}
        </Button>
      </div>
    </div>
  );
}
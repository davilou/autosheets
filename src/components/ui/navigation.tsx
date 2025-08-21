'use client';

import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NavigationProps {
  showBackButton?: boolean;
  backUrl?: string;
  title?: string;
}

export default function Navigation({ showBackButton = false, backUrl, title }: NavigationProps) {
  const router = useRouter();

  const handleHomeClick = () => {
    router.push('/');
  };

  const handleBackClick = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-white shadow-sm rounded-lg">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackClick}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        )}
        {title && (
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleHomeClick}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>

      </div>
    </div>
  );
}
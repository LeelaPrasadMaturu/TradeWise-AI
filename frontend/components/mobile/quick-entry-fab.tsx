'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickTradeSheet } from './quick-trade-sheet';

export function QuickEntryFAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 lg:hidden"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Quick trade entry</span>
      </Button>
      
      <QuickTradeSheet open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

export default QuickEntryFAB;

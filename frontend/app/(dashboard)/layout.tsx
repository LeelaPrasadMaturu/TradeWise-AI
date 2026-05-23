'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { QuickEntryFAB } from '@/components/mobile/quick-entry-fab';
import api from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!api.isAuthenticated()) {
      router.push('/login');
      router.refresh();
    }
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>
      <QuickEntryFAB />
    </div>
  );
}

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import AuthGuard from '@/components/helpers/auth-guard';
import { WorkspaceProvider } from '@/components/providers/workspace-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <WorkspaceProvider>
        <div className="flex min-h-screen w-full flex-col bg-background lg:flex-row">
          <Sidebar />
          <div className="flex w-full flex-col">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </WorkspaceProvider>
    </AuthGuard>
  );
}

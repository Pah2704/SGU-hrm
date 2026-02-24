'use client';

import { useMemo } from 'react';
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

type ManagementTab = {
  value: string;
  label: string;
  content: React.ReactNode;
  hidden?: boolean;
};

type ManagementModuleShellProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs: ManagementTab[];
  queryKey?: string;
  defaultTab?: string;
};

export function ManagementModuleShell({
  title,
  description,
  actions,
  tabs,
  queryKey = 'tab',
  defaultTab,
}: ManagementModuleShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => !tab.hidden),
    [tabs],
  );

  const activeTab = useMemo(() => {
    const requestedTab = searchParams.get(queryKey);
    if (requestedTab && visibleTabs.some((tab) => tab.value === requestedTab)) {
      return requestedTab;
    }

    if (defaultTab && visibleTabs.some((tab) => tab.value === defaultTab)) {
      return defaultTab;
    }

    return visibleTabs[0]?.value ?? '';
  }, [defaultTab, queryKey, searchParams, visibleTabs]);

  const onTabChange = (nextTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(queryKey, nextTab);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ?? null}
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

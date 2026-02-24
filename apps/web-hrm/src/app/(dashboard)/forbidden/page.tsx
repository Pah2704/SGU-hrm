'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Khong co quyen truy cap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Tai khoan hien tai khong co quyen mo chuc nang nay. Vui long lien he
            quan tri he thong neu ban cho rang day la nham lan.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/employees">Ve trang nhan su</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/leaves">Ve trang nghi phep</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

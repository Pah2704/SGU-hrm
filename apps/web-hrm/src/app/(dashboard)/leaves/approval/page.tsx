'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaveApprovalRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leaves/manage?tab=approval');
  }, [router]);

  return null;
}

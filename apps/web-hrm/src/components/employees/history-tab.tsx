'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, FileText, Briefcase } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DecisionFormModal } from './decision-form-modal';
import type { DecisionRecord, DecisionFormMode } from './decision-form-modal';
import api from '@/lib/api';
import { format } from 'date-fns';

type HistoryTabVariant = 'process' | 'appointment';

interface HistoryTabProps {
  employeeId?: string;
  canView?: boolean;
  canManage?: boolean;
}

interface SharedHistoryTabProps extends HistoryTabProps {
  variant: HistoryTabVariant;
}

const HISTORY_VARIANT_COPY: Record<
  HistoryTabVariant,
  {
    cardTitle: string;
    addButtonLabel: string;
    emptyMessage: string;
    noPermissionMessage: string;
    modalMode: DecisionFormMode;
  }
> = {
  process: {
    cardTitle: 'Quá trình công tác',
    addButtonLabel: 'Thêm quá trình công tác',
    emptyMessage: 'Chưa có quá trình công tác',
    noPermissionMessage: 'Bạn chưa có quyền xem quá trình công tác.',
    modalMode: 'process',
  },
  appointment: {
    cardTitle: 'Bổ nhiệm / Điều động',
    addButtonLabel: 'Thêm quyết định bổ nhiệm / điều động',
    emptyMessage: 'Chưa có quyết định bổ nhiệm / điều động',
    noPermissionMessage: 'Bạn chưa có quyền xem quyết định bổ nhiệm / điều động.',
    modalMode: 'appointment',
  },
};

const historyFetcher = (url: string) => api.get(url).then((res) => res.data);

function SharedHistoryTab({
  employeeId: employeeIdProp,
  canView = true,
  canManage = false,
  variant,
}: SharedHistoryTabProps) {
  const params = useParams<{ id?: string }>();
  const employeeId = employeeIdProp ?? params.id;
  const copy = useMemo(() => HISTORY_VARIANT_COPY[variant], [variant]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<
    DecisionRecord | undefined
  >(undefined);

  const { data: decisions, mutate } = useSWR<DecisionRecord[]>(
    canView && employeeId ? `/employees/${employeeId}/decisions` : null,
    historyFetcher,
  );

  const getStatusBadge = (decision: DecisionRecord) => {
    if (!decision.endDate) {
      return <Badge className="bg-[var(--status-approved)] text-white">Đương nhiệm</Badge>;
    }

    return <Badge variant="secondary">Đã kết thúc</Badge>;
  };

  const openCreateModal = () => {
    if (!canManage) {
      return;
    }
    setSelectedDecision(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (decision: DecisionRecord) => {
    if (!canManage) {
      return;
    }
    setSelectedDecision(decision);
    setIsModalOpen(true);
  };

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{copy.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            {copy.noPermissionMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{copy.cardTitle}</CardTitle>
          {canManage ? (
            <Button onClick={openCreateModal}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {copy.addButtonLabel}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Chức vụ / Đơn vị</TableHead>
                <TableHead>Số QĐ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tài liệu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!decisions ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : decisions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-4 text-center text-muted-foreground"
                  >
                    {copy.emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                decisions.map((decision) => (
                  <TableRow
                    key={decision.id}
                    className={canManage ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={() => openEditModal(decision)}
                  >
                    <TableCell className="font-medium">
                      {format(new Date(decision.appointDate), 'dd/MM/yyyy')}
                      {' - '}
                      {decision.endDate
                        ? format(new Date(decision.endDate), 'dd/MM/yyyy')
                        : 'Nay'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1 font-semibold">
                          <Briefcase className="h-3 w-3" />
                          {decision.position?.name || 'Không xác định'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {decision.isPrimary
                            ? '(Chức vụ chính)'
                            : '(Kiêm nhiệm)'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {decision.decisionNo || '-'}
                      {decision.decisionDate ? (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(decision.decisionDate), 'dd/MM/yyyy')}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{getStatusBadge(decision)}</TableCell>
                    <TableCell className="text-right">
                      {decision.documentUrl ? (
                        <a
                          href={decision.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {employeeId ? (
        <DecisionFormModal
          mode={copy.modalMode}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          employeeId={employeeId}
          decision={selectedDecision}
          onSuccess={() => mutate()}
        />
      ) : null}
    </div>
  );
}

export function WorkProcessTab(props: HistoryTabProps) {
  return <SharedHistoryTab {...props} variant="process" />;
}

export function AppointmentManagementTab(props: HistoryTabProps) {
  return <SharedHistoryTab {...props} variant="appointment" />;
}

// Backward compatibility for existing imports.
export function HistoryTab(props: HistoryTabProps) {
  return <WorkProcessTab {...props} />;
}


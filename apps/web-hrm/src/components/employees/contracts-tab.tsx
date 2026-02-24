
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { contractsService, Contract, ContractType } from '@/services/contracts.service';
import { format } from 'date-fns';
import { useState } from 'react';
import { ContractFormModal } from './contract-form-modal';
import { toast } from 'sonner';

interface ContractsTabProps {
  employeeId: string;
}

export function ContractsTab({ employeeId }: ContractsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts', employeeId],
    queryFn: () => contractsService.getByEmployee(employeeId),
  });

  const deleteMutation = useMutation({
    mutationFn: contractsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', employeeId] });
      toast.success('Đã xóa hợp đồng thành công');
    },
    onError: () => {
      toast.error('Không thể xóa hợp đồng', {
        description: 'Vui lòng thử lại.',
      });
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa hợp đồng này?')) {
      deleteMutation.mutate(id);
    }
  };

  const mapTypeLabel = (type: ContractType) => {
    switch (type) {
      case ContractType.HDLD_XAC_DINH: return 'HĐLĐ Xác định thời hạn';
      case ContractType.HDLD_KHONG_XAC_DINH: return 'HĐLĐ Không xác định';
      case ContractType.THU_VIEC: return 'Thử việc';
      case ContractType.HDLV: return 'Hợp đồng làm việc';
      default: return type;
    }
  };

  if (isLoading) return <div>Đang tải hợp đồng...</div>;

  return (
    <div className="space-y-4">
      {/* ... header ... */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách Hợp đồng</h3>
        <Button onClick={() => { setSelectedContract(undefined); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Thêm hợp đồng
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Số HĐ</TableHead>
              <TableHead>Loại HĐ</TableHead>
              <TableHead>Ngày ký</TableHead>
              <TableHead>Ngày hiệu lực</TableHead>
              <TableHead>Ngày hết hạn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Chưa có hợp đồng nào.
                </TableCell>
              </TableRow>
            )}
            {contracts?.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                <TableCell>{mapTypeLabel(contract.contractType)}</TableCell>
                <TableCell>{contract.signedDate ? format(new Date(contract.signedDate), 'dd/MM/yyyy') : '-'}</TableCell>
                <TableCell>{format(new Date(contract.startDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{contract.endDate ? format(new Date(contract.endDate), 'dd/MM/yyyy') : 'Vô thời hạn'}</TableCell>
                <TableCell>
                  <Badge variant="default">
                    {contract.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedContract(contract); setIsModalOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(contract.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <ContractFormModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        employeeId={employeeId}
        initialData={selectedContract}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['contracts', employeeId] })}
      />
    </div>
  );
}

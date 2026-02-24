"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { isAxiosError } from "axios";
import api from "@/lib/api";
import { TreeUnitDto } from "@/types";
import UnitTree from "@/components/org/unit-tree";
import { UnitFormModal } from "@/components/org/unit-form-modal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url: string) => api.get(url).then((res) => res.data);

const ADMIN_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

type UnitFormValues = {
  code: string;
  name: string;
  shortName?: string;
  unitType: string;
  status?: string;
  parentId?: string;
  sortOrder?: number;
};

type StoredUser = {
  roles?: Array<{
    name?: string;
  }>;
};

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
};

const isAdminUser = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as StoredUser;
  return (
    user.roles?.some((role) => {
      const roleName = role?.name ?? "";
      return ADMIN_ROLES.has(roleName);
    }) ?? false
  );
};

const mutateUnits = () => {
  void mutate("/units");
  void mutate("/units?includeSoftDeleted=true");
};

export default function OrganizationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<TreeUnitDto | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) {
      setIsAdmin(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser) as unknown;
      setIsAdmin(isAdminUser(parsedUser));
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin && showSoftDeleted) {
      setShowSoftDeleted(false);
    }
  }, [isAdmin, showSoftDeleted]);

  const unitsUrl =
    isAdmin && showSoftDeleted ? "/units?includeSoftDeleted=true" : "/units";

  const { data, error, isLoading } = useSWR<TreeUnitDto[]>(unitsUrl, fetcher);

  const rootUnit = data?.find((u) => u.code === "SGU");

  const visibleUnits = useMemo(() => {
    const rootChildren = rootUnit?.children ?? [];
    if (isAdmin && showSoftDeleted) {
      return rootChildren;
    }

    const filterVisibleTree = (nodes: TreeUnitDto[]): TreeUnitDto[] =>
      nodes
        .filter((node) => !node.isDeleted)
        .map((node) => ({
          ...node,
          children: filterVisibleTree(node.children ?? []),
        }));

    return filterVisibleTree(rootChildren);
  }, [isAdmin, rootUnit?.children, showSoftDeleted]);

  const handleAdd = (pId?: string) => {
    const resolvedParentId = pId || rootUnit?.id || null;
    if (!resolvedParentId) {
      toast.error("Không tìm thấy đơn vị gốc SGU");
      return;
    }

    setSelectedUnit(null);
    setParentId(resolvedParentId);
    setIsModalOpen(true);
  };

  const handleEdit = (unit: TreeUnitDto) => {
    setSelectedUnit(unit);
    setParentId(unit.parentId);
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: UnitFormValues) => {
    try {
      if (selectedUnit) {
        const updatePayload = {
          name: values.name,
          shortName: values.shortName || undefined,
          unitType: values.unitType,
          status: values.status,
          parentId: values.parentId || undefined,
          sortOrder: values.sortOrder,
        };
        await api.patch(`/units/${selectedUnit.id}`, updatePayload);
        toast.success("Đã cập nhật đơn vị thành công");
      } else {
        const createPayload = {
          code: values.code,
          name: values.name,
          shortName: values.shortName || undefined,
          unitType: values.unitType,
          parentId: parentId || undefined,
          sortOrder: values.sortOrder,
        };
        await api.post("/units", createPayload);
        toast.success("Đã thêm đơn vị thành công");
      }
      mutateUnits();
    } catch (err: unknown) {
      if (!isAxiosError(err) || err.response?.status !== 409) {
        console.error(err);
      }
      toast.error("Không thể lưu đơn vị", {
        description: getApiErrorMessage(err, "Không thể lưu đơn vị"),
      });
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa mềm đơn vị này?")) {
      return;
    }

    try {
      await api.delete(`/units/${id}`);
      toast.success("Đã xóa mềm đơn vị thành công");
      mutateUnits();
    } catch (err: unknown) {
      toast.error("Không thể xóa đơn vị", {
        description: getApiErrorMessage(err, "Không thể xóa đơn vị"),
      });
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền xóa vĩnh viễn đơn vị");
      return;
    }

    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn đơn vị đã xóa mềm này?")) {
      return;
    }

    try {
      await api.delete(`/units/${id}/hard`);
      toast.success("Đã xóa vĩnh viễn đơn vị thành công");
      mutateUnits();
    } catch (err: unknown) {
      toast.error("Không thể xóa vĩnh viễn đơn vị", {
        description: getApiErrorMessage(err, "Không thể xóa vĩnh viễn đơn vị"),
      });
    }
  };

  if (error) {
    return (
      <div className="p-6 text-red-500">Lỗi tải dữ liệu: {error.message}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tổ chức nhân sự</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý cơ cấu tổ chức và đơn vị trực thuộc.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={showSoftDeleted}
                onCheckedChange={(checked) =>
                  setShowSoftDeleted(checked === true)
                }
              />
              Hiển thị đơn vị đã xóa mềm
            </label>
          )}
          <Button onClick={() => handleAdd()} disabled={!rootUnit}>
            <Plus className="mr-2 h-4 w-4" /> Thêm đơn vị mới
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cây sơ đồ tổ chức</CardTitle>
          <CardDescription>
            Hiển thị cấu trúc đơn vị trong hệ thống.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Đang tải...</div>
          ) : (
            <UnitTree
              units={visibleUnits}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onHardDelete={isAdmin ? handleHardDelete : undefined}
              canHardDelete={isAdmin && showSoftDeleted}
            />
          )}
        </CardContent>
      </Card>

      <UnitFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialData={selectedUnit}
        parentId={parentId}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

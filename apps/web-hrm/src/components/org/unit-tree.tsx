"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash,
  Trash2,
} from "lucide-react";
import { TreeUnitDto } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface UnitTreeProps {
  units: TreeUnitDto[];
  onAdd: (parentId: string) => void;
  onEdit: (unit: TreeUnitDto) => void;
  onDelete: (id: string) => void;
  onHardDelete?: (id: string) => void;
  canHardDelete?: boolean;
}

function UnitNode({
  node,
  onAdd,
  onEdit,
  onDelete,
  onHardDelete,
  canHardDelete,
}: {
  node: TreeUnitDto;
  onAdd: (id: string) => void;
  onEdit: (u: TreeUnitDto) => void;
  onDelete: (id: string) => void;
  onHardDelete?: (id: string) => void;
  canHardDelete?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSoftDeleted = node.isDeleted || Boolean(node.deletedAt);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div className="group flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-4" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              isSoftDeleted && "text-muted-foreground line-through",
            )}
          >
            {node.name}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({node.code})
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isSoftDeleted && node.status === "ACTIVE" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAdd(node.id)}
              aria-label="Add child unit"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}

          {!isSoftDeleted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEdit(node)}
              aria-label="Edit unit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}

          {!isSoftDeleted && node.children.length === 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500 hover:text-red-600"
              onClick={() => onDelete(node.id)}
              aria-label="Soft delete unit"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}

          {canHardDelete &&
            onHardDelete &&
            isSoftDeleted &&
            node.children.length === 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-700 hover:text-red-800"
                onClick={() => onHardDelete(node.id)}
                aria-label="Hard delete unit"
              >
                <Trash className="h-3 w-3" />
              </Button>
            )}
        </div>
      </div>

      {hasChildren && (
        <CollapsibleContent className="ml-3 border-l border-border pl-6">
          {node.children.map((child) => (
            <UnitNode
              key={child.id}
              node={child}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onHardDelete={onHardDelete}
              canHardDelete={canHardDelete}
            />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export default function UnitTree({
  units,
  onAdd,
  onEdit,
  onDelete,
  onHardDelete,
  canHardDelete,
}: UnitTreeProps) {
  if (!units || units.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu đơn vị
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {units.map((root) => (
        <UnitNode
          key={root.id}
          node={root}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onHardDelete={onHardDelete}
          canHardDelete={canHardDelete}
        />
      ))}
    </div>
  );
}

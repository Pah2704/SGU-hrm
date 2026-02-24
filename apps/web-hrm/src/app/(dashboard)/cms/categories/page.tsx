import { FolderTree } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CmsCategoriesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderTree className="h-4 w-4" />
          Quan ly danh muc
        </CardTitle>
        <CardDescription>
          Placeholder cho module danh muc website cua phong To chuc Can bo.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Se bo sung CRUD danh muc, sap xep menu, va phan quyen hien thi theo role.
      </CardContent>
    </Card>
  );
}

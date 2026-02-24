import { FolderKanban } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CmsFormsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="h-4 w-4" />
          Quan ly bieu mau
        </CardTitle>
        <CardDescription>
          Placeholder cho module bieu mau cua phong To chuc Can bo.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Se bo sung upload, phan loai va trang thai su dung bieu mau o slice CMS.
      </CardContent>
    </Card>
  );
}

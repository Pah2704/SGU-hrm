import { FileText } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CmsDocumentsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Quan ly van ban
        </CardTitle>
        <CardDescription>
          Placeholder cho module luu tru va phat hanh van ban noi bo.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Se bo sung CRUD van ban, danh muc va quyen truy cap theo role o slice CMS.
      </CardContent>
    </Card>
  );
}

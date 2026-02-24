import { Newspaper } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CmsPostsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-4 w-4" />
          Quan ly bai viet
        </CardTitle>
        <CardDescription>
          Placeholder cho module dang bai/tin tuc cua phong TCCB.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Se bo sung danh sach bai viet, editor, va workflow duyet dang o slice CMS.
      </CardContent>
    </Card>
  );
}

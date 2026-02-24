import Link from 'next/link';
import { FileText, FolderKanban, FolderTree, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CmsHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quan tri TCCB</h1>
        <p className="text-sm text-muted-foreground">
          Khong gian quan tri website phong To chuc Can bo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="h-4 w-4" />
              Bai viet
            </CardTitle>
            <CardDescription>Quan ly tin bai tren cong thong tin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/cms/posts">Mo quan ly bai viet</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Van ban
            </CardTitle>
            <CardDescription>Quan ly danh muc van ban phong TCCB.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/cms/documents">Mo quan ly van ban</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-4 w-4" />
              Danh muc
            </CardTitle>
            <CardDescription>Quan ly danh muc hien thi tren website TCCB.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/cms/categories">Mo quan ly danh muc</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              Bieu mau
            </CardTitle>
            <CardDescription>Quan ly va phat hanh bieu mau su dung noi bo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/cms/forms">Mo quan ly bieu mau</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

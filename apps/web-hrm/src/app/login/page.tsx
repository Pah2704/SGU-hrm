'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { isAxiosError } from 'axios';
import api from '@/lib/api';
import { getAuthSnapshot, hasAnyRole } from '@/lib/authz';
import {
  getDefaultWorkspace,
  getWorkspaceLandingPath,
  setStoredWorkspace,
} from '@/lib/workspaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';

type LoginFormValues = {
  email: string;
  password: string;
};

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
};

const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

const getLoginErrorMessage = (error: unknown) => {
  if (isAxiosError<{ message?: string }>(error)) {
    if (!error.response) {
      return 'Không thể kết nối tới API. Vui lòng kiểm tra backend đang chạy ở cổng 3001.';
    }

    return error.response?.data?.message || error.message || 'Không thể đăng nhập.';
  }

  if (error instanceof Error) {
    return error.message || 'Không thể đăng nhập.';
  }

  return 'Vui lòng kiểm tra lại thông tin.';
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<LoginFormValues>();

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');

      const res = await api.post<LoginResponse>('/auth/login', data);
      localStorage.setItem('accessToken', res.data.accessToken);

      const profileRes = await api.get('/users/me');
      localStorage.setItem('user', JSON.stringify(profileRes.data));

      const snapshot = getAuthSnapshot();
      const defaultWorkspace = getDefaultWorkspace(snapshot);
      const landingPath = defaultWorkspace
        ? getWorkspaceLandingPath(defaultWorkspace)
        : hasAnyRole(snapshot.roles, PRIVILEGED_ROLES)
          ? '/overview'
          : '/my-profile';

      if (defaultWorkspace) {
        setStoredWorkspace(defaultWorkspace);
      }

      toast.success('Đã đăng nhập thành công');
      router.replace(landingPath);
    } catch (error: unknown) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      console.error(error);
      toast.error('Không thể đăng nhập', {
        description: getLoginErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <div className="flex justify-center pt-6">
          <Image
            src="/images/logo-sgu.png"
            alt="Logo Đại học Sài Gòn"
            width={64}
            height={64}
            className="rounded-full"
          />
        </div>
        <CardHeader className="pt-4">
          <CardTitle className="text-center text-2xl">Đăng nhập</CardTitle>
          <CardDescription>
            Nhập email và mật khẩu để truy cập hệ thống HRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@sgu.edu.vn"
                required
                {...register('email')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                required
                {...register('password')}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground">
          SGU HRM System v1.0
        </CardFooter>
      </Card>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getApiErrorMessage, useAuth } from '@/components/auth/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { GOOGLE_AUTH_URL } from '@/lib/config';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await register(values);
      router.push('/');
    } catch (error) {
      form.setError('root', { message: getApiErrorMessage(error) });
    }
  };

  return (
    <AuthShell description="Create your workspace and start building a clearer money picture." title="Start your ledger.">
        <div className="space-y-5">
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Taylor Rivera" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormMessage>{form.formState.errors.root?.message}</FormMessage>
              <Button className="w-full" disabled={form.formState.isSubmitting} size="lg" type="submit">
                {form.formState.isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </Form>

          <a href={GOOGLE_AUTH_URL} className="block">
            <Button className="w-full" size="lg" variant="outline">
              Continue with Google
            </Button>
          </a>

          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link className="font-medium text-foreground underline underline-offset-4" href="/login">
              Sign in
            </Link>
          </p>
        </div>
    </AuthShell>
  );
}

import Cookies from 'js-cookie';
import { redirect } from 'next/navigation';

export function getToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return Cookies.get('token');
}

export function setToken(token: string): void {
  Cookies.set('token', token, { expires: 7 });
}

export function removeToken(): void {
  Cookies.remove('token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function requireAuth(): void {
  if (!isAuthenticated()) {
    redirect('/login');
  }
}

export function redirectIfAuthenticated(): void {
  if (isAuthenticated()) {
    redirect('/');
  }
}

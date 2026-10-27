import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';

const KEY = 'wa_nalizer_token';

export const authToken = signal<string | null>(localStorage.getItem(KEY));

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
  authToken.set(token);
}

// Adjunta el token a cada request y, si el backend responde 401 (token vencido/inválido), vuelve al login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = authToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !req.url.endsWith('/api/login')) setAuthToken(null);
      return throwError(() => e);
    }),
  );
};

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import * as bcrypt from 'bcryptjs';

const AUTH_KEY = 'travel_organizer_auth';
const ALLOWED_USERNAME = 'namarab';
const ALLOWED_PASSWORD_HASH =
  '$2b$10$3jjHqeIOS7Jy6Oov9oly1eEF6jE2sg/sDpM4Wz1mSwvDkOBITrMke';

interface StoredAuth {
  loggedIn: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticated = false;

  constructor(private router: Router) {
    const stored = this.loadStoredAuth();
    this.isAuthenticated = stored.loggedIn;
  }

  private loadStoredAuth(): StoredAuth {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return { loggedIn: false };
      const parsed = JSON.parse(raw) as StoredAuth;
      return { loggedIn: !!parsed?.loggedIn };
    } catch {
      return { loggedIn: false };
    }
  }

  private persistAuth(loggedIn: boolean): void {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ loggedIn }));
    } catch {}
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  login(username: string, password: string): boolean {
    const trimmedUsername = username?.trim();
    if (trimmedUsername !== ALLOWED_USERNAME) return false;
    if (!password?.trim()) return false;

    const passwordMatch = bcrypt.compareSync(password, ALLOWED_PASSWORD_HASH);
    if (!passwordMatch) return false;

    this.isAuthenticated = true;
    this.persistAuth(true);
    return true;
  }

  logout(): void {
    this.isAuthenticated = false;
    this.persistAuth(false);
    this.router.navigate(['/login']);
  }
}

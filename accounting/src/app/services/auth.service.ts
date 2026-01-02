import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

export interface User {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email?: string;
  phone?: string;
  studentId?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private tokenKey = 'authToken';
  private userKey = 'currentUser';
  private apiUrl = '/api/auth';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // استرجاع المستخدم من التخزين المحلي
    const savedUser = localStorage.getItem(this.userKey);
    this.currentUserSubject = new BehaviorSubject<User | null>(
      savedUser ? JSON.parse(savedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  public get isLoggedIn(): boolean {
    const token = this.token;
    if (!token) return false;

    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  public get userRole(): string | null {
    return this.currentUserValue?.role || null;
  }

  // تسجيل الدخول
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { username, password })
      .pipe(
        map(response => {
          if (response.token && response.user) {
            // حفظ التوكن والمستخدم
            localStorage.setItem(this.tokenKey, response.token);
            localStorage.setItem(this.userKey, JSON.stringify(response.user));
            this.currentUserSubject.next(response.user);
          }
          return response;
        }),
        catchError(error => {
          this.clearAuth();
          return throwError(() => error);
        })
      );
  }

  // تسجيل دخول الطالب
  studentLogin(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`/api/student/login`, { username, password })
      .pipe(
        map(response => {
          if (response.token && response.user) {
            localStorage.setItem(this.tokenKey, response.token);
            localStorage.setItem(this.userKey, JSON.stringify(response.user));
            this.currentUserSubject.next(response.user);
          }
          return response;
        }),
        catchError(error => {
          this.clearAuth();
          return throwError(() => error);
        })
      );
  }

  // تسجيل الخروج
  logout(): void {
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  // تغيير كلمة المرور
  changePassword(data: ChangePasswordRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, data)
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  // تغيير كلمة مرور الطالب
  changeStudentPassword(data: ChangePasswordRequest): Observable<any> {
    return this.http.post('/api/student/change-password', data)
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  // تسجيل مستخدم جديد
  register(userData: RegisterRequest): Observable<any> {
    return this.http.post('/api/users', userData)
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  // إعادة تعيين كلمة المرور
  resetPassword(userId: string, newPassword: string): Observable<any> {
    return this.http.put(`/api/student-accounts/${userId}/reset-password`, { password: newPassword })
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  // الحصول على رأس التصريح للطلبات المحمية
  getAuthHeaders(): { [header: string]: string } {
    const token = this.token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // التحقق من الصلاحيات
  hasRole(requiredRoles: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.role) return false;
    return requiredRoles.includes(user.role);
  }

  // التحقق من صلاحية مستخدم محدد
  canActivate(roles: string[]): boolean {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return false;
    }

    const user = this.currentUserValue;
    if (roles && roles.length > 0 && (!user || !roles.includes(user.role))) {
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }

  // تحديث بيانات المستخدم
  updateUserProfile(updates: Partial<User>): void {
    const currentUser = this.currentUserValue;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      localStorage.setItem(this.userKey, JSON.stringify(updatedUser));
      this.currentUserSubject.next(updatedUser);
    }
  }

  // التحقق من صلاحية التوكن
  validateToken(): Observable<boolean> {
    const token = this.token;
    if (!token) {
      return new Observable(observer => {
        observer.next(false);
        observer.complete();
      });
    }

    return this.http.get(`${this.apiUrl}/validate`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => true),
      catchError(() => {
        this.clearAuth();
        return throwError(() => false);
      })
    );
  }

  // تسجيل دخول تلقائي (إذا كان هناك توكن)
  autoLogin(): boolean {
    if (this.isLoggedIn && this.currentUserValue) {
      return true;
    }
    this.clearAuth();
    return false;
  }

  // مسح بيانات المصادقة
  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }

  // تحديث التوكن
  refreshToken(): Observable<LoginResponse> {
    const token = this.token;
    if (!token) {
      return throwError(() => new Error('No token available'));
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh`, { token })
      .pipe(
        map(response => {
          if (response.token && response.user) {
            localStorage.setItem(this.tokenKey, response.token);
            localStorage.setItem(this.userKey, JSON.stringify(response.user));
            this.currentUserSubject.next(response.user);
          }
          return response;
        }),
        catchError(error => {
          this.clearAuth();
          return throwError(() => error);
        })
      );
  }

  // الحصول على معلومات الطالب
  getStudentInfo(): Observable<any> {
    return this.http.get('/api/student/data', {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  // التحقق من حالة التسجيل للطالب
  checkRegistrationStatus(studentId: string, parentPhone: string): Observable<any> {
    return this.http.post('/api/student/status', { studentId, parentPhone })
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  // إرسال رابط إعادة تعيين كلمة المرور
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post('/api/auth/forgot-password', { email })
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  // التحقق من صلاحية التوكن
  isTokenExpired(): boolean {
    const token = this.token;
    if (!token) return true;

    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  // الحصول على وقت انتهاء التوكن
  getTokenExpiration(): Date | null {
    const token = this.token;
    if (!token) return null;

    try {
      const decoded: any = jwtDecode(token);
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  // التحقق مما إذا كان باقي على انتهاء التوكن أقل من وقت محدد
  shouldRefreshToken(minutes: number = 5): boolean {
    const expiration = this.getTokenExpiration();
    if (!expiration) return false;

    const now = new Date();
    const diff = expiration.getTime() - now.getTime();
    return diff < (minutes * 60 * 1000);
  }

  // إنهاء الجلسة من جميع الأجهزة
  logoutFromAllDevices(): Observable<any> {
    return this.http.post('/api/auth/logout-all', {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => {
        this.clearAuth();
      }),
      catchError(error => {
        this.clearAuth();
        return throwError(() => error);
      })
    );
  }

  // الحصول على تاريخ آخر دخول
  getLastLogin(): Date | null {
    const user = this.currentUserValue;
    if (!user) return null;

    try {
      const token = this.token;
      if (!token) return null;

      const decoded: any = jwtDecode(token);
      return new Date(decoded.iat * 1000);
    } catch (error) {
      return null;
    }
  }

  // إضافة سجل للنشاط
  logActivity(activity: string): Observable<any> {
    return this.http.post('/api/auth/activity-log', { 
      activity,
      timestamp: new Date().toISOString()
    }, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => throwError(() => error))
    );
  }
}
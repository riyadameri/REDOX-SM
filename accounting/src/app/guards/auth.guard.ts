import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const currentUser = this.authService.currentUserValue;
    const requiredRoles = route.data['roles'] as Array<string>;

    if (currentUser) {
      if (requiredRoles && requiredRoles.indexOf(currentUser.role) === -1) {
        this.router.navigate(['/']);
        return false;
      }
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
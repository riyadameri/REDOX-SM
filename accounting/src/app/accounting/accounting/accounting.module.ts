import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AccountingComponent } from './accounting.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FinancialTransactionsComponent } from './financial-transactions/financial-transactions.component';
import { BudgetsComponent } from './budgets/budgets.component';
import { ExpenseManagementComponent } from './expense-management/expense-management.component';
import { ReportsComponent } from './reports/reports.component';
import { SchoolFeesComponent } from './school-fees/school-fees.component';
import { TeacherPaymentsComponent } from './teacher-payments/teacher-payments.component';
import { StaffSalariesComponent } from './staff-salaries/staff-salaries.component';
import { InvoicesComponent } from './invoices/invoices.component';
import { TeacherCommissionsComponent } from './teacher-commissions/teacher-commissions.component';

@NgModule({
  declarations: [
    AccountingComponent,
    DashboardComponent,
    FinancialTransactionsComponent,
    BudgetsComponent,
    ExpenseManagementComponent,
    ReportsComponent,
    SchoolFeesComponent,
    TeacherPaymentsComponent,
    StaffSalariesComponent,
    InvoicesComponent,
    TeacherCommissionsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild([
      {
        path: '',
        component: AccountingComponent,
        children: [
          { path: 'dashboard', component: DashboardComponent },
          { path: 'transactions', component: FinancialTransactionsComponent },
          { path: 'budgets', component: BudgetsComponent },
          { path: 'expenses', component: ExpenseManagementComponent },
          { path: 'reports', component: ReportsComponent },
          { path: 'school-fees', component: SchoolFeesComponent },
          { path: 'teacher-payments', component: TeacherPaymentsComponent },
          { path: 'staff-salaries', component: StaffSalariesComponent },
          { path: 'invoices', component: InvoicesComponent },
          { path: 'teacher-commissions', component: TeacherCommissionsComponent },
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
      }
    ])
  ]
})
export class AccountingModule { }
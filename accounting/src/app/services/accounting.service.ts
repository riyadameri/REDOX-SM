import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccountingService {
  private apiUrl = '/api/accounting';

  constructor(private http: HttpClient) {}

  // الدخل اليومي
  getDailyIncome(date?: string): Observable<any> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get(`${this.apiUrl}/daily-income`, { params });
  }

  // الدخل الأسبوعي
  getWeeklyIncome(): Observable<any> {
    return this.http.get(`${this.apiUrl}/weekly-income`);
  }

  // الدخل الشهري
  getMonthlyIncome(): Observable<any> {
    return this.http.get(`${this.apiUrl}/monthly-income`);
  }

  // إحصائيات اليوم
  getTodayStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/today-stats`);
  }

  // الرصيد الحالي
  getCurrentBalance(): Observable<any> {
    return this.http.get(`${this.apiUrl}/balance`);
  }

  // المعاملات المالية
  getTransactions(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/all-transactions`, { params });
  }

  // إضافة معاملة
  addTransaction(transaction: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions`, transaction);
  }

  // رسوم التسجيل
  getSchoolFees(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/school-fees`, { params });
  }

  paySchoolFee(feeId: string, paymentData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/school-fees/${feeId}/pay`, paymentData);
  }

  // عمولات الأساتذة
  getTeacherCommissions(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/teacher-commissions`, { params });
  }

  payTeacherCommission(commissionId: string, paymentData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/teacher-commissions/${commissionId}/pay`, paymentData);
  }

  // الميزانيات
  getBudgets(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/budgets`, { params });
  }

  createBudget(budget: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/budgets`, budget);
  }

  updateBudget(budgetId: string, budget: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/budgets/${budgetId}`, budget);
  }

  // المصروفات
  getExpenses(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/expenses`, { params });
  }

  addExpense(expense: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/expenses`, expense);
  }

  // الفواتير
  getInvoices(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/invoices`, { params });
  }

  generateInvoice(type: string, id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/invoices/generate/${type}/${id}`);
  }

  // التقارير
  getFinancialReport(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/financial`, { params });
  }

  getDetailedReport(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/detailed`, { params });
  }

  // مدفوعات الأساتذة
  getTeacherPayments(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/teacher-payments`, { params });
  }

  payTeacherPayment(paymentId: string, paymentData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/teacher-payments/${paymentId}/pay`, paymentData);
  }

  // رواتب الموظفين
  getStaffSalaries(params?: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/staff-salaries`, { params });
  }

  payStaffSalary(salaryId: string, paymentData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/staff-salaries/${salaryId}/pay`, paymentData);
  }

  // التقرير المالي
  getSummaryReport(): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/summary`);
  }

  // التحويلات الجماعية
  payAllSalaries(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/teachers/pay-all-salaries`, data);
  }

  // تصدير التقارير
  exportReport(format: string, params: any): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/reports/export/${format}`, {
      params,
      responseType: 'blob'
    });
  }
}
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  dailyIncome: number = 0;
  monthlyIncome: number = 0;
  totalBalance: number = 0;
  pendingPayments: number = 0;
  pendingCommissions: number = 0;
  recentTransactions: any[] = [];
  isLoading: boolean = true;
  summaryData: any = {};

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading = true;
    
    // الدخل اليومي
    this.http.get('/api/accounting/daily-income').subscribe(
      (response: any) => {
        this.dailyIncome = response.dailyIncome || 0;
      }
    );

    // الدخل الشهري
    this.http.get('/api/accounting/monthly-income').subscribe(
      (response: any) => {
        this.monthlyIncome = response.totalMonthlyIncome || 0;
      }
    );

    // إحصائيات اليوم
    this.http.get('/api/accounting/today-stats').subscribe(
      (response: any) => {
        this.summaryData = response;
      }
    );

    // الرصيد الحالي
    this.http.get('/api/accounting/balance').subscribe(
      (response: any) => {
        this.totalBalance = response.balance || 0;
      }
    );

    // المعاملات الأخيرة
    this.http.get('/api/accounting/transactions?limit=10').subscribe(
      (response: any) => {
        this.recentTransactions = response;
        this.isLoading = false;
        this.initCharts();
      }
    );
  }

  initCharts() {
    // رسم بياني للدخل الشهري
    const incomeCtx = document.getElementById('incomeChart') as HTMLCanvasElement;
    if (incomeCtx) {
      new Chart(incomeCtx, {
        type: 'line',
        data: {
          labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
          datasets: [{
            label: 'الدخل الشهري',
            data: [12000, 19000, 15000, 25000, 22000, 30000],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            borderWidth: 2,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
              rtl: true
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return value.toLocaleString() + ' د.ج';
                }
              }
            }
          }
        }
      });
    }

    // رسم بياني للمصروفات
    const expenseCtx = document.getElementById('expenseChart') as HTMLCanvasElement;
    if (expenseCtx) {
      new Chart(expenseCtx, {
        type: 'doughnut',
        data: {
          labels: ['رواتب', 'إيجار', 'مرافق', 'مصاريف تشغيل', 'أخرى'],
          datasets: [{
            data: [40, 20, 15, 15, 10],
            backgroundColor: [
              '#3498db',
              '#2ecc71',
              '#e74c3c',
              '#f39c12',
              '#9b59b6'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
              rtl: true
            }
          }
        }
      });
    }
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('ar-DZ') + ' د.ج';
  }

  getTransactionTypeIcon(type: string): string {
    return type === 'income' ? 'fa-arrow-down text-success' : 'fa-arrow-up text-danger';
  }
}
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountingService } from '../../services/accounting.service';
import { StudentService } from '../../services/student.service';

@Component({
  selector: 'app-financial-transactions',
  templateUrl: './financial-transactions.component.html',
  styleUrls: ['./financial-transactions.component.css']
})
export class FinancialTransactionsComponent implements OnInit {
  transactions: any[] = [];
  filteredTransactions: any[] = [];
  students: any[] = [];
  transactionForm: FormGroup;
  isFormVisible = false;
  isLoading = false;
  searchTerm = '';
  
  // فلترة
  selectedType = '';
  selectedCategory = '';
  startDate = '';
  endDate = '';
  
  // أنواع المعاملات
  transactionTypes = [
    { value: 'income', label: 'إيراد' },
    { value: 'expense', label: 'مصروف' }
  ];
  
  // تصنيفات المعاملات
  categories = [
    { value: 'tuition', label: 'رسوم دراسية' },
    { value: 'registration', label: 'رسوم تسجيل' },
    { value: 'salary', label: 'رواتب' },
    { value: 'rent', label: 'إيجار' },
    { value: 'utilities', label: 'مرافق' },
    { value: 'supplies', label: 'مستلزمات' },
    { value: 'other', label: 'أخرى' }
  ];

  constructor(
    private fb: FormBuilder,
    private accountingService: AccountingService,
    private studentService: StudentService
  ) {
    this.transactionForm = this.fb.group({
      type: ['income', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      description: ['', Validators.required],
      category: ['', Validators.required],
      student: [''],
      reference: [''],
      date: [new Date().toISOString().split('T')[0]]
    });
  }

  ngOnInit() {
    this.loadTransactions();
    this.loadStudents();
  }

  loadTransactions() {
    this.isLoading = true;
    const params: any = {};
    
    if (this.selectedType) params.type = this.selectedType;
    if (this.selectedCategory) params.category = this.selectedCategory;
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;
    
    this.accountingService.getTransactions(params).subscribe({
      next: (response) => {
        this.transactions = response;
        this.filteredTransactions = [...this.transactions];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading transactions:', error);
        this.isLoading = false;
      }
    });
  }

  loadStudents() {
    this.studentService.getAllStudents().subscribe({
      next: (students) => {
        this.students = students;
      }
    });
  }

  onSubmit() {
    if (this.transactionForm.valid) {
      const transactionData = this.transactionForm.value;
      
      this.accountingService.addTransaction(transactionData).subscribe({
        next: (response) => {
          this.loadTransactions();
          this.transactionForm.reset({
            type: 'income',
            date: new Date().toISOString().split('T')[0]
          });
          this.isFormVisible = false;
        },
        error: (error) => {
          console.error('Error adding transaction:', error);
        }
      });
    }
  }

  filterTransactions() {
    let filtered = this.transactions;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.description?.toLowerCase().includes(term) ||
        t.category?.toLowerCase().includes(term) ||
        t.student?.name?.toLowerCase().includes(term)
      );
    }
    
    this.filteredTransactions = filtered;
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedCategory = '';
    this.startDate = '';
    this.endDate = '';
    this.filteredTransactions = [...this.transactions];
  }

  getTotal(type: string): number {
    return this.filteredTransactions
      .filter(t => t.type === type)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('ar-DZ') + ' د.ج';
  }
}
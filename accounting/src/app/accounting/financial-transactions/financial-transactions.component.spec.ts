import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancialTransactionsComponent } from './financial-transactions.component';

describe('FinancialTransactionsComponent', () => {
  let component: FinancialTransactionsComponent;
  let fixture: ComponentFixture<FinancialTransactionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialTransactionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinancialTransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

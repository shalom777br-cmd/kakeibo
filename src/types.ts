export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  item: string;
  category: string;
  type: TransactionType;
  amount: number;
}

export interface SummaryData {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

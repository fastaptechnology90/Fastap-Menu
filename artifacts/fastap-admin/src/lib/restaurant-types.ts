export type SopDoc = {
  id: string;
  title: string;
  category: string;
  version: string;
  updatedAt: string;
  mandatory: boolean;
  readBy: number;
  totalStaff: number;
  pages: number;
};

export type TrainingVideo = {
  id: string;
  title: string;
  duration: string;
  category: string;
  views: number;
  completions: number;
  level: string;
  thumbnail: string;
  videoUrl?: string;
};

export type ChecklistItem = {
  id: string;
  task: string;
  mandatory: boolean;
  role: string;
};

export type BackupRow = {
  id: string;
  name: string;
  type: string;
  size: string;
  status: string;
  checksum: string;
  duration: string;
  tables: number;
  records: number;
  createdAt: string;
};

export type SettlementRow = {
  id: string;
  amount: number;
  utr: string;
  bank: string;
  date: string;
  status: string;
  mode: string;
};

export type OnlineTxnRow = {
  id: string;
  type: string;
  amount: number;
  gateway: string;
  utr: string;
  tax: number;
  commission: number;
  net: number;
  time: string;
  status: string;
};

export type CashLedgerRow = {
  date: string;
  type: string;
  amount: number;
  note: string;
  balance: number;
};

export type RecentBill = {
  id: string;
  table: string;
  amount: number;
  method: string;
  time: string;
  status: string;
};

export type MetricHistoryPoint = {
  time: string;
  cpu: number;
  mem: number;
  rps: number;
  latency: number;
};

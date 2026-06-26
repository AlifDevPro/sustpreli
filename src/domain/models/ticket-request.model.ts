import type {
  Channel,
  Language,
  TransactionStatus,
  TransactionType,
  UserType,
} from '../enums';

export interface Transaction {
  transactionId: string;
  timestamp: string;
  type: TransactionType;
  amount: number;
  counterparty: string;
  status: TransactionStatus;
}

export interface TicketRequest {
  ticketId: string;
  complaint: string;
  language?: Language;
  channel?: Channel;
  userType?: UserType;
  campaignContext?: string;
  transactionHistory: Transaction[];
  metadata?: Record<string, unknown>;
}

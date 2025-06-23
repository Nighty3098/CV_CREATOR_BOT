export type OrderType = "example" | "review" | "full";

export interface Order {
  id: string;
  userId: number;
  username?: string;
  type: OrderType;
  status: "pending" | "paid" | "in_progress" | "done";
  fileId?: string;
  fileName?: string;
  position?: string;
  vacancyUrl?: string;
  comment?: string;
  delivery: "telegram" | "email";
  email?: string;
  upsell?: boolean;
  price: number;
  createdAt: Date;
  paidAt?: Date;
  adminComment?: string;
  resultFileId?: string;
  resultMessageId?: number;
  interviewTime?: string;
  interviewReminded24h?: boolean;
  interviewReminded1h?: boolean;
}

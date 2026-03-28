export type Plan = "monthly" | "yearly";

export type SubscriptionStatus = "active" | "inactive" | "lapsed" | "canceled";

export type DrawMode = "random" | "algorithmic";

export type ClaimStatus = "pending" | "approved" | "rejected";

export type PayoutStatus = "pending" | "paid";

export type Role = "subscriber" | "admin";

export interface Subscription {
  plan: Plan;
  status: SubscriptionStatus;
  renewalDate: string;
  amount: number;
  charityPercent: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  charityId: string | null;
  subscription: Subscription;
}

export interface Charity {
  id: string;
  name: string;
  slug: string;
  description: string;
  featured: boolean;
  upcomingEvent?: string;
}

export interface GolfScore {
  id: string;
  userId: string;
  score: number;
  playedAt: string;
  createdAt: string;
}

export interface Draw {
  id: string;
  monthKey: string;
  mode: DrawMode;
  numbers: number[];
  published: boolean;
  simulatedAt?: string;
  publishedAt?: string;
}

export interface DrawEntry {
  id: string;
  drawId: string;
  userId: string;
  numbers: number[];
  matches: number;
}

export interface PrizePool {
  drawId: string;
  total: number;
  fiveMatch: number;
  fourMatch: number;
  threeMatch: number;
  rolloverIn: number;
  rolloverOut: number;
}

export interface WinnerClaim {
  id: string;
  drawEntryId: string;
  userId: string;
  proofUrl?: string;
  claimStatus: ClaimStatus;
  payoutStatus: PayoutStatus;
}
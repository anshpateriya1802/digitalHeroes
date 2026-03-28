"use client";

import { useState } from "react";
import { AdminActions } from "@/app/components/admin-actions";
import { WinnerVerificationPanel } from "@/app/components/winner-verification-panel";
import { CharityManagementPanel } from "@/app/components/charity-management-panel";
import { SubscriptionManagementPanel } from "@/app/components/subscription-management-panel";
import { PrizePoolPanel } from "@/app/components/prize-pool-panel";
import { AdminUserManagementPanel } from "@/app/components/admin-user-management-panel";
import { Plan, SubscriptionStatus } from "@/lib/types";

interface Subscriber {
  id: string;
  name: string;
  email: string;
  subscription: {
    plan: Plan;
    status: SubscriptionStatus;
  };
}

interface AdminDashboardProps {
  initialUsers: Subscriber[];
}

type Tab = "operations" | "users" | "winners" | "charities" | "subscriptions" | "prizes";

export function AdminDashboard({ initialUsers }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("operations");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "operations", label: "Draw & Scores", icon: "⚙️" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "winners", label: "Draw Claims", icon: "🏆" },
    { id: "charities", label: "Charities", icon: "❤️" },
    { id: "subscriptions", label: "Subscriptions", icon: "💳" },
    { id: "prizes", label: "Prize Pools", icon: "💰" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-(--brand) text-white"
                  : "border border-(--card-border) bg-white hover:-translate-y-0.5 hover:bg-(--surface-hover)"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "operations" && <AdminActions initialSubscribers={initialUsers} />}

        {activeTab === "users" && <AdminUserManagementPanel />}

        {activeTab === "winners" && <WinnerVerificationPanel />}

        {activeTab === "charities" && <CharityManagementPanel />}

        {activeTab === "subscriptions" && <SubscriptionManagementPanel />}

        {activeTab === "prizes" && <PrizePoolPanel />}
      </div>
    </div>
  );
}

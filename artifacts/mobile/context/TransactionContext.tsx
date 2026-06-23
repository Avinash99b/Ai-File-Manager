import React, { createContext, useContext, useState, useCallback } from "react";

export interface ParsedAction {
  id: string;
  action: "rename" | "delete" | "move" | "copy" | "create" | "code_execute";
  mode: "file_name" | "regex" | "pattern" | "code";
  target: string;
  params: {
    replacement?: string;
    dest?: string;
    code?: string;
    content?: string;
  };
  isSafe: boolean;
}

export interface ActionPlan {
  transactionId: string;
  actionsSummary: string;
  actions: ParsedAction[];
  requiresCode: boolean;
  hasRiskyActions: boolean;
  estimatedTimeMs: number;
}

interface TransactionContextType {
  pendingPlan: ActionPlan | null;
  setPendingPlan: (plan: ActionPlan | null) => void;
  isApprovalVisible: boolean;
  setIsApprovalVisible: (v: boolean) => void;
  lastApprovedId: string | null;
  setLastApprovedId: (id: string | null) => void;
}

const TransactionContext = createContext<TransactionContextType | null>(null);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [pendingPlan, setPendingPlan] = useState<ActionPlan | null>(null);
  const [isApprovalVisible, setIsApprovalVisible] = useState(false);
  const [lastApprovedId, setLastApprovedId] = useState<string | null>(null);

  return (
    <TransactionContext.Provider
      value={{
        pendingPlan,
        setPendingPlan,
        isApprovalVisible,
        setIsApprovalVisible,
        lastApprovedId,
        setLastApprovedId,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransaction must be used within TransactionProvider");
  return ctx;
}

import { useState, useMemo } from "react";
import { MOCK_CASES } from "../data/mockData";

/**
 * useSearch — searches cases by case_id, from_account, to_account, transaction_id
 * Returns grouped results: { cases, accounts, transactions }
 */
export function useSearch() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return null;

    const q = query.toLowerCase();

    const matchedCases = MOCK_CASES.filter(
      (c) =>
        c.case_id.toLowerCase().includes(q) ||
        c.typology?.toLowerCase().includes(q)
    );

    // Deduplicate accounts from cases
    const accountsSeen = new Set();
    const matchedAccounts = [];
    MOCK_CASES.forEach((c) => {
      [
        { id: c.from_account, bank: c.from_bank, role: "Sender" },
        { id: c.to_account, bank: c.to_bank, role: "Receiver" },
      ].forEach(({ id, bank, role }) => {
        if (id.toLowerCase().includes(q) && !accountsSeen.has(id)) {
          accountsSeen.add(id);
          const linkedCase = MOCK_CASES.find(
            (mc) => mc.from_account === id || mc.to_account === id
          );
          matchedAccounts.push({ id, bank, role, case_id: linkedCase?.case_id });
        }
      });
    });

    const matchedTransactions = MOCK_CASES.filter((c) =>
      c.transaction_id.toLowerCase().includes(q)
    ).map((c) => ({
      txn_id: c.transaction_id,
      amount: c.amount,
      risk_level: c.risk_level,
      typology: c.typology,
      case_id: c.case_id,
    }));

    const hasResults =
      matchedCases.length > 0 ||
      matchedAccounts.length > 0 ||
      matchedTransactions.length > 0;

    return hasResults
      ? { cases: matchedCases, accounts: matchedAccounts, transactions: matchedTransactions }
      : { cases: [], accounts: [], transactions: [] };
  }, [query]);

  return { query, setQuery, results };
}

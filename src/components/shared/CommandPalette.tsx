import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, User, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getNavItems, type NavItem } from "../layout/navConfig";
import { employeeService } from "../../services/employeeService";
import { type Employee } from "../../types/employee";

interface FlatNavItem {
  label: string;
  href: string;
  section?: string;
}

interface PaletteResult {
  type: "page" | "employee";
  label: string;
  sublabel?: string;
  href: string;
}

const MAX_RESULTS = 8;

/**
 * Global command palette (Ctrl/Cmd+K).
 * - Navigates to any page the current role can access.
 * - For HR / super admins, also searches employees by name, email, or title.
 */
export const CommandPalette: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSearchEmployees =
    user?.role === "super_admin" || user?.role === "hr_admin";

  // Flatten role-aware nav items (parents + sub-items) into searchable pages.
  const pages = useMemo<FlatNavItem[]>(() => {
    const items = getNavItems(user?.role);
    const flat: FlatNavItem[] = [];
    const walk = (list: NavItem[], section?: string) => {
      list.forEach((item) => {
        flat.push({ label: t(item.nameKey), href: item.href, section });
        if (item.subItems) walk(item.subItems, t(item.nameKey));
      });
    };
    walk(items);
    // De-duplicate hrefs (parent and first sub-item can share a route).
    const seen = new Set<string>();
    return flat.filter((p) => {
      if (seen.has(p.href)) return false;
      seen.add(p.href);
      return true;
    });
  }, [user?.role, t]);

  // Lazily load the employee list the first time the palette opens.
  useEffect(() => {
    if (!open || !canSearchEmployees || employees !== null || !user?.companyId)
      return;
    let cancelled = false;
    employeeService
      .getEmployees(user.companyId)
      .then((list) => {
        if (!cancelled) setEmployees(list);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canSearchEmployees, employees, user?.companyId]);

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase();
    const pageResults: PaletteResult[] = pages
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .map((p) => ({
        type: "page" as const,
        label: p.label,
        sublabel: p.section,
        href: p.href,
      }));

    const employeeResults: PaletteResult[] =
      q && canSearchEmployees && employees
        ? employees
            .filter(
              (e) =>
                e.name?.toLowerCase().includes(q) ||
                e.email?.toLowerCase().includes(q) ||
                e.jobTitle?.toLowerCase().includes(q)
            )
            .slice(0, MAX_RESULTS)
            .map((e) => ({
              type: "employee" as const,
              label: e.name,
              sublabel: e.jobTitle || e.email,
              href: `/people/employees/${e.uid}`,
            }))
        : [];

    return [...pageResults.slice(0, MAX_RESULTS), ...employeeResults];
  }, [query, pages, employees, canSearchEmployees]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const select = useCallback(
    (result: PaletteResult) => {
      navigate(result.href);
      close();
    },
    [navigate, close]
  );

  // Global keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        close();
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
  }, [close]);

  useEffect(() => {
    if (open) {
      // Wait for the panel to mount before focusing.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep the active row in range as results change.
  const boundedIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[boundedIndex]) {
      e.preventDefault();
      select(results[boundedIndex]);
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("commandPalette.title")}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.12 }}
            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-slate-100">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder={
                  canSearchEmployees
                    ? t("commandPalette.placeholderAdmin")
                    : t("commandPalette.placeholder")
                }
                className="w-full py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <kbd className="hidden sm:block text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500 text-center">
                  {t("commandPalette.noResults")}
                </p>
              ) : (
                results.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.href}`}
                    onClick={() => select(result)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      idx === boundedIndex
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {result.type === "employee" ? (
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="flex-1 truncate font-medium">
                      {result.label}
                    </span>
                    {result.sublabel && (
                      <span className="text-xs text-slate-400 truncate max-w-[40%]">
                        {result.sublabel}
                      </span>
                    )}
                    {idx === boundedIndex && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
              <span>{t("commandPalette.hintNavigate")}</span>
              <span>{t("commandPalette.hintSelect")}</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;

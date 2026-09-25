import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import PlayerToken from "@/components/setup/PlayerToken";
import { eraTotal, type FinalResult } from "./types";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ERA_ACCENT: Record<string, string> = {
  Canal: "text-bottle-600",
  Rail: "text-copper-500",
};

/**
 * Detailed per-era scoring table (endgame.md §3): rows = point sources,
 * columns = players. Era groups collapse with a hairline chevron; the total
 * row is engraved in brass. Non-VP info rows (income, links, industries)
 * follow beneath.
 */
export default function ScoringTable({
  result,
  reveal,
}: {
  result: FinalResult;
  reveal: boolean;
}) {
  const { players, eras } = result;
  const t = useT();
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(eras.map((e) => [e.name, true])),
  );
  /* what the eras do not explain: a merchant's barrel pays on the spot, an
     empty purse on payday costs on the spot, and the initiation game closes
     its books with a bonus. Without this line the total reads as an error. */
  const aside = players.map((p, i) => p.vp - eraTotal(result, i));

  let row = 0;

  return (
    <div className="plate relative overflow-hidden">
      <div
        aria-hidden
        className="tex-paper pointer-events-none absolute inset-0 opacity-[0.05]"
      />
      <Table className="relative">
        <TableHeader>
          <TableRow className="border-b border-brass-700/50 hover:bg-transparent">
            <TableHead className="font-fell text-sm uppercase tracking-[0.06em] text-brass-500">
              {t("results.table.header")}
            </TableHead>
            {players.map((p) => (
              <TableHead key={p.name} className="text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <span className="max-w-[120px] truncate font-sans text-[13px] font-semibold text-cream-100">
                    {p.name}
                  </span>
                  <PlayerToken color={p.color} size={18} />
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {eras.map((era) => {
            const isOpen = open[era.name] ?? true;
            const headerRow = row++;
            const scoreRow = row++;
            return [
              <TableRow
                key={`${era.name}-head`}
                className="cursor-pointer border-b border-coal-700/70 bg-coal-800/60 hover:bg-coal-800"
                onClick={() => setOpen((o) => ({ ...o, [era.name]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <TableCell colSpan={players.length + 1} className="py-2.5">
                  <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    animate={reveal ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.2 + headerRow * 0.06, duration: 0.2 }}
                    className="inline-flex items-center gap-2"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-brass-500 transition-transform duration-200",
                        !isOpen && "-rotate-90",
                      )}
                    />
                    <span className={cn("font-fell text-sm uppercase tracking-[0.08em]", ERA_ACCENT[era.name])}>
                      {t(era.name === "Canal" ? "results.table.eraCanal" : "results.table.eraRail")}
                    </span>
                  </motion.span>
                </TableCell>
              </TableRow>,
              isOpen && (
                <TableRow key={`${era.name}-scores`} className="border-b border-coal-700/50 hover:bg-transparent">
                  <motion.td
                    initial={{ opacity: 0, y: 8 }}
                    animate={reveal ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.2 + scoreRow * 0.06, duration: 0.2 }}
                    className="pl-8 font-sans text-[13px] text-cream-100/75"
                  >
                    {t("results.table.vpScored")}
                  </motion.td>
                  {players.map((p, i) => (
                    <TableCell key={p.name} className="text-right font-mono text-sm text-cream-100 tabular-nums">
                      {era.scores[i] ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ),
            ];
          })}

          {/* What fell outside the eras, when anything did */}
          {aside.some((v) => v !== 0) && (
            <TableRow className="border-b border-coal-700/40 hover:bg-transparent">
              <motion.td
                initial={{ opacity: 0, y: 8 }}
                animate={reveal ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.2 }}
                className="pl-8 font-sans text-[13px] text-cream-100/75"
              >
                {t("results.table.aside")}
              </motion.td>
              {players.map((p, i) => (
                <TableCell key={p.name} className="text-right font-mono text-sm text-cream-100 tabular-nums">
                  {aside[i] > 0 ? `+${aside[i]}` : aside[i]}
                </TableCell>
              ))}
            </TableRow>
          )}

          {/* Total — brass line */}
          <TableRow className="border-y border-brass-700/70 bg-brass-500/[0.07] hover:bg-brass-500/[0.07]">
            <TableCell className="font-display text-base font-bold text-brass-400">
              {t("results.table.total")}
            </TableCell>
            {players.map((p) => (
              <TableCell
                key={p.name}
                className="text-right font-display text-lg font-bold text-brass-400 tabular-nums"
              >
                {p.vp}
              </TableCell>
            ))}
          </TableRow>

          {/* Info rows (not scored in VP) */}
          {(
            [
              [t("results.table.finalIncome"), players.map((p) => `£${p.income}`)],
              [t("results.table.linksBuilt"), players.map((p) => String(p.links))],
              [t("results.table.tilesBuilt"), players.map((p) => String(p.industries))],
            ] as [string, string[]][]
          ).map(([label, cells], r) => (
            <TableRow key={label} className="border-b border-coal-700/40 hover:bg-transparent">
              <motion.td
                initial={{ opacity: 0, y: 8 }}
                animate={reveal ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.35 + r * 0.06, duration: 0.2 }}
                className="pl-8 font-sans text-[13px] italic text-cream-100/55"
              >
                {label}
              </motion.td>
              {cells.map((c, i) => (
                <TableCell key={players[i].name} className="text-right font-mono text-[13px] text-cream-100/65 tabular-nums">
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

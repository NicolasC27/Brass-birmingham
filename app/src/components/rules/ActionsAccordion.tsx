import type { CSSProperties } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useT } from "@/i18n";
import RulesIcon from "./RulesIcon";
import type { ActionDef } from "./rulesData";
import { getActions } from "./rulesData";

/** Tiny inline diagram for each action — ink linework on parchment.
 *  Network traces itself (800ms dashoffset) each time its row opens. */
function ActionDiagram({ kind }: { kind: ActionDef["diagram"] }) {
  const t = useT();
  const ink = "#241D14";
  const brass = "#8A6B33";
  const rust = "#8E3B2F";
  switch (kind) {
    case "build":
      return (
        <svg viewBox="0 0 220 84" className="h-20 w-full max-w-[260px]" aria-hidden>
          <circle cx="42" cy="42" r="20" fill="none" stroke={ink} strokeWidth="1.5" />
          <text x="42" y="47" textAnchor="middle" fontSize="10" fill={ink} fontFamily="'IM Fell English SC', Georgia, serif">{t("rules.actionsUi.diagram.town")}</text>
          <rect x="110" y="22" width="64" height="40" rx="4" fill="none" stroke={brass} strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="116" y="28" width="52" height="28" rx="3" fill="#F2EAD6" stroke={ink} strokeWidth="1.5" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={126 + i * 9} cy={33} r="2" fill={brass} />
          ))}
          <path d="M 62 42 H 104" stroke={ink} strokeWidth="1.2" className="rules-trace-once" style={{ "--trace-len": 46 } as CSSProperties} />
        </svg>
      );
    case "network":
      return (
        <svg viewBox="0 0 220 84" className="h-20 w-full max-w-[260px]" aria-hidden>
          <circle cx="36" cy="46" r="16" fill="none" stroke={ink} strokeWidth="1.5" />
          <circle cx="184" cy="34" r="16" fill="none" stroke={ink} strokeWidth="1.5" />
          <path
            d="M 52 44 C 95 52, 130 24, 168 33"
            fill="none"
            stroke={brass}
            strokeWidth="2.5"
            strokeLinecap="round"
            className="rules-trace-once"
            style={{ "--trace-len": 130 } as CSSProperties}
          />
          <text x="36" y="78" textAnchor="middle" fontSize="9" fill={ink} fontFamily="'IM Fell English SC', Georgia, serif">{t("rules.actionsUi.diagram.yourTown")}</text>
          <text x="184" y="66" textAnchor="middle" fontSize="9" fill={ink} fontFamily="'IM Fell English SC', Georgia, serif">{t("rules.actionsUi.diagram.newTown")}</text>
        </svg>
      );
    case "develop":
      return (
        <svg viewBox="0 0 220 84" className="h-20 w-full max-w-[260px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={60 + i * 6} y={44 - i * 9} width="64" height="20" rx="3" fill="#F2EAD6" stroke={ink} strokeWidth="1.4" />
          ))}
          <path d="M 92 30 V 12 M 86 18 L 92 11 L 98 18" fill="none" stroke={rust} strokeWidth="1.6" strokeLinecap="round" />
          <text x="150" y="40" fontSize="9" fill={rust} fontFamily="Archivo, sans-serif">{t("rules.actionsUi.diagram.minusIron")}</text>
          <text x="150" y="52" fontSize="9" fill={ink} fontFamily="Archivo, sans-serif">{t("rules.actionsUi.diagram.perTile")}</text>
        </svg>
      );
    case "sell":
      return (
        <svg viewBox="0 0 220 84" className="h-20 w-full max-w-[260px]" aria-hidden>
          <rect x="16" y="26" width="46" height="30" rx="3" fill="#F2EAD6" stroke={ink} strokeWidth="1.5" />
          <text x="39" y="45" textAnchor="middle" fontSize="8.5" fill={ink} fontFamily="'IM Fell English SC', Georgia, serif">{t("rules.actionsUi.diagram.mill")}</text>
          <path d="M 68 41 H 128" stroke={brass} strokeWidth="2" className="rules-trace-once" style={{ "--trace-len": 62 } as CSSProperties} />
          <circle cx="100" cy="20" r="7" fill="none" stroke={ink} strokeWidth="1.3" />
          <path d="M 96 20 h8 M 100 16 v8" stroke={ink} strokeWidth="1" />
          <text x="100" y="12" textAnchor="middle" fontSize="8" fill={ink} fontFamily="Archivo, sans-serif">{t("rules.actionsUi.diagram.beer")}</text>
          <path d="M 140 52 h42 M 146 52 l6 -20 h30 l6 20" fill="none" stroke={ink} strokeWidth={1.5} />
          <path d="M 161 32 v-8 M 150 24 h22" stroke={ink} strokeWidth="1.3" />
          <text x="161" y="70" textAnchor="middle" fontSize="8.5" fill={ink} fontFamily="'IM Fell English SC', Georgia, serif">{t("rules.actionsUi.diagram.merchant")}</text>
        </svg>
      );
    case "loan":
      return (
        <svg viewBox="0 0 220 84" className="h-20 w-full max-w-[260px]" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="30" y={58 - i * 12} width="18" height="8" rx="1.5" fill="none" stroke={ink} strokeWidth="1.1" />
          ))}
          <circle cx="39" cy="20" r={5} fill={brass} />
          <path d="M 52 24 C 66 32, 66 48, 52 56" fill="none" stroke={rust} strokeWidth="1.5" strokeDasharray="3 3" className="rules-trace-once" style={{ "--trace-len": 40 } as CSSProperties} />
          <text x="86" y="44" fontSize="10" fill={ink} fontFamily="'IBM Plex Mono', monospace">{t("rules.actionsUi.diagram.loanLabel")}</text>
        </svg>
      );
    case "scout":
      return (
        <svg viewBox="0 0 220 84" className="h-20 w-full max-w-[260px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={18 + i * 16} y={24 - i * 3} width="26" height="38" rx="3" fill="#F2EAD6" stroke={ink} strokeWidth="1.2" transform={`rotate(${-6 + i * 5} ${31 + i * 16} 43)`} />
          ))}
          <path d="M 92 42 H 128" stroke={rust} strokeWidth="1.5" strokeDasharray="3 3" className="rules-trace-once" style={{ "--trace-len": 38 } as CSSProperties} />
          {[0, 1].map((i) => (
            <g key={i}>
              <rect x={140 + i * 22} y={22 - i * 2} width="26" height="38" rx="3" fill="#F2EAD6" stroke={brass} strokeWidth="1.6" />
              <path d={`M ${153 + i * 22} 32 l2.2 4.6 5 .6 -3.7 3.4 1 4.9 -4.5 -2.5 -4.5 2.5 1 -4.9 -3.7 -3.4 5 -.6 z`} fill={brass} />
            </g>
          ))}
        </svg>
      );
  }
}

/**
 * §III — The Six Actions. Radix accordion re-skinned to the paper codex:
 * parchment rows, brass chevrons, spring-height animation from the tailwind
 * config. Each open row shows cost chips, steps, edge cases and a diagram.
 */
export default function ActionsAccordion() {
  const t = useT();
  const actions = getActions();
  return (
    <Accordion type="single" collapsible className="space-y-2">
      {actions.map((a) => (
        <AccordionItem
          key={a.id}
          value={a.id}
          className="overflow-hidden rounded-md border border-brass-700/45 bg-cream-100 shadow-[0_2px_5px_rgba(36,29,20,0.12)] last:border-b"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:text-brass-700">
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass-700/70 bg-gradient-to-br from-brass-400 via-brass-500 to-brass-700 text-ink-900 shadow-e2">
                <RulesIcon icon={a.icon} className="h-4 w-4" />
              </span>
              <span className="text-left">
                <span className="block font-fell text-[17px] uppercase tracking-[0.06em] text-ink-900">
                  {a.name}
                </span>
                <span className="block font-mono text-[11px] text-copper-700">{a.cost}</span>
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="grid gap-4 border-t border-brass-700/30 pt-4 md:grid-cols-[1fr_auto]">
              <div>
                <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-900/85">
                  {a.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="mt-3 rounded border-l-2 border-rust-500/70 bg-rust-500/[0.07] px-3 py-2">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-rust-500">
                    {t("rules.actionsUi.edgeCases")}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-[12.5px] leading-relaxed text-ink-900/75">
                    {a.edges.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-start justify-center md:pt-1">
                <ActionDiagram kind={a.diagram} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import RulesIcon from "./RulesIcon";
import TileMock from "./TileMock";
import type { Industry } from "./rulesData";
import { getIndustries } from "./rulesData";

type T = ReturnType<typeof useT>;

function resourceText(t: T, coal: number, iron: number) {
  const parts: string[] = [];
  if (coal > 0) parts.push(t("rules.industries.resource.coal", { n: coal }));
  if (iron > 0) parts.push(t("rules.industries.resource.iron", { n: iron }));
  return parts.length ? parts.join(" + ") : t("rules.industries.resource.none");
}

function IndustryTable({ industry }: { industry: Industry }) {
  const t = useT();
  const headers = [
    t("rules.industries.headers.tile"),
    t("rules.industries.headers.lvl"),
    t("rules.industries.headers.build"),
    t("rules.industries.headers.coalIron"),
    t("rules.industries.headers.beerToFlip"),
    t("rules.industries.headers.income"),
    t("rules.industries.headers.vp"),
    t("rules.industries.headers.notes"),
  ];
  return (
    <div className="rules-table-fade overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="pb-3 text-left font-sans text-[13px] leading-relaxed text-ink-900/70">
          {industry.blurb}
        </caption>
        <thead>
          <tr className="border-b-2 border-brass-700/60">
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-2 pb-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {industry.levels.map((lv) => (
            <tr
              key={lv.level}
              className="rules-ind-row border-b border-brass-700/25 transition-colors last:border-b-0 hover:bg-brass-500/[0.08]"
            >
              <td className="px-2 py-3">
                <TileMock icon={industry.icon} level={lv.level} income={lv.income} vp={lv.vp} />
              </td>
              <td className="px-2 py-3 font-mono text-[13px] font-semibold text-ink-900">{lv.level}</td>
              <td className="px-2 py-3 font-mono text-[13px] text-ink-900">£{lv.cost}</td>
              <td className="px-2 py-3 font-mono text-[12.5px] text-ink-900/85">{resourceText(t, lv.coal, lv.iron)}</td>
              <td className="px-2 py-3 font-mono text-[12.5px] text-ink-900/85">
                {lv.beer > 0 ? t("rules.industries.beer.count", { n: lv.beer }) : t("rules.industries.beer.onEmpty")}
              </td>
              <td className="px-2 py-3 font-mono text-[13px] font-semibold text-bottle-800">+{lv.income}</td>
              <td className="px-2 py-3 font-mono text-[13px] font-semibold text-copper-700">{lv.vp}</td>
              <td className="px-2 py-3 font-sans text-[12px] leading-snug text-ink-900/70">{lv.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * §IV — The Industries. One brass pill tab per industry; tables render from
 * rulesData.ts (the same file the game reads). Row stagger on tab switch is
 * applied by the page GSAP pass (.rules-ind-row within the active panel).
 */
export default function IndustryTabs() {
  const t = useT();
  const industries = getIndustries();
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 rounded border border-copper-500/50 bg-copper-500/[0.08] px-3 py-2 font-sans text-[11.5px] leading-snug text-copper-700">
        <span className="font-semibold uppercase tracking-[0.14em]">{t("rules.industries.tuningTag")}</span>
        <span>
          {t("rules.industries.tuningNote")}
        </span>
      </p>
      <Tabs defaultValue={industries[0].id}>
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          {industries.map((ind) => (
            <TabsTrigger
              key={ind.id}
              value={ind.id}
              className="sheen group relative h-10 flex-none gap-2 overflow-hidden rounded-full border border-brass-700/70 bg-transparent px-4 font-fell text-[13px] uppercase tracking-[0.08em] text-ink-900/70 transition-all data-[state=active]:border-brass-700 data-[state=active]:bg-gradient-to-br data-[state=active]:from-brass-400 data-[state=active]:via-brass-500 data-[state=active]:to-brass-700 data-[state=active]:text-ink-900 data-[state=active]:shadow-e2"
            >
              <RulesIcon icon={ind.icon} className="h-4 w-4" />
              {ind.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {industries.map((ind) => (
          <TabsContent key={ind.id} value={ind.id} className="mt-0">
            <IndustryTable industry={ind} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

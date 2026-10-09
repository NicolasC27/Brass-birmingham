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
        <caption className="pb-3 text-left font-ui text-[13px] leading-relaxed text-paper-300">
          {industry.blurb}
        </caption>
        <thead>
          <tr className="border-b-2 border-brass-hairline-strong">
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="micro-label px-2 pb-2 text-brass-500"
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
              className="rules-ind-row border-b border-[rgb(var(--paper-100)/.08)] transition-colors last:border-b-0 hover:bg-brass-500/[0.06]"
            >
              <td className="px-2 py-3">
                <TileMock icon={industry.icon} level={lv.level} income={lv.income} vp={lv.vp} />
              </td>
              <td className="tnums px-2 py-3 font-mono text-[13px] font-semibold text-paper-100">{lv.level}</td>
              <td className="tnums px-2 py-3 font-mono text-[13px] text-paper-100">£{lv.cost}</td>
              <td className="tnums px-2 py-3 font-mono text-[12.5px] text-paper-300">{resourceText(t, lv.coal, lv.iron)}</td>
              <td className="tnums px-2 py-3 font-mono text-[12.5px] text-paper-300">
                {lv.beer > 0 ? t("rules.industries.beer.count", { n: lv.beer }) : t("rules.industries.beer.onEmpty")}
              </td>
              <td className="tnums px-2 py-3 font-mono text-[13px] font-semibold text-bottle-ink">+{lv.income}</td>
              <td className="tnums px-2 py-3 font-mono text-[13px] font-semibold text-brass-300">{lv.vp}</td>
              <td className="px-2 py-3 font-ui text-[12.5px] leading-snug text-iron-400">{lv.note}</td>
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
 * pure CSS (.rules-ind-row within the active panel, see RulesStyle).
 */
export default function IndustryTabs() {
  const t = useT();
  const industries = getIndustries();
  return (
    <div>
      {/* a note of provenance, not a warning: it takes the brass of the
          register's other notes, and rust stays the rail's and the ember's */}
      <p className="mb-3 flex items-center gap-2 border-l-[3px] border-brass-500/70 bg-lacquer-950 px-3 py-2 font-ui text-[12.5px] leading-snug text-paper-300">
        <span className="font-semibold uppercase tracking-label">{t("rules.industries.tuningTag")}</span>
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
              className="group relative flex h-10 flex-none items-center gap-2 rounded-full border border-brass-hairline bg-transparent px-4 font-ui text-[13px] font-semibold text-paper-300 transition-[background-color,border-color,color] duration-150 hover:border-brass-hairline-strong hover:text-paper-100 data-[state=active]:border-brass-500 data-[state=active]:bg-[rgb(var(--brass-plate))] data-[state=active]:text-[rgb(var(--ink-on-brass))]"
            >
              {/* the woodcut is black: it holds on the day's paper and on the
                  plate, and is lifted to the page's pale ink on the night's
                  enamel, where it vanished */}
              <RulesIcon
                icon={ind.icon}
                className="h-4 w-4 [html[data-theme=dark]_&]:[filter:brightness(0)_invert(0.85)] [html[data-theme=dark]_[data-state=active]_&]:[filter:none]"
              />
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

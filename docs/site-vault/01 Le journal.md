# Le journal

Hors du plateau, le site est lu comme un journal illustré des Midlands. Décision du 19 septembre 2026, après deux passes : d'abord affiner l'ancienne plateforme (fontes, coins, boutons), puis tout reprendre en journal quand Nicolas a demandé « un changement fondamental ».

## La manchette

`PlatformShell.tsx` : une **ligne d'oreille** (date de l'édition dans l'année de l'ère, chiffres du jour, outils), le **mot-titre** `.gz-wordmark` (Fraunces, opsz 144, lettres espacées, fondu quand les fontes sont là via `html.fonts-ready`), la **devise** en Fell. Elle défile ; le **rail** de rubriques (`NavRail`) reste collé sous un double filet, et `RailEngine` — une locomotive de 1830 dessinée en SVG — le traverse à chaque changement de page (`key={pathname}`).

## La grammaire `gz-*` (index.css)

- `.gz-rule-double` — deux filets, la bordure d'imprimeur.
- `.gz-head` — un titre entre deux filets.
- `.gz-engraving` — la gravure dans son cadre (filet + filet gras intérieur) ; l'image dérive lentement (`gz-pan`).
- `.gz-ticket` (+ `-brass`, `-signal`) — un billet perforé, en capitales espacées, jamais sur deux lignes.
- `.gz-timetable` — l'horaire : lignes fines, chiffres en mono, en-têtes en petites capitales.
- `.gz-classified` — une petite annonce à double cadre.
- `.gz-col-rule` — le filet entre deux colonnes.
- `.gz-nav-link` — une rubrique en petites capitales, losange sous l'active ; sert aussi de contrôle segmenté (`Segmented.tsx`).
- Les encres : `--gz-ink`, `--gz-ink-soft`, `--gz-ink-faint` dérivées de `paper-100`, donc justes en clair comme en sombre.

## Les fontes

Fraunces (300–600, italiques) et Inter viennent des paquets `@fontsource` dans `main.tsx` ; IM Fell English SC, Spectral (italiques des chapeaux), Playfair et Plex Mono de Google. Échelle : titres au poids livre une taille en dessous, labels 10,5 px espacés (`.micro-label`), sur-titres en Fell (`.eyebrow-fell`).

## Les deux registres

Clair par défaut (« registre de jour »), sombre sur demande. Un lien peut nommer le registre : `?theme=light|dark` (index.html), et `?arrived` saute l'arrivée. Les planches ont chacune leur impression de nuit (voir [[04 L'almanach et les planches]]).

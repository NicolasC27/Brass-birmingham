# Plan — Brass: Birmingham navigateur

Objectif: produire une preview web jouable, avec direction artistique forte façon « objet de collection numérique », en priorité desktop. Le brief complet demande aussi backend/multijoueur; la preview initiale doit surtout démontrer plateau, pose d'industrie, réseau, vente, scoring de fin d'ère et polish visuel.

## Stage 1 — Direction artistique
- Charger la skill `musepool` pour éviter une esthétique générique.
- Extraire une direction: palette cuivre/laiton/charbon/parchemin, typographie industrielle, plateau avec relief, micro-interactions.
- Sortie: consignes DA transmises au builder.

## Stage 2 — Orchestration webapp
- Charger `vibecoding-webapp-swarm` pour cadrer la construction web React/TypeScript.
- Charger `webapp-building-swarm` pour la structure d'implémentation frontend.
- Décider du périmètre preview: prototype frontend jouable local, règles approximatives clairement marquées, architecture prête pour backend ultérieur.

## Stage 3 — Implémentation preview jouable
- Créer l'app React/Vite/TS avec Tailwind/shadcn si applicable.
- Implémenter: plateau stylisé, villes/liaisons, carte main, pose d'industrie, liens canal/rail, marché charbon/fer, vente via marchands, pistes revenu/PV, fin d'ère simplifiée, historique d'actions, tooltips, animations.
- Sortie: projet frontend dans `/mnt/agents/output/brass-birmingham-preview`.

## Stage 4 — Validation
- Build/lint rapide.
- Vérifier que l'app s'ouvre dans un navigateur.
- Corriger les erreurs bloquantes.

## Stage 5 — Livraison preview
- Appeler `website_version_manager` en `build_version` sur le projet frontend.
- Répondre avec la version sauvegardée et les limites connues.

## Stage ultérieur possible — Backend/multijoueur
- Si poursuite: charger `backend-building-swarm` et ajouter API temps réel/persistance/auth selon les contraintes plateforme.

---

# Itération 1 — Refonte de la carte (feedback utilisateur)

Feedback: la carte est peu visible, zoom plafonné à 130%, l'utilisateur veut une map très visible, interactive, avec de vraies images façon jeu physique.

## Stage A — Branche fix-map
- Fork `fix-map` depuis master, worktree dédié.

## Stage B — Implémentation (sous-agent coder)
- Zoom: plage 40–300%, molette ancrée curseur, double-clic, pinch, boutons +/−/100%/fit, mini-carte avec rectangle de viewport cliquable.
- Visuel: générer `map-midlands-art.png` (gravure 19e, 2K, recadrée 3:2) comme sous-couche; étiquettes de villes en plaques parchemin à taille stabilisée; sockets d'industrie gravés; liens épais avec survol lumineux et glow couleur joueur.
- Interactivité: survol ville → liaisons connectées illuminées + tooltip; clic ville → inspecteur; compatibilité avec les ghost-lines d'approvisionnement et le flash de région du ledger.
- Commit, retour immédiat.

## Stage C — Validation & livraison
- Merge `fix-map` dans master, npm install + build dans `/mnt/agents/output/app`, `build_version` static.

---

# Itération 2 — Refonte totale immersion carte (feedback utilisateur)

Décisions utilisateur (ask_user): carte plein écran 100% + HUD flottant rétractable; reproduction fidèle du vrai plateau Roxley (vraies villes/positions/connexions, tons sombres); 4 ambiances: éclairage d'ère, cheminées fumantes, vignette+lampe, bateaux/trains animés.

## Stage A — Recherche (explore, bloquant)
- Compiler la géographie authentique de Brass: Birmingham: villes + emplacements d'industrie par ville, connexions canal/rail, tuiles marchandes en bordure, sources externes.
- Sortie: `/mnt/agents/output/research/board-data.md` avec coordonnées normalisées 1600×1100 et sources.

## Stage B — Brief d'implémentation
- Orchestrateur écrit `/mnt/agents/output/design/map-v3.md`: layout plein écran, HUD flottant (hand dock bas auto-repliable, marché droite, rail joueurs gauche, ledger overlay), couches d'ambiance, underlay sombre généré (`map-midlands-dark.png`), géographie code-drawn fidèle.

## Stage C — Implémentation (coder, bloquant)
- Branche `fix-map-v2` depuis master. Scope: `src/components/game/**`, `src/pages/Game.tsx`, `src/game/data.ts` (remplacement géographique), `public/` nouveaux assets.
- Conserver: zoom 40–300%, mini-carte, inspecteur, ghost-lines, ciblage des actions.

## Stage D — Validation & livraison
- Merge, build, `build_version` static.

---

# Itération 3 — Villes façon capture Steam (feedback + image de référence)

Référence: `/mnt/agents/upload/image.png` (version Steam) — ville = ruban avec le nom + tuiles de construction illustrées au-dessus; marché en panneau brique; carte sombre brumeuse.

Décisions utilisateur: illustrations peintes façon Steam; fond régénéré plus sombre + brume; tout le plan d'un coup.

## Stage A — Assets (dans le chantier coder)
- 6 illustrations peintes d'industries (charbon, fer, coton, manufacture, poterie, brasserie), 1:1 1K, style peint sombre cohérent.
- `town-village.png` transparent (cluster de village peint derrière les rubans).
- `map-midlands-dark2.png`: sous-couche plus sombre, brume, relief, rivières, sans texte/bâtiments/marqueurs.
- `market-brick.png`: texture mur de brique sombre pour le panneau marché.

## Stage B — Composant Ville refait
- Ruban nom de ville (serif caps, fond sombre, ombres) + grille de tuiles slots au-dessus, légères rotations, ombres portées.
- Slot vide = illustration de l'industrie; slot construit = tuile joueur par-dessus (bordure couleur, pips niveau, flip).
- Village peint derrière le ruban. Interactions conservées (ciblage, hover, ghost-lines, inspecteur).

## Stage C — Marché brique
- Panneau marché restylé: fond brique, sockets carrés sombres, disques ressources, pastilles de prix laiton. Logique/animations conservées.

## Stage D — Livraison
- Merge fix-map-v3, build, build_version.

---

# Itération 4 — Grande carte + vraies voies (validé par l'utilisateur)

Décisions: monde 2400×1600 (villes espacées ~1.5×, positions authentiques relatives conservées); canaux = rubans d'eau sinueux avec berges, rails = voies courbes à traverses; eau animée sur canaux construits; tracés rail-only se gravent à la cérémonie d'ère; fond régénéré avec relief renforcé (vallées/forêts/champs).

## Étapes
1. Branch fix-spacing. Coordonnées data.ts ×1.5 / ×1.4545 → monde 2400×1600; boardView/Board/Minimap/ghost mis à l'échelle.
2. Chemins courbes par lien (bézier déterministe, évitement des villes, vérifié numériquement): canal = eau + berges + reflets animés; rail = ballast + traverses; non-construit = gravure discrète; rail-only révélé progressivement à la cérémonie.
3. Nouvel underlay 2400×1600 (4K 16:9 → crop 3:2 → downscale) avec relief marqué.
4. VÉRIFICATION par captures (fit + zoom Black Country + close-up canal) AVANT build_version.

## Itération v7 — feedback utilisateur (capture Steam du vrai jeu comme référence)
1. **Police des noms de villes non uniforme** → toutes les plaques de noms doivent utiliser la même police, style ruban parchemin gravé façon Steam.
2. **Liaisons pas assez visibles** → vrais canaux d'eau et chemins de fer nets (chemins creusés dans le relief, style Steam).
3. **Map trop claire** → carte plus sombre, brume/fumée sur les bords, lumières chaudes par-ci par-là ; possibilité de 2 cartes (ère canaux / ère rails).
4. **Marchands (Oxford = marché international, Warrington, Nottingham, Shrewsbury, Gloucester)** → design dédié cohérent avec le tout (icônes gobelets + emplacements tonneaux/caisse comme sur la capture Steam).
5. S'inspirer de la capture Steam pour le reste (portraits joueurs, bandeau ère/manche, marqueurs de présence colorés sur liaisons).
Référence visuelle : /mnt/agents/upload/image(1).png

## Itération v8 — feedback utilisateur
1. Écriture des villes non uniforme (étirée/rétrécie selon longueur) → taille de police FIXE identique pour toutes les plaques, le ruban s'adapte au texte.
2. Cases double-industrie illisibles → **liserés colorés par industrie + 2 icônes** (choix utilisateur).
3. Bière : **tonneaux redessinés réalistes** (cerclage laiton, robinet, bois verni).
4. Marchands : **enseigne de taverne suspendue** (panneau bois sculpté, potence laiton, symbole marché, bonus en chiffres laiton) — fini l'encadrement + 2 coupes.
5. Ère canaux : routes non construites = **tracé canal bleuté pointillé** ; style ferroviaire uniquement à l'ère 2.

## Itération v9 — feedback utilisateur
1. Ère canaux : tracé non construit = **ligne d'eau CONTINUE** (ruban bleuté fluide + reflet), plus de pointillés.
2. Choix utilisateur (multi) : **halos de lampes animés** autour villes/marchands ; **marché charbon/fer façon comptoir de bourse victorien** (brique + laiton, cubes 3D sur pistes de prix) ; **cartes de la main façon gravures collector** (bordure gravée, illustration, coins vieillis).

## Itération v10 — feedback utilisateur
1. **Cubes charbon/fer visibles sur les usines construites** (lisibilité stratégique, comme le vrai jeu).
2. **Fumées de cheminées sur usines construites + rivières aux reflets animés** sur la carte.
3. **Hot-seat peaufiné** : écran de passe de main entre joueurs humains, cartes masquées, noms de joueurs.
Non retenu : sons d'ambiance, caméra cinématique, multijoueur en ligne, tutoriel.

## Itération v11 — lisibilité à 100% sur écrans 2K
Choix utilisateur : **étirer + agrandir**.
1. Monde 2400×1600 (3:2) → **2560×1440 (16:9)** : transform SX=2560/2400, SY=1440/1600 sur toutes les ancres ; cartes redimensionnées 2560×1440 ; revérifier collision des courbes (clearance 90px).
2. **Plaques de noms avec taille d'écran minimum ~13px** à tous les zooms (plancher sur le contre-scale --bw-ls).

## Itération v12 — respacement après étirement 16:9
Feedback : « certaines choses sont trop collées ». Le squeeze vertical a resserré des clusters (Belper au bord haut, rubans qui frôlent tuiles voisines, zones Tamworth/Nuneaton, Birmingham/Redditch, Worcester/Farm Brewery S).
Action : audit numérique de toutes les boîtes (tuiles+rubans+enseignes marchands), marges bords monde ≥ 24px, gaps inter-éléments ≥ 14px, nudge contrôlé sans casser la topologie ni les courbes (revérifier clearance 90px après).

## Itération v13 — « maximum d'air » façon brassforge
Référence : /mnt/agents/upload/image(2).png (brassforge — villes petites, grandes distances, courbes amples).
Choix utilisateur : monde **3200×1800** (+25% distances) ET tuiles **70→56px**. Noms protégés par plancher 13px.
Cartes upscalées 2560×1440 → 3200×1800 (Lanczos, conserver l'art actuel). RiverSheen ×1.25. Audit collisions + clearance courbes à rejouer.

## v13 — « Maximum d'air » (livrée, version d6bff4c)
- Choix utilisateur : Maximum d'air (référence brassforge)
- Monde 3200×1800 (×1,25), tuiles 56px, enseignes marchands ×0,8
- Audit : pire gap 65,5px (seuil 18), pire clearance courbe 135px (seuil 90), 0 nudge, 0 débordement
- Carte trop sombre après agrandissement → gamma lift PIL sur les 2 maps (moyennes 46,7/53,9), vérifié en capture réelle
- Commit master : 82700c8 + e026311 ; build_version : d6bff4c

## v14 — Clarté à tout zoom (livrée, version b73daa0)
- Problème : rubans énormes en dézoom (plancher 13px sans plafond → ×4.5 à k=0.4)
- Fix : plafond RIBBON_MAX_SCALE=1.5, MIN_K 0.4→0.75, LOD « far » (s<0.55 : badges VP/income, pips, rubans marchands masqués), unsharp sur les 2 maps
- Bonus : réparation map-era-canal.png corrompu (8 octets IDAT) depuis v13
- Vérifié par captures : 75% (vue d'ensemble épurée), fit, 137%, 249% — rubans nets et proportionnés partout
- Commit 9d61654 ; build_version : b73daa0

## v15 — Lisibilité industries au dézoom (livrée, version 72faea2)
- Choix utilisateur : anneau coloré par industrie + gros symbole au dézoom
- Anneau+halo couleur industrie sur toutes les tuiles (coal → gris chaud #9A938A ; double industrie = segment bord droit 2e couleur), atténué à haut zoom (--bw-ring)
- Mode schématique s<0.9 : gravure estompée, grand glyphe parchemin #F5EBD2 sur disque sombre teinté ; cubes toujours par-dessus
- BuiltTile retournée : anneau oui, glyphe non (VP prioritaire)
- Vérifié captures : 75%, 100%, 137% — industries instantanément identifiables
- Commit 29b3789 ; build_version : 72faea2

## v16 — Tuiles un poil plus grosses (livrée, version 21f2fc2)
- TILE 56→62, glyphe schématique 31→40 (64,5%), mini-chips 7.4→8.2, cubes 10→11, barils 12→13
- Audit : pire gap 56.5px (seuil 18), pire marge 67px (seuil 24) — OK
- Commit 35ef7c3 ; build_version : 21f2fc2

## v16b — Suppression halo hover (livrée, version fca0088)
- Retiré : rectangle laiton pulsant autour de la ville survolée + outlines pulsants sur chaque tuile
- Conservé : flash laiton du ledger, sheen discret sur la tuile précise survolée, mise en évidence des liens adjacents
- Commit sur master ; build_version : fca0088

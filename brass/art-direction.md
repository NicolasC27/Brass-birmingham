# Direction Artistique — Brass: Birmingham « objet de collection numérique »

## Concept
Une table de jeu physique, photographiée au dessus : un plateau cartonné épais posé sur
un feutre sombre, des tuiles en carton embossé, des cartes à la tranche dorée, des pions
en laiton. Rien de plat : tout a une épaisseur, une ombre, un grain. L'interface autour
du plateau adopte un langage « console d'ingénieur » — hairlines, labels en petites
capitales espacées, chiffres tabulaires — pour que la densité d'information reste
instantanément lisible.

## Le plateau : une carte gravée, pas une peinture
La surface du plateau est une carte de comté de la fin du XVIIIe, gravure sur cuivre,
encre sépia sur papier vergé crème. Canaux en deux traits avec un lavis vert-de-gris,
futurs rails en tirets d'arpenteur, bourgs en amas de petits blocs, bassins marchands
en anneau de pierre ; lignes de forme et petits arbres gravés seulement là où il n'y a
ni ville ni lien. L'ère rail est la même feuille jaunie et salie de suie, les rails en
échelle noir et blanc. Presque tout est vide et calme : l'œil va aux tuiles, qui sont
la chose la plus riche sur la table. Les peintures vues d'avion (Midjourney) sont
abandonnées comme fond par défaut : trop de détail sous les tuiles, fatigue visuelle.
La carte est dessinée depuis la géométrie (`tools/assets/map/compose-engraved.sh`),
donc reproductible.

## Palette (dérivée des références, température chaude constante)
- Fond table / feutre : `#191715` (charbon), panneaux `#2A2520` (olive-charbon)
- Vert bouteille : `#2F3D29`, `#384732` (zones de plateau, tuiles ère rail)
- Crème parchemin : `#F4ECD8` (texte principal, faces de cartes)
- Laiton / or vieilli : `#C9A227` (accent primaire, pions, éléments actifs)
- Cuivre : `#B0703C` (accent secondaire, tuiles charbon/fer, liens rail)
- Déclinaisons sémantiques dérivées (même échelle de luminosité) :
  succès/charbon `#7D8F69`, alerte/emprunt `#C77B4A`, danger `#A6493A`
- Bordures hairline : `color-mix(in srgb, #F4ECD8 14%, transparent)`

## Typographie
- Titres & plaques : **Zilla Slab** (600/700), petites capitales, letter-spacing 0.08–0.14em
- Voix d'époque (noms de villes sur le plateau, en-têtes d'ère) : **IM Fell English SC**
- UI & corps : **Inter** (400/500/600)
- Chiffres, prix du marché, compteurs : **JetBrains Mono** (chiffres tabulaires)
- Hiérarchie par taille + graisse + tracking, jamais par la couleur seule.
- Google Fonts avec `font-display: swap`.

## Matière & relief
- Grain papier/métal : filtre SVG `feTurbulence` (fractalNoise, baseFrequency ~0.9,
  opacité 4–7 %) en overlay sur plateau, tuiles et cartes — jamais de glassmorphism.
- Relief physique : chaque tuile/carte a une épaisseur simulée (bord inférieur plus
  sombre de 2–3 px) + ombre portée douce (`0 2px 4px rgba(0,0,0,.4)`, `0 8px 24px
  rgba(0,0,0,.25)` pour les éléments survolés/sélectionnés).
- Tranche dorée sur le bord des cartes (dégradé laiton 1–2 px).
- Le plateau est une « boîte » : biseau visible sur tout le pourtour, vignettage radial
  très léger vers les bords pour l'effet table éclairée.

## Layout (console d'ingénieur)
- Grille de base 12 px, bordures hairline 1 px partout, pas de cartes imbriquées.
- En-tête fixe : titre, indicateur d'ère (Canal/Rail), indicateur de tour avec
  pastille « LED » du joueur actif, compteurs globaux.
- Trois colonnes desktop :
  - Gauche (~280 px) : panneaux joueurs (revenu, prêts, ressources, tuiles posées)
  - Centre (fluide) : plateau des Midlands, zoom/pan doux
  - Droite (~340 px) : marché charbon/fer (toujours visible, prix dynamiques),
    historique des actions, aide contextuelle
- Labels de section : uppercase, JetBrains Mono 10–11 px, tracking 0.18em.
- Mobile : le plateau reste prioritaire, panneaux en tiroirs.

## Motion (chorégraphie, pas de décoration)
- **Pose de tuile industrie** : spring physics — la tuile arrive avec un léger rebond
  (overshoot ~4 %, settle ~300 ms) + « poussière » (2–3 particules discrètes) + enfoncement
  visuel de 1 px à l'impact.
- **Tracé de lien canal/rail** : la ligne se dessine progressivement
  (`stroke-dasharray` animé, ~450 ms) de la ville d'origine vers la destination.
- **Carte jouée** : bascule 3D (`preserve-3d`, rotateY) vers la défausse, tranche dorée
  visible pendant la rotation.
- **Pions de score/revenu** : avancent par glissement avec easing doux, un cran à la fois
  si le gain est échelonné.
- **Flip de tuile (vente)** : rotation 3D sur l'axe horizontal, la face « flippée »
  révèle les revenus gagnés.
- Règle absolue : aucune animation décorative au scroll, aucun spinner générique ;
  chaque mouvement confirme une action de jeu. Durées ≤ 500 ms, interruptibles.

## Icônes industries (liberté créative)
Pictogrammes SVG dessinés main, trait simple crème sur fond teinté, style gravure :
- Filature de coton : bobine + fuseau
- Manufacture : engrenage à dents larges
- Charbon : motte de charbon facettée
- Fer : lingot + pince
- Poterie : vase à col
- Brasserie : tonneau cerclé
Chaque tuile a une couleur d'ère (canal = teinte parchemin, rail = teinte vert bouteille)
et un liseré laiton quand elle est flippée.

## Lisibilité — engagement non négociable
- Toute info de jeu (coût, ressources accessibles, liens actifs) lisible en < 1 s.
- Contraste texte/fond ≥ 4.5:1 partout ; les textures restent sous 7 % d'opacité.
- État interactif = changement de relief + liseré laiton, jamais seulement de couleur.
- Tooltips au survol de toute icône d'industrie (coût, revenus, conditions de pose).

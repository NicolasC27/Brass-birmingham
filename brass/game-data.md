# Brass: Birmingham — Dossier de données pour adaptation numérique

**Jeu** : Brass: Birmingham (Roxley Games, 2018), 2–4 joueurs, 2 ères (Canal 1770–1830, Rail 1830–1870).
**Objet du document** : spécification de données et de règles pour une implémentation fidèle.

## Sources utilisées (croisées)

| # | Source | Nature |
|---|--------|--------|
| S1 | Livret de règles officiel (PDF Roxley, version FR 2018.07.11 + texte EN intégral via rulespal.com/brass-birmingham/rulebook) | Primaire |
| S2 | Esoteric Order of Gamers — « Brass: Birmingham Rules Summary & Reference v1.2 » (Universal Head, orderofgamers.com) | Secondaire experte |
| S3 | Photos haute résolution du plateau de joueur (tapis) et du schéma de mise en place du livret officiel (analyse visuelle des 45 tuiles) | Primaire |
| S4 | Implémentation logicielle npow/brass-birmingham (GitHub, js/gameData.js — données vérifiées par l'auteur contre le mod Tabletop Simulator de Kini/ikegami) | Tertiaire (code) |
| S5 | Implémentation logicielle AndreSteenbergen/brass-birmingham (GitHub, FrontEnd/src/constants/*.js) | Tertiaire (code) |
| S6 | Implémentation logicielle lpopov101/brassbot (GitHub, brassboard.py, industries.py, deck.py, income.py, market.py) | Tertiaire (code) |

Chaque donnée critique a été croisée sur au moins 2 sources. Les rares points non tranchés sont signalés ⚠️ en fin de section concernée et regroupés en §8.

---

## 1. Carte du plateau

### 1.1 Villes et emplacements d'industrie

20 villes à bâtir + 2 « brasseries fermières » (Farm Breweries, emplacements sans nom) + 5 emplacements marchands en bord de carte.

Abréviations d'icônes d'industrie par emplacement (un emplacement peut autoriser 1 ou 2 industries) :
**C** = Filature de coton (Cotton Mill) · **M** = Manufacture (Manufacturer) · **Mch** = Mine de charbon (Coal Mine) · **F** = Usine sidérurgique (Iron Works) · **P** = Usine de céramique (Pottery) · **B** = Brasserie (Brewery).

Sources : S4, S5, S6 concordent à 100 % ; vérification visuelle sur le schéma officiel S1 pour Birmingham, Coventry, Stoke, Stone, Leek, Belper, Derby, Uttoxeter, Burton, Stafford, Redditch (S3).

| Ville | Nb d'emplacements | Emplacements (icônes autorisées) | Couleur de bannière |
|---|---|---|---|
| **Birmingham** | 4 | C/M · M · F · M | violette |
| **Coventry** | 3 | P · M/Mch · F/M | violette |
| **Nuneaton** | 2 | M/B · C/Mch | violette |
| **Redditch** | 2 | M/Mch · F | violette |
| **Dudley** | 2 | Mch · F | orange |
| **Kidderminster** | 2 | C/Mch · C | orange |
| **Wolverhampton** | 2 | M · M/Mch | orange |
| **Worcester** | 2 | C · C | orange |
| **Walsall** | 2 | F/M · M/B | dorée |
| **Tamworth** | 2 | C/Mch · C/Mch | dorée |
| **Coalbrookdale** | 3 | F/B · F · Mch | dorée |
| **Stafford** | 2 | M/B · P | rouge |
| **Cannock** | 2 | M/Mch · Mch | rouge |
| **Burton-upon-Trent** | 2 | M/Mch · B | rouge |
| **Leek** | 2 | C/M · C/Mch | bleue |
| **Stoke-on-Trent** | 3 | C/M · P/F · M | bleue |
| **Stone** | 2 | C/B · M/Mch | bleue |
| **Uttoxeter** | 2 | M/B · C/B | bleue |
| **Belper** | 3 | C/M · Mch · P | turquoise (teal) |
| **Derby** | 3 | C/B · C/M · F | turquoise (teal) |

**Rôle des couleurs de bannière** (S1, « Location banners ») : elles déterminent quelles cartes Lieu sont dans la pioche selon le nombre de joueurs :
- 2 joueurs : les cartes Lieu **bleues ET turquoises** sont retirées (Leek, Stoke, Stone, Uttoxeter, Belper, Derby hors pioche).
- 3 joueurs : seules les **turquoises** sont retirées (Belper, Derby + 1 carte Uttoxeter).
- 4 joueurs : toutes les cartes.
- Les autres couleurs (rouge/orange/doré/violet) sont purement décoratives.
- NB : à 2–3 joueurs, on peut quand même **construire** dans les villes bleues/turquoises via des cartes Industrie (ville dans son réseau) ou un Joker Lieu (S1).

### 1.2 Brasseries fermières (Farm Breweries) — 2 emplacements

- Chacune a **1 seul emplacement affichant l'icône Brasserie** ; on y place **1 baril de bière** à la mise en place.
- On ne peut y construire qu'avec une **carte Industrie Brasserie** ou un **Joker Industrie** (PAS de carte Lieu/Joker Lieu — S1).
- **Ferme nord** (entre Cannock et Walsall) : nécessite une tuile Liaison **Cannock ↔ Ferme** pour être connectée.
- **Ferme sud** (entre Kidderminster et Worcester) : une tuile Liaison placée entre **Kidderminster et Worcester** connecte aussi la ferme ; **aucune seconde tuile** n'y est requise ni permise (S1).
- Une brasserie construite sur une ferme se comporte comme toute brasserie (1 baril à l'ère canal, 2 à l'ère rail).

### 1.3 Emplacements marchands (Mercantile) — bord de carte

5 emplacements marchands. Chacun : affiche **2 icônes « lien »** (vaut donc 2 PV pour chaque tuile Liaison adjacente lors du décompte — S3/S6), un **icône de connexion au marché du charbon** (les 5 marchands donnent tous accès au marché charbon — S1), des emplacements pour tuiles Marchand, et 1 **emplacement de baril par tuile Marchand non vierge** (S1). Bonus de bière marchande accordé quand on consomme le baril du marchand pendant une action Vente.

| Marchand | Emplacements tuile | Nb joueurs min | Bonus bière | Connexions (villes liées) |
|---|---|---|---|---|
| **Shrewsbury** (haut-gauche) | 1 | 2+ | **+4 PV** | Coalbrookdale |
| **Warrington** (haut-droite) | 2 | 3+ | **+£5** | Stoke-on-Trent |
| **Nottingham** (droite) | 2 | 4 | **+3 PV** | Derby |
| **Gloucester** (bas-gauche) | 2 | 2+ | **Développement gratuit** (retirer 1 tuile de plus bas niveau du tapis, sans fer ; interdit pour les céramiques « ampoule ») | Worcester · Redditch |
| **Oxford** (bas) | 2 | 2+ | **+2 espaces** sur la piste Progression (revenu) | Birmingham · Redditch |

- Mise en place : à 2 joueurs, aucune tuile à Warrington ni Nottingham ; à 3 joueurs, aucune à Nottingham (S1). Les tuiles Marchand éligibles sont mélangées puis placées 1 par emplacement, face visible.
- Conséquence : à 2 joueurs, **5 tuiles** sont placées (Shrewsbury 1 + Gloucester 2 + Oxford 2) ; à 3 joueurs 7 ; à 4 joueurs 9.

**Composition des 9 tuiles Marchand** (icônes de biens achetés ; pions « nb de joueurs » en haut de chaque tuile) — ⚠️ voir §8, point A :
- Pool 2 joueurs (5 tuiles) — **certain** (S4, S5, S6 concordent) : 2 × vierge · 1 × coton · 1 × manufacture · 1 × « tous biens » (coton+manufacture+céramique).
- Ajout 3 joueurs (2 tuiles) — **variante 1** (S4) : céramique + manufacture · **variante 2** (S5, S6) : céramique + vierge.
- Ajout 4 joueurs (2 tuiles) — **variante 1** (S4) : « tous biens » + coton · **variante 2** (S5, S6) : coton + manufacture.
- Totaux : variante 1 → vierge 2 / tous-biens 2 / coton 2 / manufacture 2 / céramique 1 ; variante 2 → vierge 3 / tous-biens 1 / coton 2 / manufacture 2 / céramique 1.
- Confirmé par le schéma officiel S1 : la mise en place 4 joueurs illustrée montre au moins 1 « tous biens », 2 coton, 1 manufacture, 1 vierge, 1 céramique (compatible avec les deux variantes).
- **Règle associée (certaine)** : une tuile Marchand vierge n'a **pas** d'emplacement de baril (S1 : « placez 1 baril sur chaque emplacement de baril à côté d'une tuile Marchand (non vierge) »).

---

## 2. Connexions (lignes entre lieux)

39 lignes distinctes. **30** praticables aux deux ères (canal + rail), **8 rail uniquement**, **1 canal uniquement** (Burton-upon-Trent ↔ Walsall). En ère rail, on construit sur les « lignes de chemin de fer » : toutes les lignes sauf Burton↔Walsall.
Sources : S4 et S5 identiques à 100 % ; S6 identique sauf omission de Birmingham↔Dudley (erreur isolée de S6 ; présence confirmée par S4+S5, correspond au canal historique Birmingham–Dudley).

### 2.1 Canal + rail (30)

| Liaison | | Liaison |
|---|---|---|
| Belper ↔ Derby | | Dudley ↔ Kidderminster |
| Birmingham ↔ Coventry | | Dudley ↔ Wolverhampton |
| Birmingham ↔ Dudley | | Gloucester ↔ Redditch |
| Birmingham ↔ Oxford (marchand) | | Gloucester ↔ Worcester |
| Birmingham ↔ Tamworth | | Kidderminster ↔ Worcester *(connecte aussi la brasserie fermière sud)* |
| Birmingham ↔ Walsall | | Leek ↔ Stoke-on-Trent |
| Birmingham ↔ Worcester | | Nuneaton ↔ Tamworth |
| Burton-upon-Trent ↔ Derby | | Redditch ↔ Oxford (marchand) |
| Burton-upon-Trent ↔ Stone | | Stafford ↔ Stone |
| Burton-upon-Trent ↔ Tamworth | | Stoke-on-Trent ↔ Stone |
| Cannock ↔ Stafford | | Stoke-on-Trent ↔ Warrington (marchand) |
| Cannock ↔ Brasserie fermière nord | | Walsall ↔ Wolverhampton |
| Cannock ↔ Walsall | | Coalbrookdale ↔ Kidderminster |
| Cannock ↔ Wolverhampton | | Coalbrookdale ↔ Shrewsbury (marchand) |
| Derby ↔ Nottingham (marchand) | | Coalbrookdale ↔ Wolverhampton |

### 2.2 Rail uniquement (8)

Belper ↔ Leek · Birmingham ↔ Nuneaton · Birmingham ↔ Redditch · Burton-upon-Trent ↔ Cannock · Coventry ↔ Nuneaton · Derby ↔ Uttoxeter · Stone ↔ Uttoxeter · Tamworth ↔ Walsall

### 2.3 Canal uniquement (1)

Burton-upon-Trent ↔ Walsall

### 2.4 Notes d'implémentation

- Une « ligne » ne peut contenir qu'**1 tuile Liaison** par partie (jamais deux joueurs sur la même ligne ; une tuile canal n'est PAS remplacée par du rail — en fin d'ère canal les tuiles Liaison sont retirées, libérant les lignes).
- Chaque joueur dispose de **14 tuiles Liaison** (56 au total, S1), recto canal / verso rail.
- Les tuiles Liaison rapportent en fin d'ère : **1 PV par icône « lien »** affichée dans les lieux adjacents (tuiles Industrie : 0, 1 ou 2 icônes selon la tuile — voir colonne « Liens » §3 ; marchands : 2 ; brasserie fermière vide : 0), puis sont retirées du plateau (S1).

---

## 3. Tuiles Industrie

45 tuiles par joueur (180 au total) : 11 Filatures, 11 Manufactures, 7 Brasseries, 5 Céramiques, 4 Sidérurgies, 7 Mines de charbon (S1, liste des composants — concorde avec les quantités S4/S5/S6).

**Lecture des tableaux** :
- **Coût** : argent (£) + cubes charbon/fer à consommer.
- **Revenu** : nombre d'**espaces** (pas niveaux) à avancer sur la piste Progression quand la tuile est retournée (flip) — S1 : « advance your Income Marker … by the number of spaces (not income levels) shown ».
- **PV** : points marqués en fin d'ère si la tuile est retournée (icône en bas à gauche du verso).
- **Liens** : nombre d'icônes « lien » de la tuile = PV qu'elle accorde à chaque tuile Liaison adjacente en fin d'ère (0, 1 ou 2).
- **Bière** : barils à consommer pour vendre la tuile (Filature/Manufacture/Céramique).
- **Cubes/Barils** : ressources placées sur la tuile à la construction (mine/sidérurgie/brasserie).
- **Ère** : « canal » = icône canal à gauche de l'emplacement sur le tapis, tuile **inconstructible à l'ère rail** (il faut la retirer via Développement) ; « rail » = inconstructible à l'ère canal ; « — » = les deux ères.
- Toutes les stats ci-dessous : S4 + S6 concordantes, **et** lues directement sur la photo du tapis de joueur officiel (S3) pour les 45 tuiles, plus confirmation ponctuelle S2/presse (Manufacture I : £8+1 charbon, +5 revenu, 3 PV, 2 liens ; Manufacture VIII : £20+2 fer, +1, 11 PV, 1 lien).

### 3.1 Filature de coton / Cotton Mill — 11 par joueur

| Niv. | Coût £ | Charbon | Fer | Revenu (espaces) | PV | Liens | Bière pour vendre | Qté | Ère |
|---|---|---|---|---|---|---|---|---|---|
| I | 12 | 0 | 0 | +5 | 5 | 1 | 1 | 3 | canal |
| II | 14 | 1 | 0 | +4 | 5 | 2 | 1 | 2 | — |
| III | 16 | 1 | 1 | +3 | 9 | 1 | 1 | 3 | — |
| IV | 18 | 1 | 1 | +2 | 12 | 1 | 1 | 3 | — |

### 3.2 Manufacture / Manufacturer — 11 par joueur

| Niv. | Coût £ | Charbon | Fer | Revenu | PV | Liens | Bière | Qté | Ère |
|---|---|---|---|---|---|---|---|---|---|
| I | 8 | 1 | 0 | +5 | 3 | 2 | 1 | 1 | canal |
| II | 10 | 0 | 1 | +1 | 5 | 1 | 1 | 2 | — |
| III | 12 | 2 | 0 | +4 | 4 | **0** | 1 | 1 | — |
| IV | 8 | 0 | 1 | +6 | 3 | 1 | 1 | 1 | — |
| V | 16 | 1 | 0 | +2 | 8 | 2 | **2** | 2 | — |
| VI | 20 | 0 | 0 | +6 | 7 | 1 | 1 | 1 | — |
| VII | 16 | 1 | 1 | +4 | 9 | **0** | 1 | 1 | — |
| VIII | 20 | 0 | 2 | +1 | 11 | 1 | 1 | 2 | — |

### 3.3 Mine de charbon / Coal Mine — 7 par joueur

| Niv. | Coût £ | Charbon | Fer | Revenu | PV | Liens | Cubes posés | Qté | Ère |
|---|---|---|---|---|---|---|---|---|---|
| I | 5 | 0 | 0 | +4 | 1 | 2 | 2 | 1 | canal |
| II | 7 | 0 | 0 | +7 | 2 | 1 | 3 | 2 | — |
| III | 8 | 0 | 1 | +6 | 3 | 1 | 4 | 2 | — |
| IV | 10 | 0 | 1 | +5 | 4 | 1 | 5 | 2 | — |

- Flip quand le **dernier cube** est retiré (souvent pendant le tour d'un adversaire).
- À la construction, si la mine est **connectée à un emplacement marchand** (même sans tuile Marchand) : tous les cubes possibles partent immédiatement au marché du charbon (cases les plus chères d'abord, le joueur encaisse le prix imprimé de chaque case) ; si le dernier cube part ainsi, la tuile flip immédiatement (S1).
- Les cubes ne sont vendus au marché **qu'au moment de la construction**, jamais après (S1).

### 3.4 Usine sidérurgique / Iron Works — 4 par joueur

| Niv. | Coût £ | Charbon | Fer | Revenu | PV | Liens | Cubes posés | Qté | Ère |
|---|---|---|---|---|---|---|---|---|---|
| I | 5 | 1 | 0 | +3 | 3 | 1 | 4 | 1 | canal |
| II | 7 | 1 | 0 | +3 | 5 | 1 | 4 | 1 | — |
| III | 9 | 1 | 0 | +2 | 7 | 1 | 5 | 1 | — |
| IV | 12 | 1 | 0 | +1 | 9 | 1 | 6 | 1 | — |

- Flip quand le dernier cube est retiré.
- À la construction : **toujours** vidée vers le marché du fer (connectée ou non à un marchand), cases les plus chères d'abord, encaissement des prix, flip immédiat si vidée (S1).

### 3.5 Usine de céramique / Pottery — 5 par joueur

| Niv. | Coût £ | Charbon | Fer | Revenu | PV | Liens | Bière | Qté | Ère | Développable ? |
|---|---|---|---|---|---|---|---|---|---|---|
| I | 17 | 0 | 1 | +5 | 10 | 1 | 1 | 1 | **— (les 2 ères)** | ❌ ampoule |
| II | 0 | 1 | 0 | +1 | 1 | 1 | 1 | 1 | — | ✅ |
| III | 22 | 2 | 0 | +5 | 11 | 1 | 2 | 1 | — | ❌ ampoule |
| IV | 0 | 1 | 0 | +1 | 1 | 1 | 1 | 1 | — | ✅ |
| V | 24 | 2 | 0 | +5 | 20 | 1 | 2 | 1 | **rail** | ✅ |

- Exception officielle (S1) : contrairement aux autres tuiles de niveau 1, la **Céramique I peut être construite à l'ère rail**.
- Les tuiles à icône **ampoule** (I et III) **ne peuvent pas être retirées via Développement** : seule la construction les enlève du tapis (S1). La V n'a pas d'ampoule (développable — S4/S6 concordants).
- Les Céramiques se **vendent** comme les filatures/manufactures (action Vente via un marchand affichant l'icône céramique ou « tous biens ») — attention : à 2 joueurs, seule la tuile « tous biens » du pool marchand accepte la céramique (la tuile céramique n'entre en jeu qu'à 3+ joueurs).
- Villes avec emplacements céramique : **Belper, Coventry, Stoke-on-Trent, Stafford** (4 villes, cf. §1.1).

### 3.6 Brasserie / Brewery — 7 par joueur

| Niv. | Coût £ | Charbon | Fer | Revenu | PV | Liens | Qté | Ère |
|---|---|---|---|---|---|---|---|---|
| I | 5 | 0 | 1 | +4 | 4 | 2 | 2 | canal |
| II | 7 | 0 | 1 | +5 | 5 | 2 | 2 | — |
| III | 9 | 0 | 1 | +5 | 7 | 2 | 2 | — |
| IV | 9 | 0 | 1 | +5 | 9 | 2 | 1 | **rail** |

- **Barils posés à la construction : 1 à l'ère canal, 2 à l'ère rail** (règle générale officielle S1, tous niveaux ; la IV étant rail-only elle reçoit donc toujours 2 barils — ⚠️ l'implémentation S4 code en dur « 2 barils » pour la IV et 1 pour I–III, ce qui revient au même pour la IV mais ne gère pas le cas « II–III construites à l'ère rail » ; **suivre la règle S1**).
- Flip quand le dernier baril est consommé (par n'importe qui).
- Pas de vente nécessaire : la bière est consommée par les actions Vente et Réseau (double rail).

### 3.7 Règles transversales des tuiles

- On construit toujours la tuile **de plus bas niveau** restante de la colonne correspondante du tapis (S1).
- Placement : de préférence sur un emplacement n'affichant **que** l'icône de l'industrie ; sinon un emplacement à double icône l'autorisant ; sinon impossible (sauf sur-construction, cf. §5.2).
- Ère canal : **max 1 tuile Industrie par joueur et par lieu** ; ère rail : plusieurs tuiles par lieu autorisées (S1).
- Sur-construction (overbuild) : toujours même type d'industrie, niveau supérieur ; sur **ses** tuiles : libre (ressources présentes retournent à la réserve) ; sur une tuile **adverse** : uniquement Mine de charbon ou Sidérurgie, et seulement s'il ne reste **aucun cube** de ce type sur tout le plateau, marché inclus (S1). Les tuiles sur-construites sont retirées du jeu (pas de PV) ; revenus/PV déjà gagnés sont conservés.

---

## 4. Cartes

### 4.1 Composants

- **64 cartes** Lieu/Industrie (4 joueurs) + **8 cartes Joker** (4 Joker Lieu + 4 Joker Industrie, toujours toutes utilisées) (S1).
- Les cartes portent en bas à droite des pions « 2 / 3 / 4 joueurs » : à moins de 4 joueurs, retirer toutes les cartes affichant un nombre supérieur (S1).

### 4.2 Composition du deck (S4 + S5 identiques ; S6 identique sauf Derby 2 au lieu de 3 à 4 joueurs — le total officiel de 64 cartes tranche en faveur de 3)

**Cartes Lieu (par ville)** :

| Ville | 2 joueurs | 3 joueurs | 4 joueurs |
|---|---|---|---|
| Stafford | 2 | 2 | 2 |
| Burton-upon-Trent | 2 | 2 | 2 |
| Cannock | 2 | 2 | 2 |
| Tamworth | 1 | 1 | 1 |
| Walsall | 1 | 1 | 1 |
| Coalbrookdale | 3 | 3 | 3 |
| Dudley | 2 | 2 | 2 |
| Kidderminster | 2 | 2 | 2 |
| Wolverhampton | 2 | 2 | 2 |
| Worcester | 2 | 2 | 2 |
| Birmingham | 3 | 3 | 3 |
| Coventry | 3 | 3 | 3 |
| Nuneaton | 1 | 1 | 1 |
| Redditch | 1 | 1 | 1 |
| Leek (bleu) | 0 | 2 | 2 |
| Stoke-on-Trent (bleu) | 0 | 3 | 3 |
| Stone (bleu) | 0 | 2 | 2 |
| Uttoxeter (bleu) | 0 | 1 | 2 |
| Belper (turquoise) | 0 | 0 | 2 |
| Derby (turquoise) | 0 | 0 | 3 |
| **Total Lieu** | **27** | **35** | **41** |

**Cartes Industrie** :

| Type | 2 joueurs | 3 joueurs | 4 joueurs |
|---|---|---|---|
| Sidérurgie (Iron Works) | 4 | 4 | 4 |
| Mine de charbon (Coal) | 2 | 2 | 3 |
| Céramique (Pottery) | 2 | 2 | 3 |
| Brasserie (Brewery) | 5 | 5 | 5 |
| Double Coton + Manufacture | 0 | 6 | 8 |
| **Total Industrie** | **13** | **19** | **23** |

- **Il n'existe pas de carte Filature seule ni Manufacture seule** : le coton et la manufacture n'apparaissent que sur les cartes **doubles** (2 icônes ; la carte sert pour l'une ou l'autre industrie).
- **Totaux du deck : 40 (2 j.) / 54 (3 j.) / 64 (4 j.)**.
- Cohérence vérifiée : à 4 joueurs, 16 cartes passent par chaque main par ère (8 en main initiale + 8 piochées) → 15 actions (1ʳᵉ manche = 1 action) ; la 9ᵉ carte (défausse face cachée initiale) n'est pas jouable. Même équation à 2 et 3 joueurs.

### 4.3 Règles de main/pioche/défausse

- Main initiale : **8 cartes** + 1 carte piochée posée **face cachée** = début de la défausse personnelle (cette carte n'est pas jouable ; elle sera retournée puis mélangée pour l'ère rail) (S1).
- Chaque action (y compris passer) = **défausser 1 carte** face visible sur sa défausse ; exception : les Jokers défaussés retournent sur leur zone de pioche dédiée (S1).
- Après son tour : **recompléter à 8 cartes** depuis la pioche. Pioche épuisée → la main diminue chaque manche jusqu'à être vide.
- L'ère se termine quand pioche **et** mains sont vides : exactement **8 / 9 / 10 manches par ère à 4 / 3 / 2 joueurs** (S1).
- Joker Lieu = n'importe quelle carte Lieu (**sauf les 2 brasseries fermières**) ; Joker Industrie = n'importe quelle carte Industrie (S1).

---

## 5. Mécaniques précises

### 5.1 Les 6 actions (coût : 1 carte défaussée chacune, sauf indication)

| Action | Coût | Effet |
|---|---|---|
| **Construire (Build)** | 1 carte **appropriée** (Lieu de la ville / Joker Lieu / Industrie correspondante dans son réseau / Joker Industrie) + coût de la tuile (£ + charbon + fer) | Placer la tuile de plus bas niveau de l'industrie choisie |
| **Réseau (Network)** | 1 carte quelconque + £3 (canal) ou £5 + 1 charbon (rail) | 1 tuile Liaison ; ère rail : option 2 liaisons pour £15 + 2 charbon + 1 bière |
| **Développer (Develop)** | 1 carte + **1 fer par tuile retirée** | Retirer 1 ou 2 tuiles (plus bas niveau de leur colonne au moment du retrait) du tapis |
| **Vendre (Sell)** | 1 carte + bière requise par tuile | Retourner (flip) 1+ tuiles Filature/Manufacture/Céramique connectées à un marchand |
| **Emprunter (Loan)** | 1 carte | +£30 ; marqueur de revenu **−3 niveaux** (pas espaces), placé sur l'espace le plus haut du nouveau niveau ; interdit si cela descend sous **−10** |
| **Éclaireur (Scout)** | 1 carte + **2 cartes supplémentaires** (3 au total) | Prendre 1 Joker Lieu + 1 Joker Industrie ; **interdit si on a déjà un Joker en main** |

- 2 actions par tour (même action possible deux fois) ; **1ʳᵉ manche de l'ère canal : 1 seule action** (S1). Exception de la 1ʳᵉ manche : uniquement à l'ère canal.
- Passer est autorisé mais coûte quand même 1 carte par action passée.
- **Tout argent dépensé** pendant son tour est posé sur sa tuile Personnage (piste d'ordre du tour) — y compris achats au marché.

### 5.2 Construction — conditions détaillées

- Carte Lieu : construire n'importe quelle industrie dans la ville nommée, **même hors de son réseau**.
- Carte Industrie : construire cette industrie dans un lieu **faisant partie de son réseau** (lieu avec une de ses tuiles, ou adjacent à une de ses tuiles Liaison).
- **Si un joueur n'a aucune tuile sur le plateau** : il peut défausser une carte Industrie pour construire l'industrie correspondante **n'importe où**, ou n'importe quelle carte pour poser une Liaison sur n'importe quelle ligne (S1).
- Le charbon requis impose que le lieu de construction soit **connecté** à une source de charbon ; le fer n'impose **aucune connexion** (S1).
- Restrictions d'ère : icônes « canal » (tuiles I sauf Céramique I) inconstructibles à l'ère rail ; « rail » (Brasserie IV, Céramique V) inconstructibles à l'ère canal.
- Sur-construction : cf. §3.7.

### 5.3 Approvisionnement en charbon

Consommation depuis, **dans l'ordre** (S1) :
1. **La mine de charbon non retournée connectée la plus proche** (distance = nombre de tuiles Liaison, tous joueurs confondus ; égalité → le joueur choisit ; si la mine s'épuise en cours de consommation, passer à la suivante la plus proche). **Gratuit.**
2. À défaut de mine connectée : **achat au marché du charbon**, au prix le plus bas disponible, **à condition d'être connecté à un emplacement marchand** (les 5 marchands portent l'icône ; avec ou sans tuile Marchand). Marché vide → **£8 par cube** quand même possible.
3. Les cubes consommés retournent à la réserve générale.

### 5.4 Approvisionnement en fer

- **Aucune connexion requise** (S1, explicite). Consommation depuis :
1. **N'importe quelle(s) sidérurgie(s) non retournée(s)** sur le plateau (tous joueurs ; pas de notion de proximité ; plusieurs fers peuvent venir de sidérurgies différentes). Gratuit.
2. À défaut de sidérurgie non retournée : **marché du fer**, prix le plus bas d'abord, **sans** besoin de connexion à un marchand. Marché vide → **£6 par cube**.

### 5.5 Approvisionnement en bière (consommation)

Sources autorisées (S1), chaque baril pouvant provenir d'une source différente :
1. **Ses propres brasseries non retournées** — **sans** condition de connexion.
2. **Brasseries non retournées adverses** — doivent être **connectées** au lieu où la bière est requise (pour la Vente : à la tuile vendue ; pour le double rail : à la **2ᵉ liaison**, après placement).
3. **Baril à côté de la tuile Marchand** à laquelle on vend (uniquement pendant une action Vente) → déclenche le **bonus marchand** du lieu (cf. §1.3).
- On ne peut pas lancer l'action Vente si on ne peut pas consommer la bière requise (S1).
- Barils consommés → réserve générale. Réserve physique : 15 barils (S1), mais la réserve est réputée illimitée.

### 5.6 Vente (Sell) — procédure

1. Défausser 1 carte quelconque.
2. Choisir 1 de ses tuiles Filature/Manufacture/Céramique non retournée, **connectée à une tuile Marchand affichant l'icône de cette industrie** (ou « tous biens »).
3. Consommer la bière requise (icône en haut à droite : 1 ou 2 barils selon la tuile — cf. §3).
4. Retourner la tuile et avancer le marqueur de revenu du nombre d'**espaces** indiqué.
5. **Répéter** pour d'autres tuiles (y compris d'autres industries) dans la même action.
- Pas de limite de tuiles vendues par action ; chaque tuile vendue via un marchand peut consommer le baril de ce marchand et déclencher son bonus (1 baril par tuile Marchand par ère — réarmé à la transition).

### 5.7 Marchés charbon et fer

| | Marché charbon | Marché fer |
|---|---|---|
| Cases | 14 (2 × £1, 2 × £2, … 2 × £7) | 10 (2 × £1, … 2 × £5) |
| Mise en place | 13 cubes (une des 2 cases £1 reste vide) | 8 cubes (**les deux** cases £1 restent vides) |
| Achat | case la moins chère d'abord ; vide → £8/cube | case la moins chère d'abord ; vide → £6/cube |
| Vente (à la construction d'une mine/sidérurgie) | remplit les cases **les plus chères d'abord** ; le joueur encaisse la valeur imprimée de chaque case remplie | idem |
| Rechargement périodique | **AUCUN** — les marchés ne se remplissent que lorsqu'une mine/sidérurgie est construite (⚠️ contrairement à une intuition « fin de tour », il n'existe pas de rechargement automatique — S1) | idem |

Sources : S1 + S4 + S6 concordants (prix max £8 charbon / £6 fer confirmés par S1).

### 5.8 Emprunt (Loan)

- +£30, **−3 niveaux de revenu** ; marqueur placé sur l'espace le plus haut du niveau atteint ; impossible si le niveau résultant < **−10** ; jamais remboursé (S1).

### 5.9 Développement (Develop)

- Retirer 1 ou 2 tuiles du tapis (remises dans la boîte), chacune devant être la plus basse de sa colonne au moment du retrait ; **1 fer consommé par tuile** (règles du fer §5.4) ; Céramiques ampoule (I et III) impossibles à développer (S1).

### 5.10 Réseau (Network)

- Ère canal : liaisons canal uniquement, **1 liaison max par action, £3**.
- Ère rail : liaisons rail uniquement ; **1 liaison = £5 + 1 charbon** ; option **2 liaisons = £15 + 1 charbon par liaison + 1 bière** (bière provenant obligatoirement d'une **brasserie**, jamais d'un baril marchand ; si brasserie adverse : connectée à la 2ᵉ liaison après placement).
- Chaque liaison rail est placée séparément et doit être **connectée à une source de charbon après placement** (la 1ʳᵉ liaison peut servir à connecter la 2ᵉ).
- La tuile posée doit être adjacente à un lieu de son réseau (sauf si aucune tuile sur le plateau : n'importe quelle ligne).

### 5.11 Piste Progression, revenu et ordre du tour

- Piste de **100 espaces (0–99)** ; chaque espace affiche une pièce = **niveau de revenu**. Correspondance espaces → niveau (S4 + S6 identiques, vérifié visuellement sur le plateau officiel S3) :
  - espaces 0–10 → niveaux **−10 à 0** (1 espace par niveau)
  - espaces 11–30 → niveaux **1 à 10** (2 espaces/niveau)
  - espaces 31–60 → niveaux **11 à 20** (3 espaces/niveau)
  - espaces 61–96 → niveaux **21 à 29** (4 espaces/niveau)
  - espaces 97–99 → niveau **30** (plafond ; impossible de dépasser +30)
- **Départ : marqueur de revenu sur l'espace « 10 » = niveau £0** ; marqueur PV sur « 0 » (S1).
- Gains de revenu des tuiles = avancée en **espaces** ; emprunt = recul en **niveaux** (S1, distinction explicite).
- Piste PV : >100 PV → on refait un tour de piste (S1).
- **Ordre du tour** : en fin de manche, celui qui a **dépensé le moins joue en premier**, le plus dépensier en dernier ; **égalité → ordre relatif inchangé** ; l'argent sur les tuiles Personnage retourne à la banque (S1).

### 5.12 Fin de manche et revenu

1. Déterminer l'ordre du tour (cf. 5.11).
2. **Encaisser son revenu** (sauf à la fin de la dernière manche de la partie). Revenu négatif → **payer** la banque ; en cas de manque : retirer une ou plusieurs de ses tuiles Industrie (pas Liaison) du plateau, chacune valant **la moitié de son coût, arrondie à l'inférieur** (tuiles retirées du jeu ; on garde l'excédent ; on s'arrête dès que le manque est couvert ; interdit de « vendre » des tuiles pour toute autre raison) ; si toujours insolvable : **−1 PV par £1 manquant** (S1).

### 5.13 Fin d'ère et transition

Fin de chaque ère (quand pioche + mains vides) :
1. **Score des Liaisons** : 1 PV par icône « lien » dans les lieux adjacents (tuiles 0/1/2, marchands 2) ; retirer les tuiles Liaison en les comptant.
2. **Score des tuiles Industrie retournées** : PV en bas à gauche ; les non-retournées ne marquent rien.

Fin d'ère canal, en plus :
3. **Retirer toutes les tuiles Industrie de niveau 1 du plateau** (pas des tapis) ; niveau 2+ conservés (et pourront re-scorer à l'ère rail).
4. **Réarmer la bière marchande** (1 baril sur chaque emplacement vide à côté d'une tuile Marchand non vierge).
5. **Mélanger toutes les défausses** (retourner la carte face cachée du fond) → nouvelle pioche.
6. Re-piocher 8 cartes chacun.

### 5.14 Fin de partie

- Gagnant = plus de PV après le décompte de l'ère rail ; égalité → **revenu le plus élevé**, puis **argent restant** ; sinon égalité partagée (S1).

### 5.15 Variante partie d'initiation (ère canal uniquement)

Après le décompte normal de l'ère canal : +1 PV par £4 (max 15 PV) · +PV égaux au niveau de revenu (négatif = malus) · re-score des tuiles Industrie de niveau 2+ (S1).

---

## 6. Mise en place initiale

**Plateau** (S1) :
1. Retirer cartes et tuiles Marchand au-dessus du nombre de joueurs (cartes : cf. §4.2 ; marchands : cf. §1.3).
2. Jokers : 2 piles face visible (Lieu / Industrie) sur 2 zones de pioche ; deck mélangé face cachée sur la 3ᵉ zone.
3. Tuiles Marchand mélangées, 1 par emplacement marchand actif, face visible.
4. 1 baril par emplacement de baril à côté d'une tuile Marchand non vierge ; 1 baril sur chaque brasserie fermière (2).
5. Marché charbon : 13 cubes (1 case £1 vide) ; marché fer : 8 cubes (2 cases £1 vides).
6. Réserves (charbon 30, fer 18, bière 15) et banque (77 jetons £) à côté — réputées illimitées.

**Par joueur** (S1) :
- £17 de départ.
- 14 tuiles Liaison + 45 tuiles Industrie empilées par type/niveau sur le tapis (face « haut noir » vers le bas).
- Marqueur PV sur « 0 », marqueur de revenu sur « 10 » (= niveau £0).
- 8 cartes en main + 1 carte face cachée (début de défausse).
- Tuiles Personnage mélangées sur la piste d'ordre du tour pour l'ordre initial.

**Tuiles retirées selon le nombre de joueurs** : cf. §4.2 (cartes) et §1.3 (tuiles Marchand). Aucune tuile Industrie n'est retirée quel que soit le nombre de joueurs.

---

## 7. Composants — rappel chiffré (S1)

1 plateau (double face jour/nuit, sans différence de règles) · 4 tapis · 4 tuiles Personnage · 56 tuiles Liaison · 8 Jokers · 64 cartes · 4 aides de jeu · 4 marqueurs PV · 4 marqueurs de revenu · 18 cubes fer · 30 cubes charbon · 15 barils · 77 jetons £ (ou 78 jetons « iron clays » en édition de luxe) · 180 tuiles Industrie · 9 tuiles Marchand.

---

## 8. Points incertains ou contradictoires entre sources

- **A. Composition exacte des 9 tuiles Marchand** (ajouts 3 et 4 joueurs) : S4 dit {céramique + manufacture} (3 j.) et {tous-biens + coton} (4 j.) ; S5 et S6 disent {céramique + vierge} (3 j.) et {coton + manufacture} (4 j.). Le pool à 2 joueurs (2 vierges, 1 coton, 1 manufacture, 1 tous-biens) est certain. **Recommandation d'implémentation : paramétrer ce manifeste** ; la photographie officielle de mise en place ne tranche pas. (Impact faible mais réel en partie à 3–4 joueurs.)
- **B. Bonus d'Oxford** : le livret dit littéralement « avancer de 2 **espaces** » (S1/S2) ; S4/S6 le codent comme +2 (leurs modèles assimilent espaces et niveaux pour ce bonus). Suivre S1 : **2 espaces** de piste Progression.
- **C. Brasserie II–III construites à l'ère rail** : règle officielle = 2 barils (S1). L'implémentation S4 code 1 baril pour I–III (simplification incorrecte pour ce cas). Suivre S1.
- **D. Birmingham ↔ Dudley** : présent dans S4 et S5 (canal+rail), absent de S6. Retenue : présente (2 sources + géographie historique). À re-vérifier sur une photo HD du plateau si possible.
- **E. Bière à Gloucester avec tuile vierge** : S1 interdit un baril à côté d'une tuile vierge ; le schéma officiel semble montrer 2 barils à Gloucester (probablement parce que l'illustration y place 2 tuiles non vierges). Appliquer S1.
- **F. Nombre de manches par ère** : 8/9/10 à 4/3/2 joueurs (S1, cohérent avec le deck) — certain ; noter que S6 (brassbot) contient par ailleurs une erreur de manifeste de cartes (Derby 2 au lieu de 3 à 4 joueurs, total 63 au lieu de 64) : écarter S6 pour les cartes.
- **G. Tuile Marchand « vierge »** : n'achète rien et n'a pas d'emplacement de baril (S1) ; l'icône « tous biens » accepte coton, manufacture **et** céramique.

*Fin du dossier. Toute donnée non signalée ⚠️ est confirmée par au moins deux sources indépendantes, dont le livret officiel et/ou la photographie du matériel.*

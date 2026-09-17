/* the tables of the club are not named by their hosts: each one draws its
   name from the register below, a hundred works, pits, wharves and inns of
   the Midlands around 1800. The English name is the key the office keeps;
   each reader sees it in their own language. A name in use at another live
   table is skipped while any remain free. */

const REGISTER: readonly (readonly [en: string, fr: string])[] = [
  ['Soho Foundry', 'Fonderie de Soho'],
  ['Coalbrookdale', 'Coalbrookdale'],
  ['Etruria Works', 'Usine d’Etruria'],
  ['Cromford Mill', 'Filature de Cromford'],
  ['Bridgewater Wharf', 'Quai de Bridgewater'],
  ['Albion Mill', 'Moulin d’Albion'],
  ['Round Foundry', 'Fonderie Ronde'],
  ['Bersham Ironworks', 'Forges de Bersham'],
  ['Ketley Forge', 'Forge de Ketley'],
  ['Horsehay Works', 'Ateliers de Horsehay'],
  ['Bedlam Furnaces', 'Hauts-fourneaux de Bedlam'],
  ['Wedgwood Kilns', 'Fours Wedgwood'],
  ['Spode Yard', 'Cour Spode'],
  ['Longton Pottery', 'Poterie de Longton'],
  ['Burslem Bottle Ovens', 'Fours-bouteilles de Burslem'],
  ['Chesterfield Canal', 'Canal de Chesterfield'],
  ['Trent Lock', 'Écluse de la Trent'],
  ['Fazeley Junction', 'Jonction de Fazeley'],
  ['Gas Street Basin', 'Bassin de Gas Street'],
  ['Stourport Basin', 'Bassin de Stourport'],
  ['Shardlow Wharf', 'Quai de Shardlow'],
  ['Wolverton Cut', 'Tranchée de Wolverton'],
  ['Foxton Locks', 'Écluses de Foxton'],
  ['Harecastle Tunnel', 'Tunnel de Harecastle'],
  ['Dudley Tunnel', 'Tunnel de Dudley'],
  ['Netherton Furnace', 'Fourneau de Netherton'],
  ['Tipton Green', 'Pré de Tipton'],
  ['Bilston Ironworks', 'Forges de Bilston'],
  ['Wednesbury Pits', 'Puits de Wednesbury'],
  ['Walsall Tannery', 'Tannerie de Walsall'],
  ['Dudley Glassworks', 'Verrerie de Dudley'],
  ['Stourbridge Glasshouse', 'Verrerie de Stourbridge'],
  ['Red House Cone', 'Cône de Red House'],
  ['Brierley Hill', 'Colline de Brierley'],
  ['Gornal Colliery', 'Houillère de Gornal'],
  ['Cannock Chase', 'Chasse de Cannock'],
  ['Hednesford Pit', 'Puits de Hednesford'],
  ['Brownhills Colliery', 'Houillère de Brownhills'],
  ['Bloxwich Furnace', 'Fourneau de Bloxwich'],
  ['Willenhall Locksmiths', 'Serruriers de Willenhall'],
  ['Darlaston Gun Barrels', 'Canonnerie de Darlaston'],
  ['Smethwick Pumphouse', 'Pompe de Smethwick'],
  ['Handsworth Mint', 'Monnaie de Handsworth'],
  ['Aston Flint Glass', 'Cristallerie d’Aston'],
  ['Digbeth Tannery', 'Tannerie de Digbeth'],
  ['Jewellery Quarter', 'Quartier des Bijoutiers'],
  ['Deritend Forge', 'Forge de Deritend'],
  ['Bordesley Mill', 'Moulin de Bordesley'],
  ['Sarehole Mill', 'Moulin de Sarehole'],
  ['Perrott’s Folly', 'Folie de Perrott'],
  ['Cradley Chainshop', 'Chaînerie de Cradley'],
  ['Halesowen Nailers', 'Cloutiers de Halesowen'],
  ['Lye Waste', 'Friche de Lye'],
  ['Kinver Rock Houses', 'Maisons-rochers de Kinver'],
  ['Bewdley Quay', 'Quai de Bewdley'],
  ['Kidderminster Looms', 'Métiers de Kidderminster'],
  ['Stourbridge Lion', 'Lion de Stourbridge'],
  ['Coventry Silk Hall', 'Halle aux soies de Coventry'],
  ['Nuneaton Brickyard', 'Briqueterie de Nuneaton'],
  ['Bedworth Pits', 'Puits de Bedworth'],
  ['Tamworth Castle Mill', 'Moulin du château de Tamworth'],
  ['Fazeley Cotton Mill', 'Filature de Fazeley'],
  ['Burton Brewhouse', 'Brasserie de Burton'],
  ['Bass Maltings', 'Malterie Bass'],
  ['Tutbury Mill', 'Moulin de Tutbury'],
  ['Uttoxeter Cattle Fair', 'Foire aux bestiaux d’Uttoxeter'],
  ['Cheadle Copperworks', 'Cuivrerie de Cheadle'],
  ['Froghall Wharf', 'Quai de Froghall'],
  ['Caldon Lime Kilns', 'Fours à chaux de Caldon'],
  ['Leek Silk Mill', 'Soierie de Leek'],
  ['Macclesfield Bridge', 'Pont de Macclesfield'],
  ['Stone Brewery', 'Brasserie de Stone'],
  ['Stafford Shoemakers', 'Cordonniers de Stafford'],
  ['Shugborough Hall', 'Manoir de Shugborough'],
  ['Cannock Mill', 'Moulin de Cannock'],
  ['Rugeley Tanyard', 'Tannerie de Rugeley'],
  ['Lichfield Close', 'Cloître de Lichfield'],
  ['Whittington Barracks', 'Caserne de Whittington'],
  ['Ashby Canal', 'Canal d’Ashby'],
  ['Moira Furnace', 'Fourneau de Moira'],
  ['Swadlincote Potbank', 'Poterie de Swadlincote'],
  ['Derby Silk Mill', 'Soierie de Derby'],
  ['Belper Mill', 'Filature de Belper'],
  ['Milford Mills', 'Moulins de Milford'],
  ['Darley Abbey', 'Abbaye de Darley'],
  ['Butterley Ironworks', 'Forges de Butterley'],
  ['Codnor Park', 'Parc de Codnor'],
  ['Ripley Foundry', 'Fonderie de Ripley'],
  ['Ilkeston Pit', 'Puits d’Ilkeston'],
  ['Long Eaton Lace', 'Dentelles de Long Eaton'],
  ['Nottingham Lace Market', 'Marché aux dentelles de Nottingham'],
  ['Wollaton Pit', 'Puits de Wollaton'],
  ['Papplewick Pumping', 'Pompes de Papplewick'],
  ['Bestwood Colliery', 'Houillère de Bestwood'],
  ['Worcester Porcelain', 'Porcelaine de Worcester'],
  ['Droitwich Brine Pits', 'Salines de Droitwich'],
  ['Redditch Needle Mill', 'Aiguillerie de Redditch'],
  ['Forge Mill', 'Moulin de la Forge'],
  ['Warwick Wharf', 'Quai de Warwick'],
  ['Hatton Flight', 'Échelle d’écluses de Hatton'],
  ['Leamington Pump Room', 'Buvette de Leamington'],
  ['Rugby Iron Bridge', 'Pont de fer de Rugby'],
  ['Bull Ring Market', 'Marché du Bull Ring'],
];

export const TABLE_NAMES: readonly string[] = REGISTER.map(([en]) => en);

const FRENCH = new Map(REGISTER);

/** a name not sitting on any live table; any name when all hundred are busy */
export function pickTableName(taken: Iterable<string>, random: () => number = Math.random): string {
  const busy = new Set(taken);
  const free = TABLE_NAMES.filter((n) => !busy.has(n));
  const pool = free.length ? free : TABLE_NAMES;
  return pool[Math.floor(random() * pool.length)] ?? TABLE_NAMES[0];
}

/** the name as the reader says it; a name outside the register stands as it is */
export function tableTitle(name: string, lang: string): string {
  return (lang === 'fr' ? FRENCH.get(name) : undefined) ?? name;
}

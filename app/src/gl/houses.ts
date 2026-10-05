/* The merchant houses' signs (tools/assets/merchants/house-<id>.jpg, served
   as merchant-house-<id>.webp): each sign's aspect, and where its blank
   brass medallion sits, as fractions of the sign's width and height, the
   radius as a fraction of the width — read off the pictures by hand, since
   every sign is composed a little differently. */
/* `board`: a painted oak signboard (tools/assets/merchants/signboard-<id>.png)
   whose name is painted large on its top plank — no brass nameplate over it */
export const HOUSES: Record<string, { aspect: number; medal: [x: number, y: number, r: number]; board?: true }> = {
  shrewsbury: { aspect: 2.415, medal: [0.822, 0.52, 0.101], board: true },
  warrington: { aspect: 2.358, medal: [0.848, 0.512, 0.107], board: true },
  nottingham: { aspect: 2.332, medal: [0.867, 0.511, 0.107], board: true },
  oxford: { aspect: 2.31, medal: [0.878, 0.516, 0.107], board: true },
  gloucester: { aspect: 2.327, medal: [0.877, 0.518, 0.111], board: true },
};

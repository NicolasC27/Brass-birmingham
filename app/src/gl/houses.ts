/* The merchant houses' signs (tools/assets/merchants/house-<id>.jpg, served
   as merchant-house-<id>.webp): each sign's aspect, and where its blank
   brass medallion sits, as fractions of the sign's width and height, the
   radius as a fraction of the width — read off the pictures by hand, since
   every sign is composed a little differently. */
/* `board`: a painted oak signboard (tools/assets/merchants/signboard-<id>.png)
   whose name is painted large on its top plank — no brass nameplate over it */
export const HOUSES: Record<string, { aspect: number; medal: [x: number, y: number, r: number]; board?: true }> = {
  shrewsbury: { aspect: 2.415, medal: [0.829, 0.523, 0.103], board: true },
  warrington: { aspect: 2.5, medal: [0.866, 0.468, 0.09] },
  nottingham: { aspect: 2.525, medal: [0.845, 0.49, 0.1] },
  oxford: { aspect: 1.672, medal: [0.761, 0.617, 0.165], board: true },
  gloucester: { aspect: 2.475, medal: [0.845, 0.44, 0.105] },
};

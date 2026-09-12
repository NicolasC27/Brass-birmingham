/* The merchant houses' signs (tools/assets/merchants/house-<id>.jpg, served
   as merchant-house-<id>.webp): each sign's aspect, and where its blank
   brass medallion sits, as fractions of the sign's width and height, the
   radius as a fraction of the width — read off the pictures by hand, since
   every sign is composed a little differently. */
export const HOUSES: Record<string, { aspect: number; medal: [x: number, y: number, r: number] }> = {
  shrewsbury: { aspect: 2.397, medal: [0.86, 0.5, 0.105] },
  warrington: { aspect: 2.924, medal: [0.865, 0.53, 0.08] },
  nottingham: { aspect: 2.525, medal: [0.845, 0.49, 0.1] },
  oxford: { aspect: 2.41, medal: [0.805, 0.5, 0.1] },
  gloucester: { aspect: 2.475, medal: [0.845, 0.44, 0.105] },
};

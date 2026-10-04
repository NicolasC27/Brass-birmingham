/* written by tools/map/place-ground.py from the served drawings and the
   relief paintings — run it again when either changes; do not edit */

/** where a served drawing stands on its square: foot centre and the
 *  half-axes of its ground, as fractions of the side */
export const FEET: Record<string, [number, number, number, number]> = {
  'merchant-wharf-0': [0.499, 0.705, 0.391, 0.085],
  'merchant-wharf-1': [0.499, 0.71, 0.39, 0.087],
  'merchant-wharf-2': [0.499, 0.759, 0.367, 0.102],
  'merchant-wharf-3': [0.5, 0.719, 0.391, 0.089],
  'merchant-wharf-4': [0.5, 0.665, 0.391, 0.074],
  'town-place-0': [0.499, 0.696, 0.391, 0.084],
  'town-place-1': [0.499, 0.749, 0.39, 0.098],
  'town-place-2': [0.499, 0.61, 0.39, 0.059],
  'town-place-3': [0.5, 0.678, 0.391, 0.078],
  'town-works-brewery': [0.5, 0.606, 0.391, 0.058],
  'town-works-coal': [0.5, 0.636, 0.391, 0.066],
  'town-works-cotton': [0.5, 0.757, 0.371, 0.101],
  'town-works-iron': [0.499, 0.584, 0.39, 0.051],
  'town-works-manufacturer': [0.499, 0.645, 0.39, 0.07],
  'town-works-pottery': [0.499, 0.688, 0.391, 0.081],
};

/** how the land lies where each place's shadow falls, per board:
 *  -1 a slope falling away down and right, +1 one climbing, 0 level */
export const SHADE: Record<string, Record<string, number>> = {
  midlands: {
    'belper': -0.84,
    'derby': -0.7,
    'leek': 0.94,
    'stoke': 0.51,
    'stone': -0.81,
    'uttoxeter': -0.83,
    'stafford': -0.94,
    'burton': 0.86,
    'cannock': -0.06,
    'tamworth': 0.92,
    'walsall': 0.59,
    'wolverhampton': 0.81,
    'coalbrookdale': -0.21,
    'dudley': -0.03,
    'kidderminster': 0.13,
    'worcester': -0.35,
    'birmingham': -0.76,
    'coventry': -0.21,
    'nuneaton': -0.02,
    'redditch': -0.84,
    'farm-n': -1,
    'farm-s': -0.37,
    'm-warrington': 1,
    'm-nottingham': 0.43,
    'm-shrewsbury': -0.03,
    'm-oxford': 0.02,
    'm-gloucester': -0.03,
  },
};

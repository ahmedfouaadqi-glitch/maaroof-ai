// Approximate centroid latitude/longitude per ISO-2 country code.
// Used to plot lights on the Maaroof globe (orthographic projection).
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  // [lat, lon]
  IQ: [33.2, 43.7], SA: [23.9, 45.1], AE: [24.0, 54.0], EG: [26.8, 30.8], JO: [31.3, 36.7], KW: [29.3, 47.5],
  QA: [25.3, 51.2], BH: [26.0, 50.5], OM: [21.5, 55.9], LB: [33.9, 35.7], SY: [34.8, 38.9], YE: [15.6, 48.5],
  TR: [38.9, 35.2], IR: [32.4, 53.7], PS: [31.9, 35.2], MA: [31.8, -7.1], DZ: [28.0, 1.7], TN: [33.9, 9.5],
  LY: [26.3, 17.2], SD: [12.9, 30.2],
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6], BR: [-14.2, -51.9], AR: [-38.4, -63.6],
  GB: [55.4, -3.4], FR: [46.2, 2.2], DE: [51.2, 10.5], IT: [41.9, 12.6], ES: [40.5, -3.7], NL: [52.1, 5.3],
  RU: [61.5, 105.3], CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [35.9, 127.8], IN: [20.6, 78.9], PK: [30.4, 69.3],
  ID: [-0.8, 113.9], TH: [15.9, 100.9], MY: [4.2, 101.9], PH: [12.9, 121.8], VN: [14.1, 108.3],
  AU: [-25.3, 133.8], NZ: [-40.9, 174.9], ZA: [-30.6, 22.9], NG: [9.1, 8.7], KE: [-0.0, 37.9], ET: [9.1, 40.5],
  UA: [48.4, 31.2], PL: [51.9, 19.1], SE: [60.1, 18.6], NO: [60.5, 8.5], FI: [61.9, 25.7], GR: [39.1, 21.8],
  PT: [39.4, -8.2], CH: [46.8, 8.2], AT: [47.5, 14.6], BE: [50.5, 4.5], IE: [53.4, -8.2], CZ: [49.8, 15.5],
  RO: [45.9, 24.9], HU: [47.2, 19.5], BG: [42.7, 25.5], DK: [56.3, 9.5],
  AF: [33.9, 67.7], BD: [23.7, 90.4], LK: [7.9, 80.8], NP: [28.4, 84.1], MM: [21.9, 95.9],
  SG: [1.4, 103.8], HK: [22.4, 114.1], TW: [23.7, 121.0], IL: [31.0, 34.9],
  CL: [-35.7, -71.5], CO: [4.6, -74.3], PE: [-9.2, -75.0], VE: [6.4, -66.6], EC: [-1.8, -78.2],
  GH: [7.9, -1.0], TZ: [-6.4, 34.9], UG: [1.4, 32.3], DZ_: [28, 1],
};

export function lonLatToOrtho(lon: number, lat: number, rotation: number, radius: number, cx: number, cy: number) {
  // Orthographic projection. rotation in degrees (around Y axis).
  const φ = (lat * Math.PI) / 180;
  const λ = ((lon - rotation) * Math.PI) / 180;
  const x = radius * Math.cos(φ) * Math.sin(λ);
  const y = -radius * Math.sin(φ);
  const z = Math.cos(φ) * Math.cos(λ); // >0 on front hemisphere
  return { x: cx + x, y: cy + y, visible: z > 0, z };
}

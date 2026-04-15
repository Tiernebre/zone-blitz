/**
 * Seed data for US cities used as the domain reference for hometowns of
 * players, coaches, scouts, front-office staff, and locations of teams and
 * colleges.
 *
 * The set is a union of:
 *   1. The most populous US cities (Census-ranked).
 *   2. Every city referenced by a college in DEFAULT_COLLEGES.
 *   3. Every city referenced by a team in DEFAULT_TEAMS.
 *
 * Entries are deduplicated by (name, stateCode). Each entry's `stateCode` must
 * match a `code` in DEFAULT_STATES.
 */
import { DEFAULT_COLLEGES } from "../colleges/default-colleges.ts";
import { DEFAULT_TEAMS } from "../team/default-teams.ts";
import { FOUNDING_FRANCHISES } from "../team/founding-franchises.ts";

export interface DefaultCity {
  name: string;
  stateCode: string;
}

const TOP_US_CITIES: DefaultCity[] = [
  { name: "New York", stateCode: "NY" },
  { name: "Los Angeles", stateCode: "CA" },
  { name: "Chicago", stateCode: "IL" },
  { name: "Houston", stateCode: "TX" },
  { name: "Phoenix", stateCode: "AZ" },
  { name: "Philadelphia", stateCode: "PA" },
  { name: "San Antonio", stateCode: "TX" },
  { name: "San Diego", stateCode: "CA" },
  { name: "Dallas", stateCode: "TX" },
  { name: "Jacksonville", stateCode: "FL" },
  { name: "Fort Worth", stateCode: "TX" },
  { name: "San Jose", stateCode: "CA" },
  { name: "Austin", stateCode: "TX" },
  { name: "Charlotte", stateCode: "NC" },
  { name: "Columbus", stateCode: "OH" },
  { name: "Indianapolis", stateCode: "IN" },
  { name: "San Francisco", stateCode: "CA" },
  { name: "Seattle", stateCode: "WA" },
  { name: "Denver", stateCode: "CO" },
  { name: "Oklahoma City", stateCode: "OK" },
  { name: "Nashville", stateCode: "TN" },
  { name: "Washington", stateCode: "DC" },
  { name: "El Paso", stateCode: "TX" },
  { name: "Las Vegas", stateCode: "NV" },
  { name: "Boston", stateCode: "MA" },
  { name: "Detroit", stateCode: "MI" },
  { name: "Louisville", stateCode: "KY" },
  { name: "Portland", stateCode: "OR" },
  { name: "Memphis", stateCode: "TN" },
  { name: "Baltimore", stateCode: "MD" },
  { name: "Milwaukee", stateCode: "WI" },
  { name: "Albuquerque", stateCode: "NM" },
  { name: "Tucson", stateCode: "AZ" },
  { name: "Fresno", stateCode: "CA" },
  { name: "Sacramento", stateCode: "CA" },
  { name: "Atlanta", stateCode: "GA" },
  { name: "Mesa", stateCode: "AZ" },
  { name: "Kansas City", stateCode: "MO" },
  { name: "Raleigh", stateCode: "NC" },
  { name: "Colorado Springs", stateCode: "CO" },
  { name: "Omaha", stateCode: "NE" },
  { name: "Miami", stateCode: "FL" },
  { name: "Virginia Beach", stateCode: "VA" },
  { name: "Long Beach", stateCode: "CA" },
  { name: "Oakland", stateCode: "CA" },
  { name: "Minneapolis", stateCode: "MN" },
  { name: "Bakersfield", stateCode: "CA" },
  { name: "Tulsa", stateCode: "OK" },
  { name: "Tampa", stateCode: "FL" },
  { name: "Arlington", stateCode: "TX" },
  { name: "Aurora", stateCode: "CO" },
  { name: "Wichita", stateCode: "KS" },
  { name: "Cleveland", stateCode: "OH" },
  { name: "New Orleans", stateCode: "LA" },
  { name: "Henderson", stateCode: "NV" },
  { name: "Honolulu", stateCode: "HI" },
  { name: "Anaheim", stateCode: "CA" },
  { name: "Orlando", stateCode: "FL" },
  { name: "Lexington", stateCode: "KY" },
  { name: "Stockton", stateCode: "CA" },
  { name: "Riverside", stateCode: "CA" },
  { name: "Irvine", stateCode: "CA" },
  { name: "Corpus Christi", stateCode: "TX" },
  { name: "Newark", stateCode: "NJ" },
  { name: "Santa Ana", stateCode: "CA" },
  { name: "Cincinnati", stateCode: "OH" },
  { name: "Pittsburgh", stateCode: "PA" },
  { name: "Saint Paul", stateCode: "MN" },
  { name: "Greensboro", stateCode: "NC" },
  { name: "Jersey City", stateCode: "NJ" },
  { name: "Durham", stateCode: "NC" },
  { name: "Lincoln", stateCode: "NE" },
  { name: "North Las Vegas", stateCode: "NV" },
  { name: "Plano", stateCode: "TX" },
  { name: "Anchorage", stateCode: "AK" },
  { name: "Gilbert", stateCode: "AZ" },
  { name: "Madison", stateCode: "WI" },
  { name: "Reno", stateCode: "NV" },
  { name: "Chandler", stateCode: "AZ" },
  { name: "St. Louis", stateCode: "MO" },
  { name: "Chula Vista", stateCode: "CA" },
  { name: "Buffalo", stateCode: "NY" },
  { name: "Fort Wayne", stateCode: "IN" },
  { name: "Lubbock", stateCode: "TX" },
  { name: "St. Petersburg", stateCode: "FL" },
  { name: "Toledo", stateCode: "OH" },
  { name: "Laredo", stateCode: "TX" },
  { name: "Port St. Lucie", stateCode: "FL" },
  { name: "Glendale", stateCode: "AZ" },
  { name: "Irving", stateCode: "TX" },
  { name: "Winston-Salem", stateCode: "NC" },
  { name: "Chesapeake", stateCode: "VA" },
  { name: "Garland", stateCode: "TX" },
  { name: "Scottsdale", stateCode: "AZ" },
  { name: "Boise", stateCode: "ID" },
  { name: "Hialeah", stateCode: "FL" },
  { name: "Frisco", stateCode: "TX" },
  { name: "Richmond", stateCode: "VA" },
  { name: "Cape Coral", stateCode: "FL" },
  { name: "Norfolk", stateCode: "VA" },
  { name: "Spokane", stateCode: "WA" },
  { name: "Huntsville", stateCode: "AL" },
  { name: "Santa Clarita", stateCode: "CA" },
  { name: "Tacoma", stateCode: "WA" },
  { name: "Fremont", stateCode: "CA" },
  { name: "McKinney", stateCode: "TX" },
  { name: "San Bernardino", stateCode: "CA" },
  { name: "Baton Rouge", stateCode: "LA" },
  { name: "Modesto", stateCode: "CA" },
  { name: "Fontana", stateCode: "CA" },
  { name: "Salt Lake City", stateCode: "UT" },
  { name: "Moreno Valley", stateCode: "CA" },
  { name: "Des Moines", stateCode: "IA" },
  { name: "Worcester", stateCode: "MA" },
  { name: "Yonkers", stateCode: "NY" },
  { name: "Fayetteville", stateCode: "NC" },
  { name: "Sioux Falls", stateCode: "SD" },
  { name: "Grand Prairie", stateCode: "TX" },
  { name: "Rochester", stateCode: "NY" },
  { name: "Tallahassee", stateCode: "FL" },
  { name: "Little Rock", stateCode: "AR" },
  { name: "Amarillo", stateCode: "TX" },
  { name: "Overland Park", stateCode: "KS" },
  { name: "Columbus", stateCode: "GA" },
  { name: "Augusta", stateCode: "GA" },
  { name: "Mobile", stateCode: "AL" },
  { name: "Oxnard", stateCode: "CA" },
  { name: "Grand Rapids", stateCode: "MI" },
  { name: "Peoria", stateCode: "AZ" },
  { name: "Vancouver", stateCode: "WA" },
  { name: "Knoxville", stateCode: "TN" },
  { name: "Birmingham", stateCode: "AL" },
  { name: "Montgomery", stateCode: "AL" },
  { name: "Providence", stateCode: "RI" },
  { name: "Huntington Beach", stateCode: "CA" },
  { name: "Brownsville", stateCode: "TX" },
  { name: "Chattanooga", stateCode: "TN" },
  { name: "Fort Lauderdale", stateCode: "FL" },
  { name: "Tempe", stateCode: "AZ" },
  { name: "Akron", stateCode: "OH" },
  { name: "Glendale", stateCode: "CA" },
  { name: "Clarksville", stateCode: "TN" },
  { name: "Ontario", stateCode: "CA" },
  { name: "Newport News", stateCode: "VA" },
  { name: "Elk Grove", stateCode: "CA" },
  { name: "Cary", stateCode: "NC" },
  { name: "Aurora", stateCode: "IL" },
  { name: "Salem", stateCode: "OR" },
  { name: "Pembroke Pines", stateCode: "FL" },
  { name: "Eugene", stateCode: "OR" },
  { name: "Santa Rosa", stateCode: "CA" },
  { name: "Rancho Cucamonga", stateCode: "CA" },
  { name: "Shreveport", stateCode: "LA" },
  { name: "Garden Grove", stateCode: "CA" },
  { name: "Oceanside", stateCode: "CA" },
  { name: "Fort Collins", stateCode: "CO" },
  { name: "Springfield", stateCode: "MO" },
  { name: "Murfreesboro", stateCode: "TN" },
  { name: "Surprise", stateCode: "AZ" },
  { name: "Lancaster", stateCode: "CA" },
  { name: "Denton", stateCode: "TX" },
  { name: "Roseville", stateCode: "CA" },
  { name: "Palmdale", stateCode: "CA" },
  { name: "Corona", stateCode: "CA" },
  { name: "Salinas", stateCode: "CA" },
  { name: "Killeen", stateCode: "TX" },
  { name: "Paterson", stateCode: "NJ" },
  { name: "Alexandria", stateCode: "VA" },
  { name: "Hollywood", stateCode: "FL" },
  { name: "Hayward", stateCode: "CA" },
  { name: "Charleston", stateCode: "SC" },
  { name: "Macon", stateCode: "GA" },
  { name: "Lakewood", stateCode: "CO" },
  { name: "Sunnyvale", stateCode: "CA" },
  { name: "Kansas City", stateCode: "KS" },
  { name: "Springfield", stateCode: "MA" },
  { name: "Bellevue", stateCode: "WA" },
  { name: "Naperville", stateCode: "IL" },
];

function dedupe(cities: DefaultCity[]): DefaultCity[] {
  const seen = new Set<string>();
  const result: DefaultCity[] = [];
  for (const city of cities) {
    const key = `${city.name}|${city.stateCode}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(city);
    }
  }
  return result;
}

const COLLEGE_CITIES: DefaultCity[] = DEFAULT_COLLEGES.map((c) => ({
  name: c.city,
  stateCode: c.state,
}));

const TEAM_CITIES: DefaultCity[] = DEFAULT_TEAMS.map((t) => ({
  name: t.city,
  stateCode: t.state,
}));

const FOUNDING_CITIES: DefaultCity[] = FOUNDING_FRANCHISES.map((f) => ({
  name: f.city,
  stateCode: f.state,
}));

export const DEFAULT_CITIES: DefaultCity[] = dedupe([
  ...TOP_US_CITIES,
  ...COLLEGE_CITIES,
  ...TEAM_CITIES,
  ...FOUNDING_CITIES,
]);

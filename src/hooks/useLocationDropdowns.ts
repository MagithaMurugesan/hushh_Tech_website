/**
 * useLocationDropdowns — Manages the Country → State → City cascade.
 *
 * Loads countries synchronously from a static list.
 * States and cities are fetched async from Supabase Edge Functions.
 * Uses pending refs to solve the race condition when GPS data arrives
 * before dropdown options have loaded.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllCountries, getStatesOfCountry, getCitiesOfState } from '../data/locationData';

interface DropdownItem {
  isoCode: string;
  name: string;
}

interface CityItem {
  name: string;
}

export interface LocationDropdownState {
  countries: DropdownItem[];
  states: DropdownItem[];
  cities: CityItem[];
  country: string;
  state: string;
  city: string;
  loadingStates: boolean;
  loadingCities: boolean;
  statesError: boolean;
  citiesError: boolean;
  retryStates: () => void;
  retryCities: () => void;
  setCountry: (code: string) => void;
  setState: (code: string) => void;
  setCity: (name: string) => void;
  applyDetectedLocation: (countryCode?: string, stateCode?: string, stateName?: string, cityName?: string) => void;
}

export function useLocationDropdowns(
  initialCountry = '',
  initialState = '',
  initialCity = ''
): LocationDropdownState {
  const [countries] = useState<DropdownItem[]>(() => getAllCountries());
  const [states, setStates] = useState<DropdownItem[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);

  const [country, setCountryRaw] = useState(initialCountry);
  const [state, setStateRaw] = useState(initialState);
  const [city, setCityRaw] = useState(initialCity);

  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [statesError, setStatesError] = useState(false);
  const [citiesError, setCitiesError] = useState(false);

  // Bumped each time applyDetectedLocation is called so that the
  // pending-resolution effects re-run even when the dropdown arrays
  // haven't changed (fixes: same country → state/city not populating).
  const [detectionVersion, setDetectionVersion] = useState(0);

  // Pending refs — store GPS values until dropdown options arrive
  const pendingState = useRef<string | null>(null);
  const pendingCity = useRef<string | null>(null);

  // Country change → reset state/city, load states
  const setCountry = useCallback((code: string) => {
    setCountryRaw(code);
    setStateRaw('');
    setCityRaw('');
    setStates([]);
    setCities([]);
  }, []);

  // State change → reset city, load cities
  const setState = useCallback((code: string) => {
    setStateRaw(code);
    setCityRaw('');
    setCities([]);
  }, []);

  const setCity = useCallback((name: string) => {
    setCityRaw(name);
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!country) return;
    let cancelled = false;

    const load = async () => {
      setLoadingStates(true);
      setStatesError(false);
      try {
        const list = await getStatesOfCountry(country);
        if (!cancelled) setStates(list);
      } catch {
        if (!cancelled) setStatesError(true);
      } finally {
        if (!cancelled) setLoadingStates(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [country]);

  // Load cities when state changes
  useEffect(() => {
    if (!country || !state) return;
    let cancelled = false;

    const load = async () => {
      setLoadingCities(true);
      setCitiesError(false);
      try {
        // Edge function expects ISO code (e.g. "MH"), not name ("Maharashtra")
        const list = await getCitiesOfState(country, state);
        if (!cancelled) setCities(list);
      } catch {
        if (!cancelled) setCitiesError(true);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [country, state, states]);

  // Apply pending state when states list loads OR detection version bumps
  useEffect(() => {
    if (states.length === 0 || !pendingState.current) return;

    const raw = pendingState.current.toLowerCase();
    const match =
      states.find(s => s.isoCode.toLowerCase() === raw || s.name.toLowerCase() === raw) ||
      states.find(s => s.name.toLowerCase().includes(raw) || raw.includes(s.name.toLowerCase()));

    if (match) {
      setStateRaw(match.isoCode);
      pendingState.current = null;
    }
    /* Keep pendingState if no match — retry when states reload */
  }, [states, detectionVersion]);

  // Apply pending city when cities list loads OR detection version bumps
  useEffect(() => {
    if (cities.length === 0 || !pendingCity.current) return;

    /* pendingCity may contain multiple candidates separated by '|'
       e.g. "Mahalunge|Pune" — try each one in order */
    const candidates = pendingCity.current.split('|').map(s => s.trim()).filter(Boolean);

    const normalize = (s: string) => s.toLowerCase().replace(/[-]/g, ' ').trim();

    let matchedCity: CityItem | undefined;
    for (const candidate of candidates) {
      const raw = normalize(candidate);
      matchedCity =
        cities.find(c => normalize(c.name) === raw) ||
        cities.find(c => normalize(c.name).includes(raw) || raw.includes(normalize(c.name))) ||
        cities.find(c => {
          const cTokens = normalize(c.name).split(/\s+/);
          const rTokens = raw.split(/\s+/);
          return cTokens[0] === rTokens[0] && cTokens[0].length > 2;
        });
      if (matchedCity) break;
    }

    if (matchedCity) {
      setCityRaw(matchedCity.name);
      pendingCity.current = null;
    } else if (!loadingCities) {
      /* Cities loaded but no match — add GPS city as custom entry so user sees it */
      const gpsCity = candidates[0];
      if (gpsCity) {
        setCities(prev => [...prev, { name: gpsCity }]);
        setCityRaw(gpsCity);
        pendingCity.current = null;
      }
    }
  }, [cities, detectionVersion, loadingCities]);

  // Apply GPS/detected location — queues values for when dropdowns load
  const applyDetectedLocation = useCallback((
    countryCode?: string,
    stateCode?: string,
    stateName?: string,
    cityName?: string
  ) => {
    if (stateCode) pendingState.current = stateCode;
    else if (stateName) pendingState.current = stateName;
    if (cityName) pendingCity.current = cityName;
    if (countryCode) setCountryRaw(countryCode);

    // Bump version so pending-resolution effects re-evaluate
    // even when states/cities arrays haven't changed.
    setDetectionVersion(v => v + 1);
  }, []);

  // Retry functions — re-trigger the useEffect by toggling country/state
  const retryStates = useCallback(() => {
    if (!country) return;
    setStatesError(false);
    setStates([]);
    // Re-trigger by setting same value (force via raw setter)
    const c = country;
    setCountryRaw('');
    setTimeout(() => setCountryRaw(c), 0);
  }, [country]);

  const retryCities = useCallback(() => {
    if (!state) return;
    setCitiesError(false);
    setCities([]);
    const s = state;
    setStateRaw('');
    setTimeout(() => setStateRaw(s), 0);
  }, [state]);

  return {
    countries, states, cities,
    country, state, city,
    loadingStates, loadingCities,
    statesError, citiesError,
    retryStates, retryCities,
    setCountry, setState, setCity,
    applyDetectedLocation,
  };
}

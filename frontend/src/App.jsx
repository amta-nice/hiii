import React, { useState, useEffect } from 'react';
import SatelliteGlobe from './components/SatelliteGlobe';
import Sidebar from './components/Sidebar';
import axios from 'axios';
import * as satellite from 'satellite.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
const TLE_CACHE_KEY = 'sat-lm:active-tle-cache:v1';
const TLE_CACHE_MS = 2 * 60 * 60 * 1000;

function parseTLEText(tleText) {
  if (!tleText || typeof tleText !== 'string') return [];

  const lines = tleText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const satellites = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 >= lines.length) continue;

    const rawName = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    try {
      const satrec = satellite.twoline2satrec(line1, line2);
      const name = rawName.replace(/^0\s+/, '');
      const noradId = line1.substring(2, 7).trim();
      const intlDesignator = line1.substring(9, 17).trim();

      satellites.push({
        name,
        tleLine1: line1,
        tleLine2: line2,
        satrec,
        noradId,
        intlDesignator
      });
    } catch (error) {
      // Skip malformed TLE entries.
    }
  }

  return satellites;
}

function getLauncherFromName(name) {
  const upper = name.toUpperCase();

  if (upper.includes('STARLINK')) return 'SpaceX';
  if (upper.includes('ISS') || upper.includes('ZARYA')) return 'International partnership (NASA, Roscosmos, ESA, JAXA, CSA)';
  if (upper.includes('COSMOS')) return 'Roscosmos';
  if (upper.includes('NOAA') || upper.includes('JPSS')) return 'NASA / NOAA';
  if (upper.includes('FENGYUN') || upper.includes('YAOGAN')) return 'CNSA';
  if (upper.includes('GALILEO')) return 'ESA';
  if (upper.includes('ONEWEB')) return 'OneWeb partners';
  if (upper.includes('IRIDIUM')) return 'Iridium / partner launch providers';
  if (upper.includes('SES') || upper.includes('INTELSAT') || upper.includes('EUTELSAT')) return 'Commercial launch provider';

  return 'Unknown';
}

function getLaunchYear(intlDesignator) {
  if (!intlDesignator || intlDesignator.length < 2) return null;

  const yearToken = intlDesignator.substring(0, 2);
  const yearNum = parseInt(yearToken, 10);

  if (Number.isNaN(yearNum)) return null;
  return yearNum >= 57 ? 1900 + yearNum : 2000 + yearNum;
}

function getDesignatorLabel(intlDesignator) {
  if (!intlDesignator || intlDesignator.length < 5) return 'Unavailable';

  const launchYear = getLaunchYear(intlDesignator);
  const launchNumber = intlDesignator.substring(2, 5);
  const piece = intlDesignator.substring(5) || 'A';

  if (!launchYear) return intlDesignator;
  return `${launchYear}-${launchNumber}${piece}`;
}

function getImageDataUrl(name) {
  const upper = name.toUpperCase();

  if (upper.includes('STARLINK')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Starlink_Satellite_1.jpg/320px-Starlink_Satellite_1.jpg';
  }

  if (upper.includes('ISS') || upper.includes('ZARYA')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/International_Space_Station_after_undocking_of_STS-132.jpg/320px-International_Space_Station_after_undocking_of_STS-132.jpg';
  }

  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Satellite_icon.svg/320px-Satellite_icon.svg.png';
}

function buildMetadata(record) {
  return {
    noradId: record.noradId || 'Unknown',
    launchDesignator: getDesignatorLabel(record.intlDesignator),
    launchYear: getLaunchYear(record.intlDesignator),
    launchedBy: getLauncherFromName(record.name),
    imageUrl: getImageDataUrl(record.name)
  };
}

function propagateAtTime(tleRecords, atDate) {
  if (!Array.isArray(tleRecords) || tleRecords.length === 0) return [];

  const gmst = satellite.gstime(atDate);
  const propagated = [];

  for (const record of tleRecords) {
    try {
      const state = satellite.propagate(record.satrec, atDate);
      if (!state?.position) continue;

      const geo = satellite.eciToGeodetic(state.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height;

      if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(alt)) continue;

      propagated.push({
        name: record.name,
        lat: Number(lat.toFixed(4)),
        lon: Number(lon.toFixed(4)),
        alt: Number(alt.toFixed(2)),
        ...buildMetadata(record)
      });
    } catch (error) {
      // Skip failed propagation for individual records.
    }
  }

  return propagated;
}

function loadCachedTLE() {
  try {
    const raw = localStorage.getItem(TLE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || !parsed?.tleText) return null;

    return parsed;
  } catch {
    return null;
  }
}

function storeCachedTLE(tleText) {
  try {
    localStorage.setItem(
      TLE_CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        tleText
      })
    );
  } catch {
    // Non-fatal in private browsing or storage-restricted environments.
  }
}

function App() {
  const [satellites, setSatellites] = useState([]);
  const [filteredSatellites, setFilteredSatellites] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [tleRecords, setTleRecords] = useState([]);
  const [clockTick, setClockTick] = useState(Date.now());

  // Fetch TLE set from Celestrak with local 2-hour caching.
  const fetchSatellites = async () => {
    setLoading(true);
    setError(null);

    try {
      const cached = loadCachedTLE();
      const cacheAge = cached ? Date.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;

      if (cached && cacheAge < TLE_CACHE_MS) {
        setTleRecords(parseTLEText(cached.tleText));
        return;
      }

      const response = await axios.get(TLE_URL, { timeout: 60000 });
      const tleText = response.data;

      storeCachedTLE(tleText);
      setTleRecords(parseTLEText(tleText));
    } catch (err) {
      // Fall back to stale cache first, then backend snapshots.
      const cached = loadCachedTLE();

      if (cached?.tleText) {
        setTleRecords(parseTLEText(cached.tleText));
      } else {
        try {
          const fallback = await axios.get(`${API_BASE}/api/satellites`);
          const fallbackSatellites = fallback.data?.satellites || [];
          const enrichedFallback = fallbackSatellites.map((sat) => ({
            ...sat,
            noradId: 'Unknown',
            launchDesignator: 'Unavailable',
            launchYear: null,
            launchedBy: 'Unknown',
            imageUrl: getImageDataUrl(sat.name)
          }));

          setSatellites(enrichedFallback);
          setFilteredSatellites(enrichedFallback);
        } catch (fallbackErr) {
          setError('Failed to fetch satellite data. Please ensure the backend is running.');
          console.error('Error fetching satellites:', fallbackErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Keep the rendered positions synced to current time without re-fetching TLE.
  useEffect(() => {
    if (tleRecords.length === 0) return;

    const now = new Date(clockTick);
    const liveSatellites = propagateAtTime(tleRecords, now);
    setSatellites(liveSatellites);
  }, [tleRecords, clockTick]);

  // Tick clock for live propagation updates.
  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Filter satellites based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSatellites(satellites);
    } else {
      const filtered = satellites.filter(satellite =>
        satellite.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSatellites(filtered);
    }
  }, [searchTerm, satellites]);

  // Send chat message to Ollama
  const sendChatMessage = async (message) => {
    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
    
    setChatLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/chat`, {
        message: message,
        model: 'llama3'
      });
      
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Failed to get response from AI assistant. Please ensure Ollama is running.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      console.error('Error sending chat message:', err);
    } finally {
      setChatLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchSatellites();
    
    // Refresh TLEs every 2 hours to respect data provider rate limits.
    const interval = setInterval(fetchSatellites, TLE_CACHE_MS);
    
    return () => clearInterval(interval);
  }, []);

  // Keep selected object synced when satellites array is regenerated.
  useEffect(() => {
    if (!selectedSatellite) return;

    const updated = satellites.find((sat) => sat.name === selectedSatellite.name);
    if (updated) {
      setSelectedSatellite(updated);
    }
  }, [satellites, selectedSatellite]);

  return (
    <div className="flex h-screen bg-space-dark text-white">
      {/* 3D Globe - Left Side */}
      <div className="flex-1">
        <SatelliteGlobe
          satellites={filteredSatellites}
          selectedSatellite={selectedSatellite}
          onSatelliteSelect={setSelectedSatellite}
        />
      </div>
      
      {/* Sidebar - Right Side */}
      <Sidebar
        satellites={filteredSatellites}
        selectedSatellite={selectedSatellite}
        onSatelliteSelect={setSelectedSatellite}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={fetchSatellites}
        loading={loading}
        error={error}
        chatMessages={chatMessages}
        onSendMessage={sendChatMessage}
        chatLoading={chatLoading}
        totalSatellites={satellites.length}
      />
    </div>
  );
}

export default App;
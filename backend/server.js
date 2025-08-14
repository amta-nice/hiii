const express = require('express');
const cors = require('cors');
const axios = require('axios');
const satellite = require('satellite.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Store satellite data cache
let satelliteCache = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Parse TLE data and calculate current position
function parseTLEData(tleData) {
  const lines = tleData.trim().split('\n');
  const satellites = [];
  
  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      const name = lines[i].trim();
      const tleLine1 = lines[i + 1];
      const tleLine2 = lines[i + 2];
      
      try {
        // Create satellite record from TLE
        const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
        
        // Get current time
        const now = new Date();
        
        // Calculate position
        const positionAndVelocity = satellite.propagate(satrec, now);
        
        if (positionAndVelocity.position) {
          // Convert ECI to geodetic coordinates
          const gmst = satellite.gstime(now);
          const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
          
          // Convert to degrees and km
          const lat = satellite.degreesLat(position.latitude);
          const lon = satellite.degreesLong(position.longitude);
          const alt = position.height; // Already in km
          
          // Only include if coordinates are valid
          if (!isNaN(lat) && !isNaN(lon) && !isNaN(alt)) {
            satellites.push({
              name: name.replace(/^0\s+/, ''), // Remove leading "0 " if present
              lat: parseFloat(lat.toFixed(4)),
              lon: parseFloat(lon.toFixed(4)),
              alt: parseFloat(alt.toFixed(2))
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to parse satellite ${name}:`, error.message);
      }
    }
  }
  
  return satellites;
}

// Helper: parse latitude/longitude coordinates from a natural language message
function parseCoordinatesFromMessage(message) {
  if (!message) return null;

  const text = message.toString();

  // Pattern like: "18.52° N ... 73.85° E" (example from the user)
  const degDirPattern = /(-?\d+(?:\.\d+)?)\s*°?\s*([NnSs])[^0-9+\-]+(-?\d+(?:\.\d+)?)\s*°?\s*([EeWw])/;
  const match = text.match(degDirPattern);
  if (match) {
    let lat = parseFloat(match[1]);
    let lon = parseFloat(match[3]);

    if (match[2].toUpperCase() === 'S') lat = -lat;
    if (match[4].toUpperCase() === 'W') lon = -lon;

    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon, format: 'deg-dir' };
    }
  }

  // Fallback: signed decimal degrees labeled as latitude / longitude
  const labeledPattern = /latitude[^-+0-9]*(-?\d+(?:\.\d+)?)[^0-9-+]+longitude[^-+0-9]*(-?\d+(?:\.\d+)?)/i;
  const labeledMatch = text.match(labeledPattern);
  if (labeledMatch) {
    const lat = parseFloat(labeledMatch[1]);
    const lon = parseFloat(labeledMatch[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon, format: 'decimal-labeled' };
    }
  }

  return null;
}

// Helper: great-circle distance (haversine) in kilometers
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestSatellites(lat, lon, maxResults = 5) {
  if (!satelliteCache || satelliteCache.length === 0) return [];

  const withDistance = satelliteCache.map(sat => {
    const distanceKm = haversineDistanceKm(lat, lon, sat.lat, sat.lon);
    return { ...sat, distanceKm: parseFloat(distanceKm.toFixed(2)) };
  });

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  return withDistance.slice(0, maxResults);
}

// Fetch satellite data from Celestrak
async function fetchSatelliteData() {
  try {
    console.log('Fetching satellite data from Celestrak...');
    const response = await axios.get(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
      {
        timeout: 60000,
        headers: {
          'User-Agent': 'SAT-LM/1.0'
        }
      }
    );
    
    const satellites = parseTLEData(response.data);
    console.log(`Successfully parsed ${satellites.length} satellites`);
    
    satelliteCache = satellites;
    lastFetchTime = Date.now();
    
    return satellites;
  } catch (error) {
    console.error('Error fetching satellite data:', error.message);
    throw error;
  }
}

// API Routes

// Get all satellites
app.get('/api/satellites', async (req, res) => {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (satelliteCache.length === 0 || (now - lastFetchTime) > CACHE_DURATION) {
      await fetchSatelliteData();
    }
    
    // Apply filters if provided
    let filtered = satelliteCache;
    
    const { search, limit } = req.query;
    
    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(sat => 
        sat.name.toLowerCase().includes(searchTerm)
      );
    }
    
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        filtered = filtered.slice(0, limitNum);
      }
    }
    
    res.json({
      satellites: filtered,
      total: satelliteCache.length,
      filtered: filtered.length,
      lastUpdate: new Date(lastFetchTime).toISOString()
    });
  } catch (error) {
    console.error('Error in /api/satellites:', error);
    res.status(500).json({ 
      error: 'Failed to fetch satellite data',
      message: error.message 
    });
  }
});

// Chat with Ollama LLM
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'llama3' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Sending chat request to Ollama with model: ${model}`);
    
    // Ensure satellite cache is reasonably fresh before answering
    const now = Date.now();
    if (satelliteCache.length === 0 || (now - lastFetchTime) > CACHE_DURATION) {
      try {
        await fetchSatelliteData();
      } catch (e) {
        console.warn('Warning: failed to refresh satellite data for chat:', e.message);
      }
    }

    // Build satellite context from current cache
    let satelliteContext = '';
    const coords = parseCoordinatesFromMessage(message);

    if (coords && satelliteCache.length > 0) {
      // User asked about a specific latitude/longitude: find nearest satellites
      const nearest = findNearestSatellites(coords.lat, coords.lon, 5);
      satelliteContext = JSON.stringify({
        queryCoordinates: {
          lat: coords.lat,
          lon: coords.lon
        },
        nearestSatellites: nearest
      });
    } else if (satelliteCache.length > 0) {
      const lowerMessage = message.toLowerCase();
      // Try to find satellites whose names appear in the question
      let relevantSatellites = satelliteCache.filter(sat =>
        lowerMessage.includes(sat.name.toLowerCase())
      );

      // If none match, just take a small sample from the cache
      if (relevantSatellites.length === 0) {
        relevantSatellites = satelliteCache.slice(0, 20);
      } else {
        relevantSatellites = relevantSatellites.slice(0, 20);
      }

      satelliteContext = JSON.stringify({
        satellites: relevantSatellites
      });
    }

    // Enhance the prompt with satellite context and strict rules
    const contextPrompt = `You are an assistant for satellite tracking.
You are given JSON data about satellites and, if the user asked about coordinates, the nearest satellites to that location.
Each satellite has a name, latitude, longitude, altitude, and (for coordinate queries) distanceKm from the asked location.
Only use this data when answering. If you are not sure or the answer is not directly supported by the data,
reply exactly with: "I don't know based on the available satellite data."
Do NOT invent satellite names, positions, numbers, or facts that are not clearly implied by the data.
Satellite data (JSON):
${satelliteContext || '[]'}

User question: ${message}`;
    
    const ollamaResponse = await axios.post(

      (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434') + '/api/generate',
      {
        model: model,
        prompt: contextPrompt,
        stream: false,
        options: {
          // Lower temperature to reduce hallucinations
          temperature: 0.1
        }
      },
      {
        timeout: 5 * 60 * 1000, // 5 minutes to allow long generations
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const response = ollamaResponse.data.response;
    
    res.json({
      response: response,
      model: model,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in /api/chat:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Ollama service unavailable',
        message: 'Please ensure Ollama is running on http://localhost:11434'
      });
    } else if (error.response?.status === 404) {
      res.status(404).json({
        error: 'Model not found',
        message: 'Please ensure the specified model is available in Ollama'
      });
    } else {
      res.status(500).json({ 
        error: 'Chat service error',
        message: error.message 
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: {
      satellites: satelliteCache.length,
      lastUpdate: lastFetchTime ? new Date(lastFetchTime).toISOString() : null
    }
  });
});

// Get specific satellite by name
app.get('/api/satellites/:name', (req, res) => {
  const satelliteName = req.params.name.toLowerCase();
  const satellite = satelliteCache.find(sat => 
    sat.name.toLowerCase().includes(satelliteName)
  );
  
  if (satellite) {
    res.json(satellite);
  } else {
    res.status(404).json({ error: 'Satellite not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SAT-LM Backend server running on port ${PORT}`);
  console.log(`📡 Satellite API: http://localhost:${PORT}/api/satellites`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize satellite data on startup
  fetchSatelliteData().catch(err => {
    console.warn('Initial satellite data fetch failed:', err.message);
  });
});
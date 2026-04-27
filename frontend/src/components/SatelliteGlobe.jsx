import React, { useRef, useEffect, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { Pause, Play } from 'lucide-react';

const SatelliteGlobe = ({ satellites, selectedSatellite, onSatelliteSelect }) => {
  const globeEl = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Generate orbital path for selected satellite
  const generateOrbitPath = (satellite) => {
    if (!satellite) return [];
    
    const points = [];
    const numPoints = 200; // Number of points in the orbit
    
    // Calculate orbital inclination from current position
    // This is an approximation - we use the current latitude as a rough inclination indicator
    const inclination = Math.abs(satellite.lat); // Orbital inclination in degrees
    
    // Starting longitude
    const startLng = satellite.lon;
    
    // Generate orbital path
    // Satellites orbit in great circles inclined to the equator
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI; // 0 to 2π
      
      // Calculate latitude based on orbital inclination
      // Using simplified orbital mechanics - satellites oscillate between +/- inclination
      const lat = inclination * Math.sin(angle);
      
      // Calculate longitude progression
      // Satellites move eastward (or westward) as they orbit
      const lngOffset = (i / numPoints) * 360;
      const lng = ((startLng + lngOffset) % 360 + 540) % 360 - 180; // Normalize to -180 to 180
      
      points.push({
        lat: lat,
        lng: lng,
        alt: 0.002
      });
    }
    
    return points;
  };

  // Create arc data for the selected satellite's path
  const pathArcs = useMemo(() => {
    if (!selectedSatellite) return [];
    
    const orbitPoints = generateOrbitPath(selectedSatellite);
    const arcs = [];
    
    // Create arcs between consecutive points
    for (let i = 0; i < orbitPoints.length - 1; i++) {
      arcs.push({
        startLat: orbitPoints[i].lat,
        startLng: orbitPoints[i].lng,
        endLat: orbitPoints[i + 1].lat,
        endLng: orbitPoints[i + 1].lng,
        // color: '#3b82f6',
        altitude: 0.002
      });
    }
    
    return arcs;
  }, [selectedSatellite]);

  // Format satellites for globe points - use useMemo to prevent recreation on every render
  const points = useMemo(() => {
    return satellites.map((sat, index) => ({
      lat: sat.lat,
      lng: sat.lon,
      altitude: 0.002, // Very small altitude - satellites appear as tiny dots on surface
      name: sat.name,
      color: selectedSatellite?.name === sat.name ? '#3b82f6' : '#f97316',
      size: selectedSatellite?.name === sat.name ? 0.25 : 0.15, // Much smaller dots
      ...sat
    }));
  }, [satellites, selectedSatellite?.name]); // Only recreate when satellites array changes or selection changes

  // Auto-rotate the globe based on state
  useEffect(() => {
    if (globeEl.current && globeReady) {
      const controls = globeEl.current.controls();
      controls.autoRotate = isRotating;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = true;
      controls.minDistance = 150;
      controls.maxDistance = 500;
    }
  }, [globeReady, isRotating]);

  // Toggle rotation
  const toggleRotation = () => {
    setIsRotating(!isRotating);
  };

  // Focus on selected satellite
  useEffect(() => {
    if (selectedSatellite && globeEl.current && globeReady) {
      globeEl.current.pointOfView(
        {
          lat: selectedSatellite.lat,
          lng: selectedSatellite.lon,
          altitude: 2.5
        },
        1000 // Animation duration
      );
      
      // Temporarily pause auto-rotation when focused on a satellite
      if (globeEl.current.controls()) {
        globeEl.current.controls().autoRotate = false;
      }
      
      // Resume auto-rotation after 5 seconds only if isRotating is true
      setTimeout(() => {
        if (globeEl.current?.controls() && isRotating) {
          globeEl.current.controls().autoRotate = true;
        }
      }, 5000);
    }
  }, [selectedSatellite, globeReady, isRotating]);

  return (
    <div className="h-full w-full relative bg-space-dark">
      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Points (satellites)
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="altitude"
        pointColor="color"
        pointRadius="size"
        pointLabel={(d) => `
          <div style="background: rgba(0,0,0,0.9); padding: 10px; border-radius: 8px; color: white;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <img
                src="${d.imageUrl || ''}"
                alt="${d.name}"
                style="width:36px; height:36px; object-fit:cover; border-radius:6px; border:1px solid rgba(255,255,255,0.25);"
              />
              <div style="font-size:11px; color:#9ca3af; line-height:1.3;">
                <div>NORAD: ${d.noradId || 'Unknown'}</div>
                <div>Launch: ${d.launchDesignator || 'Unavailable'}</div>
              </div>
            </div>
            <div style="font-size: 14px; font-weight: bold; color: #3b82f6; margin-bottom: 5px;">
              ${d.name}
            </div>
            <div style="font-size: 12px; line-height: 1.5;">
              <div><strong>Latitude:</strong> ${d.lat.toFixed(4)}°</div>
              <div><strong>Longitude:</strong> ${d.lon.toFixed(4)}°</div>
              <div><strong>Altitude:</strong> ${d.alt.toFixed(2)} km</div>
              <div><strong>Launched By:</strong> ${d.launchedBy || 'Unknown'}</div>
              <div><strong>Launch Year:</strong> ${d.launchYear || 'Unavailable'}</div>
            </div>
          </div>
        `}
        onPointClick={(point) => onSatelliteSelect(point)}
        
        // Arcs (orbital paths)
        arcsData={pathArcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcAltitude="altitude"
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={3000}
        
        // Globe styling
        atmosphereColor="rgba(100, 150, 255, 0.3)"
        atmosphereAltitude={0.15}
        
        // Animation
        animateIn={true}
        
        // Ready callback
        onGlobeReady={() => setGlobeReady(true)}
        
        // Initial view
        width={window.innerWidth - 320}
        height={window.innerHeight}
      />
      
      {/* Info overlay */}
      <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-90 p-4 rounded-lg z-20 backdrop-blur-sm border border-gray-700">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-satellite-orange rounded-full animate-pulse"></div>
            <p className="text-satellite-orange font-semibold">
              🛰️ {satellites.length} Satellites Tracked
            </p>
          </div>
          {selectedSatellite && (
            <div className="text-blue-400 text-sm border-t border-gray-700 pt-2 mt-2">
              <p className="font-medium">Selected:</p>
              <p className="text-white">{selectedSatellite.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rotation control button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleRotation}
          className="bg-gray-900 bg-opacity-90 hover:bg-opacity-100 p-3 rounded-lg backdrop-blur-sm border border-gray-700 transition-all hover:border-blue-500"
          title={isRotating ? "Pause rotation" : "Resume rotation"}
        >
          {isRotating ? (
            <Pause className="text-blue-400" size={20} />
          ) : (
            <Play className="text-satellite-orange" size={20} />
          )}
        </button>
      </div>

      {/* Controls info */}
      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-90 p-3 rounded-lg z-20 backdrop-blur-sm border border-gray-700">
        <p className="text-xs text-gray-300 space-y-1">
          <div>🖱️ <strong>Left Click + Drag:</strong> Rotate</div>
          <div>🔍 <strong>Scroll:</strong> Zoom In/Out</div>
          <div>👆 <strong>Click Satellite:</strong> Select</div>
          
        </p>
      </div>
    </div>
  );
};

export default SatelliteGlobe;

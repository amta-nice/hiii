import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom satellite icon
const satelliteIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="12" r="3" fill="#ffffff"/>
    </svg>
  `),
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

// Selected satellite icon (larger and different color)
const selectedSatelliteIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="#f62a06" stroke="#f70909" stroke-width="3"/>
      <circle cx="12" cy="12" r="4" fill="#ffffff"/>
    </svg>
  `),
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

// Map bounds adjuster component
function MapBoundsAdjuster({ satellites, selectedSatellite }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (selectedSatellite) {
      map.setView([selectedSatellite.lat, selectedSatellite.lon], 4, { animate: true });
    }
  }, [selectedSatellite, map]);

  return null;
}

const SatelliteMap = ({ satellites, selectedSatellite, onSatelliteSelect }) => {
  const [mapReady, setMapReady] = useState(false);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
        className="z-10"
        whenReady={() => setMapReady(true)}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
        />
        
        <MapBoundsAdjuster 
          satellites={satellites} 
          selectedSatellite={selectedSatellite} 
        />
        
        {satellites.map((satellite, index) => (
          <Marker
            key={`${satellite.name}-${index}`}
            position={[satellite.lat, satellite.lon]}
            icon={selectedSatellite?.name === satellite.name ? selectedSatelliteIcon : satelliteIcon}
            eventHandlers={{
              click: () => onSatelliteSelect(satellite)
            }}
          >
            <Popup>
              <div className="text-gray-800 min-w-[200px]">
                <h3 className="font-bold text-lg mb-2 text-blue-600">{satellite.name}</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Latitude:</strong> {satellite.lat.toFixed(4)}°</p>
                  <p><strong>Longitude:</strong> {satellite.lon.toFixed(4)}°</p>
                  <p><strong>Altitude:</strong> {satellite.alt.toFixed(2)} km</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Map info overlay */}
      <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 p-3 rounded-lg z-20 backdrop-blur-sm">
        <div className="text-sm">
          <p className="text-satellite-orange font-semibold">🛰️ {satellites.length} Satellites</p>
          {selectedSatellite && (
            <p className="text-red-400 mt-1">Selected: {selectedSatellite.name}</p>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-900 bg-opacity-90 p-3 rounded-lg z-20 backdrop-blur-sm">
        <div className="text-xs space-y-2">
          <h4 className="text-white font-semibold mb-2">Legend</h4>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-satellite-orange border border-white"></div>
            <span>Satellite</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatelliteMap;
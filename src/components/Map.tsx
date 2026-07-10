'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { LocationWithReviews } from '@/lib/supabase';
import { Star, MessageSquare } from 'lucide-react';

// Fix for default Leaflet marker icons which get broken in Webpack/Next.js builds
import 'leaflet/dist/leaflet.css';

// Custom red icon for newly added / pending pins
const pendingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom green icon for existing approved pins
const existingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapProps {
  locations: LocationWithReviews[];
  onMapClick?: (lat: number, lng: number) => void;
  selectedLocation?: LocationWithReviews | null;
  pendingClick?: { lat: number; lng: number } | null;
  onSelectLocation?: (location: LocationWithReviews) => void;
  theme?: 'light' | 'dark';
}

// Inner helper component to fly to selected location when changed
function MapController({ selectedLocation }: { selectedLocation?: LocationWithReviews | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo([selectedLocation.latitude, selectedLocation.longitude], 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [selectedLocation, map]);

  return null;
}

// Inner helper component to listen for double-click and long-press events on the map
function MapEvents({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    dblclick(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
    contextmenu(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function Map({
  locations,
  onMapClick,
  selectedLocation,
  pendingClick,
  onSelectLocation,
  theme = 'dark',
}: MapProps) {

  // Center of Ostrava, CZ
  const defaultCenter: [number, number] = [49.8209, 18.2625];
  const defaultZoom = 13;

  // Use elegant CartoDB tiles that fit light/dark themes
  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const attributionText = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm dark:border-slate-800">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        doubleClickZoom={false}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution={attributionText}
          url={tileUrl}
        />
        <ZoomControl position="bottomright" />

        <MapEvents onMapClick={onMapClick} />
        <MapController selectedLocation={selectedLocation} />

        {/* Existing Locations */}
        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={existingIcon}
            eventHandlers={{
              click: () => {
                if (onSelectLocation) {
                  onSelectLocation(loc);
                }
              },
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1 min-w-[200px]">
                {loc.image_urls && loc.image_urls.length > 0 && (
                  <img
                    src={loc.image_urls[0]}
                    alt={loc.name}
                    className="w-full h-24 object-cover rounded-md mb-2"
                  />
                )}
                <h3 className="font-semibold text-slate-800 text-sm mb-1">{loc.name}</h3>
                {loc.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 mb-2">{loc.description}</p>
                )}
                <div className="flex items-center justify-between text-xs font-medium border-t border-slate-100 pt-1">
                  <div className="flex items-center text-amber-500 gap-1">
                    <Star className="w-3 h-3 fill-amber-500" />
                    <span>{loc.average_rating > 0 ? loc.average_rating : 'Nový'}</span>
                  </div>
                  <div className="flex items-center text-slate-500 gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{loc.reviews_count} recenzí</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Pending Click Pin */}
        {pendingClick && (
          <Marker position={[pendingClick.lat, pendingClick.lng]} icon={pendingIcon}>
            <Popup>
              <div className="p-1 text-center">
                <p className="font-semibold text-xs text-rose-600">Nové místo</p>
                <p className="text-[10px] text-slate-500">Zadej údaje v bočním panelu</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

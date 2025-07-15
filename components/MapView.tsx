'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Map, 
  Globe, 
  Search, 
  Navigation, 
  Layers,
  MapPin,
  Compass,
  Zap,
  Mountain,
  Target,
  Navigation2,
  RefreshCw,
  FileText,
  Calendar,
  Database
} from 'lucide-react';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RadarPlot {
  latitude: number;
  longitude: number;
  altitude: number;
  reflectivity: number;
  rainfall_rate: number;
}

interface RadarData {
  _id: string;
  filename: string;
  content_type: string;
  s3_url: string;
  uploaded_at: string;
  radar_plots: RadarPlot[];
}

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  reflectivity?: number;
  rainfall_rate?: number;
  altitude?: number;
  clusterSize?: number;
  clusterPoints?: Location[]; // Store original points in clusters
  description?: string; // For cluster descriptions
}

interface FileInfo {
  id: string;
  filename: string;
  uploaded_at: string;
  total_points: number;
  processing_status: string;
  is_chunked?: boolean;
}

interface DataMetadata {
  id: string;
  filename: string;
  total_points: number;
  content_type: string;
  uploaded_at: string;
  is_chunked: boolean;
  processing_status: string;
}

// Sample locations for fallback when API fails
const sampleLocations: Location[] = [
  {
    id: 'sample_1',
    name: 'Kolkata Weather Station',
    lat: 22.5726,
    lng: 88.3639,
    category: 'high_rain',
    reflectivity: 45.2,
    rainfall_rate: 12.5,
    altitude: 6
  },
  {
    id: 'sample_2', 
    name: 'Howrah Station',
    lat: 22.5958,
    lng: 88.2636,
    category: 'medium_rain',
    reflectivity: 32.1,
    rainfall_rate: 5.2,
    altitude: 8
  },
  {
    id: 'sample_3',
    name: 'Salt Lake Station',
    lat: 22.5744,
    lng: 88.4326,
    category: 'low_rain',
    reflectivity: 18.5,
    rainfall_rate: 0.8,
    altitude: 4
  },
  {
    id: 'sample_4',
    name: 'Jadavpur Station',
    lat: 22.4987,
    lng: 88.3731,
    category: 'medium_rain',
    reflectivity: 28.7,
    rainfall_rate: 3.1,
    altitude: 12
  },
  {
    id: 'sample_5',
    name: 'Dumdum Station',
    lat: 22.6405,
    lng: 88.4169,
    category: 'high_rain',
    reflectivity: 52.3,
    rainfall_rate: 18.9,
    altitude: 5
  }
];

interface GlobeMapProps {
  className?: string;
  locations: Location[];
  targetCoordinates?: { lat: number; lng: number } | null;
  radarData?: RadarData | null;
}

function GlobeMap({ className, locations, targetCoordinates, radarData }: GlobeMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Globe.GL styles to the document head
  useEffect(() => {
    // Add custom styles for Globe.GL
    const style = document.createElement('style');
    style.textContent = `
      .globe-tooltip {
        background-color: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 8px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        text-align: left !important;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        max-width: 200px !important;
      }
      .globe-container canvas {
        outline: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    const mountElement = mountRef.current; // Capture ref value
    setIsLoading(true);
    setError(null);

    // Load Globe.GL script dynamically
    const loadGlobeGL = async () => {
      try {
        // Check if Globe is already loaded
        if (typeof (window as any).Globe !== 'undefined') {
          initializeGlobe();
          return;
        }

        // Load D3 first
        const d3Script = document.createElement('script');
        d3Script.src = 'https://d3js.org/d3.v7.min.js';
        document.head.appendChild(d3Script);

        await new Promise((resolve) => {
          d3Script.onload = resolve;
        });

        // Then load Globe.GL
        const globeScript = document.createElement('script');
        globeScript.src = 'https://unpkg.com/globe.gl';
        document.head.appendChild(globeScript);

        await new Promise((resolve) => {
          globeScript.onload = resolve;
        });

        initializeGlobe();
      } catch (err) {
        setError('Failed to load Globe.GL library');
        setIsLoading(false);
        console.error('Error loading Globe.GL:', err);
      }
    };

    const initializeGlobe = () => {
      const Globe = (window as any).Globe;
      const d3 = (window as any).d3;

      if (!Globe || !d3) {
        setError('Globe.GL or D3 not loaded properly');
        setIsLoading(false);
        return;
      }

      try {

      // Define reflectivity color scale
      const reflectivityThresholds = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      const reflectivityColors = [
        '#ADD8E6', // < 10 dBZ (Light Blue)
        '#00BFFF', // 10-20 dBZ (Deep Sky Blue)
        '#90EE90', // 20-30 dBZ (Light Green)
        '#008000', // 30-40 dBZ (Green)
        '#1e8108', // dark green
        '#FFFF00', // 40-50 dBZ (Yellow)
        '#a7c307',
        '#FFA500', // 50-60 dBZ (Orange)
        '#f38b07',
        '#FF0000'  // >= 60 dBZ (Red)
      ];

      const reflectivityColorScale = d3.scaleThreshold()
        .domain(reflectivityThresholds)
        .range(reflectivityColors);

      // Initialize globe with standard points visualization
      const globe = Globe()
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
        .width(mountRef.current!.clientWidth)
        .height(mountRef.current!.clientHeight)
        .pointOfView({ lat: 22.5726, lng: 88.3639, altitude: 3.5 })
        // Use standard points for 3D visualization
        .pointsData(locations.map(location => ({
          lat: location.lat,
          lng: location.lng,
          altitude: location.altitude || 0,
          reflectivity: location.reflectivity || 0,
          rainfall_rate: location.rainfall_rate || 0,
          name: location.name
        })))
        .pointAltitude((d: any) => {
          // Use actual altitude of the point, scaled appropriately for globe visualization
          const altitude = d.altitude || 0;
          // Scale altitude to be visible on globe (convert meters to globe units)
          // Typical radar altitudes are 0-20km, so we scale to 0-0.02 globe units
          return Math.max(0.001, altitude * 0.00002); // Scale factor for visibility
        })
        .pointRadius(0.01) // Slightly larger point size for better visibility
        .pointColor((d: any) => {
          // Use D3 color scale for consistent coloring
          const reflectivity = d.reflectivity || 0;
          return reflectivityColorScale(reflectivity);
        })
        .pointLabel((d: any) => {
          return `
            <div style="background-color: rgba(0, 0, 0, 0.9); color: white; padding: 8px; border-radius: 5px; font-size: 12px; text-align: center;">
              <div><strong>${d.name}</strong></div>
              <div>Reflectivity: ${(d.reflectivity || 0).toFixed(1)} dBZ</div>
              <div>Rainfall: ${(d.rainfall_rate || 0).toFixed(2)} mm/h</div>
              <div>Altitude: ${(d.altitude || 0).toFixed(1)} m</div>
              <div style="margin-top: 4px; font-size: 10px; opacity: 0.8;">
                Click for details
              </div>
            </div>
          `;
        })
        (mountRef.current);

      globeRef.current = globe;

      // Set pixel ratio for crisp rendering
      const renderer = globe.renderer();
      if (renderer) {
        renderer.setPixelRatio(window.devicePixelRatio);
      }

      // Convert locations to points data for 3D globe
      const pointsData = locations.map(location => ({
        lat: location.lat,
        lng: location.lng,
        altitude: location.altitude || 0,
        reflectivity: location.reflectivity || 0,
        rainfall_rate: location.rainfall_rate || 0,
        name: location.name
      }));

      // Set points data for 3D visualization
      globe.pointsData(pointsData);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to initialize globe');
      setIsLoading(false);
      console.error('Error initializing globe:', err);
    }
  };

    loadGlobeGL();

    // Handle resize
    const handleResize = () => {
      if (globeRef.current && mountRef.current) {
        globeRef.current
          .width(mountRef.current.clientWidth)
          .height(mountRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountElement) {
        mountElement.innerHTML = '';
      }
    };
  }, [locations]); // Add locations dependency

  // Update data when locations change - use standard points
  useEffect(() => {
    if (globeRef.current && locations.length > 0) {
      const pointsData = locations.map(location => ({
        lat: location.lat,
        lng: location.lng,
        altitude: location.altitude || 0,
        reflectivity: location.reflectivity || 0,
        rainfall_rate: location.rainfall_rate || 0,
        name: location.name
      }));

      globeRef.current.pointsData(pointsData);
    }
  }, [locations]);

  // Update camera when target coordinates change
  useEffect(() => {
    if (globeRef.current && targetCoordinates) {
      globeRef.current.pointOfView({
        lat: targetCoordinates.lat,
        lng: targetCoordinates.lng,
        altitude: 2
      }, 2000); // 2 second transition
    }
  }, [targetCoordinates]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-900 text-white`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">Error loading 3D Globe</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ background: '#111827', position: 'relative' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <div>Loading 3D Globe...</div>
          </div>
        </div>
      )}
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}

// Component to handle map navigation and bounds tracking
function MapNavigator({ 
  targetCoordinates, 
  mapRef,
  onBoundsChange,
  onZoomChange 
}: { 
  targetCoordinates: { lat: number; lng: number } | null;
  mapRef: React.RefObject<L.Map>;
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (targetCoordinates && map) {
      map.setView([targetCoordinates.lat, targetCoordinates.lng], Math.max(map.getZoom(), 12), {
        animate: true,
        duration: 1.5
      });
    }
  }, [targetCoordinates, map]);

  useEffect(() => {
    if (!map) return;

    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChange(bounds);
    };

    const handleZoomEnd = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onBoundsChange(bounds);
      onZoomChange(zoom);
    };

    // Set initial bounds and zoom
    handleMoveEnd();
    handleZoomEnd();

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onBoundsChange, onZoomChange]);

  return null;
}

function MapControls({ 
  is3D, 
  onToggle3D, 
  onSearch, 
  searchTerm, 
  onSearchChange,
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  onCoordinateSearch,
  onRefresh,
  isLoading,
  error,
  onFileSelect
}: {
  is3D: boolean;
  onToggle3D: () => void;
  onSearch: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  latitude: string;
  longitude: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onCoordinateSearch: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  error: string | null;
  onFileSelect: () => void;
}) {
  const [searchMode, setSearchMode] = useState<'text' | 'coordinates'>('text');

  return (
    <div className="absolute top-4 left-4 z-[1000] space-y-4">
      <Card className="p-4 bg-white/90 backdrop-blur-md shadow-xl border-0">
        <div className="space-y-4">
          {/* Data Status and Refresh */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : isLoading ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <span className="text-xs text-gray-600">
                {error ? 'Error' : isLoading ? 'Loading...' : 'Live Data'}
              </span>
            </div>
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="h-7 px-2"
              title="Refresh radar data"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Search Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setSearchMode('text')}
              variant={searchMode === 'text' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              <Search className="h-4 w-4 mr-2" />
              Text Search
            </Button>
            <Button
              onClick={() => setSearchMode('coordinates')}
              variant={searchMode === 'coordinates' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              <Target className="h-4 w-4 mr-2" />
              Coordinates
            </Button>
          </div>

          {/* Search Inputs */}
          {searchMode === 'text' ? (
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search locations..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 border-gray-200 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                />
              </div>
              <Button 
                onClick={onSearch}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Latitude</label>
                  <Input
                    placeholder="e.g., 40.7128"
                    value={latitude}
                    onChange={(e) => onLatitudeChange(e.target.value)}
                    className="text-sm border-gray-200 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && onCoordinateSearch()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Longitude</label>
                  <Input
                    placeholder="e.g., -74.0060"
                    value={longitude}
                    onChange={(e) => onLongitudeChange(e.target.value)}
                    className="text-sm border-gray-200 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && onCoordinateSearch()}
                  />
                </div>
              </div>
              <Button 
                onClick={onCoordinateSearch}
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Navigation2 className="h-4 w-4 mr-2" />
                Go to Coordinates
              </Button>
            </div>
          )}
        </div>
        
        <Separator className="my-3" />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">View Mode</span>
            <Button
              onClick={onToggle3D}
              variant={is3D ? "default" : "outline"}
              size="sm"
              className="transition-all duration-200"
            >
              {is3D ? (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  3D Globe
                </>
              ) : (
                <>
                  <Map className="h-4 w-4 mr-2" />
                  2D Map
                </>
              )}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              <Layers className="h-3 w-3 mr-1" />
              Radar Data
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Navigation className="h-3 w-3 mr-1" />
              Reflectivity
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Mountain className="h-3 w-3 mr-1" />
              Rainfall Rate
            </Badge>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            💡 Zoom in (level 12+) to see individual markers
          </div>
        </div>
      </Card>
      
      <Card className="p-3 bg-white/90 backdrop-blur-md shadow-xl border-0">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Compass className="h-4 w-4" />
          <span>{is3D ? '3D Interactive Globe' : '2D Interactive Map'}</span>
        </div>
      </Card>
    </div>
  );
}

function LocationList({ locations, onLocationClick, radarData }: {
  locations: Location[];
  onLocationClick: (location: Location) => void;
  radarData?: RadarData | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayLimit = 50; // Limit displayed items for performance
  const displayedLocations = showAll ? locations : locations.slice(0, displayLimit);
  
  const getRainfallColor = (rate: number) => {
    if (rate > 2) return 'text-red-600 border-red-200';
    if (rate > 1) return 'text-orange-600 border-orange-200';
    return 'text-green-600 border-green-200';
  };

  return (
    <Card className="absolute top-4 right-4 w-80 max-h-96 overflow-y-auto bg-white/90 backdrop-blur-md shadow-xl border-0 z-[1000]">
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <MapPin className="h-4 w-4 mr-2" />
          Radar Data Points
          <Badge variant="outline" className="ml-2 text-xs">
            {locations.length} visible
          </Badge>
        </h3>
        
        {radarData && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs">
            <div className="font-medium text-blue-800">Dataset: {radarData.filename}</div>
            <div className="text-blue-600">Uploaded: {new Date(radarData.uploaded_at).toLocaleDateString()}</div>
          </div>
        )}
        
        {locations.length > displayLimit && (
          <div className="mb-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? 'Show Less' : `Show All ${locations.length} Points`}
            </Button>
          </div>
        )}
        
        <div className="space-y-2">
          {displayedLocations.map((location) => (
            <div
              key={location.id}
              onClick={() => onLocationClick(location)}
              className="p-3 rounded-lg bg-white/50 hover:bg-white/80 cursor-pointer transition-all duration-200 border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 text-sm">{location.name}</h4>
                  <div className="text-xs text-gray-600 mt-1 space-y-1">
                    {location.reflectivity !== undefined && (
                      <div>Reflectivity: <span className="font-mono">{location.reflectivity.toFixed(1)}dBZ</span></div>
                    )}
                    {location.rainfall_rate !== undefined && (
                      <div>Rainfall: <span className="font-mono">{location.rainfall_rate.toFixed(2)}mm/h</span></div>
                    )}
                    {location.altitude !== undefined && (
                      <div>Altitude: <span className="font-mono">{location.altitude.toFixed(1)}m</span></div>
                    )}
                    <div className="text-gray-500">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
                <div className="ml-2 space-y-1">
                  {location.rainfall_rate !== undefined ? (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getRainfallColor(location.rainfall_rate)}`}
                    >
                      {location.rainfall_rate > 2 ? 'High' : location.rainfall_rate > 1 ? 'Med' : 'Low'}
                    </Badge>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        location.category === 'cluster' ? 'border-blue-200 text-blue-600' :
                        location.category === 'landmark' ? 'border-red-200 text-red-600' :
                        location.category === 'urban' ? 'border-blue-200 text-blue-600' :
                        'border-green-200 text-green-600'
                      }`}
                    >
                      {location.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {!showAll && locations.length > displayLimit && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            Showing {displayLimit} of {locations.length} points
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MapView({ initialRadarData }: { initialRadarData?: RadarData } = {}) {
  const [is3D, setIs3D] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]); // Keep original data separate
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [targetCoordinates, setTargetCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [radarData, setRadarData] = useState<RadarData | null>(initialRadarData || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [dataMetadata, setDataMetadata] = useState<DataMetadata | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const mapRef = useRef<L.Map>(null);
  
  // Progressive rendering states - optimized for large datasets with clustering
  const [renderBatch, setRenderBatch] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [visibleBounds, setVisibleBounds] = useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  
  // Dynamic clustering configuration - always show all data
  const shouldUseCluster = filteredLocations.length > 100; // Use clustering for better performance
  const MIN_ZOOM_FOR_INDIVIDUAL_MARKERS = 13; // Show individual markers at higher zoom for detail

  // Simple marker clustering for performance - enhanced to show ALL points
  const clusterNearbyMarkers = useCallback((locations: Location[], zoomLevel: number = 5) => {

    
    // Calculate proper grid size based on the actual data extent and zoom level
    const lats = locations.map(loc => loc.lat);
    const lngs = locations.map(loc => loc.lng);
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    
    // Adaptive grid size based on data spread and zoom level - more granular clustering
    const baseGridSize = Math.max(latRange, lngRange) / (zoomLevel >= 12 ? 50 : 30); // Finer grid at high zoom
    const zoomFactor = Math.pow(2, Math.max(0, zoomLevel - 8));
    const gridSize = Math.max(0.0005, baseGridSize / zoomFactor); // Smaller minimum grid size
    
    
    const clusters: { [key: string]: Location[] } = {};
    
    locations.forEach((location) => {
      // Use proper geographic coordinates for clustering
      const gridX = Math.floor(location.lat / gridSize);
      const gridY = Math.floor(location.lng / gridSize);
      const key = `${gridX}_${gridY}`;
      
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(location);
    });
    
    const clusteredPoints = Object.values(clusters).map(cluster => {
      // At high zoom levels (12+), prefer individual points over small clusters
      if (cluster.length === 1 || (zoomLevel >= 12 && cluster.length <= 3)) {
        return cluster.length === 1 ? cluster[0] : cluster.map(point => point);
      }
      
      // Create a cluster representative with proper geographic center
      const avgLat = cluster.reduce((sum, loc) => sum + loc.lat, 0) / cluster.length;
      const avgLng = cluster.reduce((sum, loc) => sum + loc.lng, 0) / cluster.length;
      const avgReflectivity = cluster.reduce((sum, loc) => sum + (loc.reflectivity || 0), 0) / cluster.length;
      const avgRainfall = cluster.reduce((sum, loc) => sum + (loc.rainfall_rate || 0), 0) / cluster.length;
      const avgAltitude = cluster.reduce((sum, loc) => sum + (loc.altitude || 0), 0) / cluster.length;
      
      return {
        id: `cluster_${cluster[0].id}_${cluster.length}`,
        name: `Cluster (${cluster.length} points)`,
        description: `Avg Reflectivity: ${avgReflectivity.toFixed(1)}dBZ, Avg Rainfall: ${avgRainfall.toFixed(1)}mm/h`,
        lat: avgLat,
        lng: avgLng,
        category: 'cluster',
        reflectivity: avgReflectivity,
        rainfall_rate: avgRainfall,
        altitude: avgAltitude,
        clusterSize: cluster.length,
        clusterPoints: cluster // Store original points for detailed popup
      };
    }).flat(); // Flatten to handle individual points returned as arrays

    
    return clusteredPoints;
  }, []);

  // Fetch real data from API on component mount
  const fetchRadarData = useCallback(async (fileId?: string) => {
    if (initialRadarData) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const url = fileId ? `/api/data?fileId=${fileId}` : '/api/data';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.locations && Array.isArray(data.locations)) {
        setAllLocations(data.locations);
        setFilteredLocations(data.locations);
        setDataMetadata(data.metadata || null);
        setSelectedFileId(fileId || null);
        
        // Clear search and target when loading new data
        setSearchTerm('');
        setTargetCoordinates(null);
        setSelectedLocation(null);
      } else {
        // Fallback to sample data if API doesn't return expected format
        console.warn('API returned unexpected format, using sample data');
        setAllLocations(sampleLocations);
        setFilteredLocations(sampleLocations);
        setDataMetadata(null);
      }
    } catch (err) {
      console.error('Error fetching radar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load radar data');
      // Fallback to sample data on error
      setAllLocations(sampleLocations);
      setFilteredLocations(sampleLocations);
      setDataMetadata(null);
    } finally {
      setIsLoading(false);
    }
  }, [initialRadarData]);

  // Function to manually refresh data from API
  const refreshRadarData = async () => {
    await fetchRadarData(selectedFileId || undefined);
  };

  // Add file selection handler
  const handleFileSelect = async (fileId: string) => {
    setShowFileSelector(false);
    if (fileId !== selectedFileId) {
      await fetchRadarData(fileId);
    }
  };

  // Add useEffect to load available files on component mount
  useEffect(() => {
    fetchAvailableFiles();
  }, []);

  useEffect(() => {
    fetchRadarData();
  }, [initialRadarData, fetchRadarData]);

  // Debounced search effect for better performance
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (!searchTerm.trim()) {
        setFilteredLocations(allLocations);
        return;
      }

      const filtered = allLocations.filter(location =>
        location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.category.toLowerCase().includes(searchTerm.toLowerCase())
      );

      setFilteredLocations(filtered);
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, allLocations]);

  // Search and filtering functions
  const handleSearch = () => {
    // Search is now handled by the debounced useEffect
    // This function can be used for manual search triggering if needed
  };

  const handleCoordinateSearch = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Coordinates out of range');
      return;
    }

    setTargetCoordinates({ lat, lng });
    setError(null);
  };

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
    setTargetCoordinates({ lat: location.lat, lng: location.lng });
  };

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    setVisibleBounds(bounds);
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setMapZoom(zoom);
  }, []);

  // Optimized function to get locations to render - use clustering for performance while showing ALL data
  const locationsToRender = useMemo(() => {
    let locations = filteredLocations;
    
    if (locations.length > 0) {
      // Analyze coordinate distribution
      const lats = locations.map(loc => loc.lat);
      const lngs = locations.map(loc => loc.lng);
      const latSpread = Math.max(...lats) - Math.min(...lats);
      const lngSpread = Math.max(...lngs) - Math.min(...lngs); 
    }
    
    // Apply clustering for performance while ensuring ALL data is represented
    if (shouldUseCluster && locations.length > 100) {
      const clusteredData = clusterNearbyMarkers(locations, mapZoom);
      return clusteredData;
    }
    return locations;
  }, [filteredLocations, mapZoom, shouldUseCluster, clusterNearbyMarkers]);

  // Add function to fetch available files
  const fetchAvailableFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const response = await fetch('/api/files');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.files && Array.isArray(data.files)) {
        setAvailableFiles(data.files);
      } else {
        console.warn('No files found in response');
        setAvailableFiles([]);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Add FileSelector component
  const FileSelector = () => (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 max-h-[70vh] overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Radar Data File</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileSelector(false)}
            >
              ×
            </Button>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto">
          {isLoadingFiles ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading files...</p>
            </div>
          ) : availableFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No radar files available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedFileId === file.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleFileSelect(file.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(file.uploaded_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Database className="h-3 w-3" />
                          {file.total_points.toLocaleString()} points
                        </div>
                      </div>
                    </div>
                    <div className="ml-2">
                      <Badge 
                        variant={file.processing_status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {file.processing_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAvailableFiles}
            disabled={isLoadingFiles}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            Refresh List
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <div className="text-lg font-medium">Loading Radar Data...</div>
            <div className="text-sm text-gray-300">Fetching real-time weather information</div>
          </div>
        </div>
      )}
      
      {/* Add FileSelector */}
      {showFileSelector && <FileSelector />}
      
      {is3D ? (
        <GlobeMap 
          className="w-full h-full" 
          locations={filteredLocations}
          targetCoordinates={targetCoordinates}
          radarData={radarData}
        />
      ) : (
        <MapContainer
          center={(() => {
            if (locationsToRender.length > 0) {
              // Calculate center based on actual data
              const lats = locationsToRender.map(loc => loc.lat);
              const lngs = locationsToRender.map(loc => loc.lng);
              const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
              const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
              return [centerLat, centerLng];
            }
            return [22.5726, 88.3639]; // Default to Kolkata
          })()}
          zoom={locationsToRender.length > 0 ? 8 : 2}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapNavigator 
            targetCoordinates={targetCoordinates} 
            mapRef={mapRef} 
            onBoundsChange={handleBoundsChange} 
            onZoomChange={handleZoomChange}
          />
          {locationsToRender.map((location, index) => {
            
            // Validate coordinates before rendering
            if (typeof location.lat !== 'number' || typeof location.lng !== 'number' || 
                isNaN(location.lat) || isNaN(location.lng)) {
              console.warn(`Skipping marker with invalid coordinates:`, location);
              return null;
            }
            
            const intensity = location.rainfall_rate || 0;
            const reflectivity = location.reflectivity || 0;
            const isCluster = location.clusterSize && location.clusterSize > 1;
            
            // Color based on reflectivity with proper weather radar color scale
            let color = '#0066FF'; // Default blue
            if (reflectivity >= 50) color = '#FF0000';      // Red - Severe weather
            else if (reflectivity >= 45) color = '#FF6600'; // Orange-Red
            else if (reflectivity >= 35) color = '#FFAA00'; // Orange  
            else if (reflectivity >= 25) color = '#FFFF00'; // Yellow
            else if (reflectivity >= 15) color = '#00FF00'; // Green
            else if (reflectivity >= 10) color = '#00FFFF'; // Cyan
            else if (reflectivity >= 5) color = '#0099FF';  // Light Blue
            
            // Size based on rainfall rate and cluster size
            let radius = Math.max(4, Math.min(10, 5 + (intensity * 2)));
            if (isCluster) {
              // Larger radius for clusters, scaled by cluster size
              radius = Math.max(4, Math.min(15, 4 + Math.log10(location.clusterSize || 1) * 2));
            }
            
            return (
              <CircleMarker
                key={location.id}
                center={[location.lat, location.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  color: isCluster ? '#333' : 'white',
                  weight: isCluster ? 2 : 1,
                  opacity: 0.8,
                  fillOpacity: isCluster ? 0.8 : 0.7
                }}
              >
                <Popup maxWidth={400}>
                  <div className="p-2">
                    <h3 className="font-semibold text-gray-800 text-sm">{location.name}</h3>
                    
                    {isCluster ? (
                      // Cluster popup with detailed information
                      //Todo : in pop fetch location info from gmaps using lat and long
                      <div className="text-xs text-gray-500 mt-1 space-y-2">
                        <div className="bg-blue-50 p-2 rounded">
                          <div className="font-medium text-blue-800">Cluster Information</div>
                          <div>Contains: <strong>{location.clusterSize} data points</strong></div>
                          <div>Center: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="font-medium">Avg Reflectivity:</div>
                            <div style={{color: color}}>{reflectivity.toFixed(1)} dBZ</div>
                          </div>
                          <div>
                            <div className="font-medium">Avg Rainfall:</div>
                            <div>{intensity.toFixed(2)} mm/h</div>
                          </div>
                        </div>
                        
                        {location.altitude !== undefined && (
                          <div>Avg Altitude: <span className="font-mono">{location.altitude.toFixed(1)}m</span></div>
                        )}
                        
                        <div className="text-xs text-gray-400 mt-1">
                          💡 Zoom in further to see individual points
                        </div>
                        
                        {location.clusterPoints && location.clusterPoints.length <= 10 && (
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            <div className="font-medium text-gray-700 mb-1">Individual Points:</div>
                            {location.clusterPoints.slice(0, 10).map((point, idx) => (
                              <div key={idx} className="text-xs bg-gray-50 p-1 rounded mb-1">
                                {point.name}: {point.reflectivity?.toFixed(1)} dBZ, {point.rainfall_rate?.toFixed(1)} mm/h
                              </div>
                            ))}
                            {location.clusterPoints.length > 10 && (
                              <div className="text-xs text-gray-500">... and {location.clusterPoints.length - 10} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Individual point popup
                      <div className="text-xs text-gray-500 mt-1 space-y-1">
                        <div>
                          Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </div>
                        {location.reflectivity !== undefined && (
                          <div>Reflectivity: <span className="font-mono" style={{color: color}}>{location.reflectivity.toFixed(1)}dBZ</span></div>
                        )}
                        {location.rainfall_rate !== undefined && (
                          <div>Rainfall Rate: <span className="font-mono">{location.rainfall_rate.toFixed(2)}mm/h</span></div>
                        )}
                        {location.altitude !== undefined && (
                          <div>Altitude: <span className="font-mono">{location.altitude.toFixed(1)}m</span></div>
                        )}
                      </div>
                    )}
                    
                    <Badge variant="outline" className="mt-2 text-xs">
                      {isCluster ? `Cluster (${location.clusterSize})` : location.category}
                    </Badge>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {targetCoordinates && (
            <Marker
              position={[targetCoordinates.lat, targetCoordinates.lng]}
              icon={L.divIcon({
                className: 'custom-target-marker',
                html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-gray-800">Target Location</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    Latitude: {targetCoordinates.lat.toFixed(6)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Longitude: {targetCoordinates.lng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      )}
      
      <MapControls
        is3D={is3D}
        onToggle3D={() => setIs3D(!is3D)}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        latitude={latitude}
        longitude={longitude}
        onLatitudeChange={setLatitude}
        onLongitudeChange={setLongitude}
        onCoordinateSearch={handleCoordinateSearch}
        onRefresh={refreshRadarData}
        isLoading={isLoading}
        error={error}
        onFileSelect={() => setShowFileSelector(true)}
      />

      <GlobeLegend is3D={is3D} />
      
      {/* Status Bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000]">
        <Card className="px-4 py-2 bg-black/20 backdrop-blur-md border-0 text-white">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <MapPin className="h-3 w-3" />
              <span>{locationsToRender.length} visible</span>
              {filteredLocations.length !== locationsToRender.length && (
                <span className="text-xs opacity-75">
                  / {filteredLocations.length} total
                </span>
              )}
            </div>
            <Separator orientation="vertical" className="h-4 bg-white/30" />
            <div className="flex items-center space-x-1">
              <span className="text-xs">
                Zoom: {mapZoom} {mapZoom < MIN_ZOOM_FOR_INDIVIDUAL_MARKERS ? '(Clustered)' : '(Individual)'}
              </span>
            </div>
            <Separator orientation="vertical" className="h-4 bg-white/30" />
            <span>{is3D ? '3D Globe View' : '2D Map View'}</span>
            {dataMetadata && (
              <>
                <Separator orientation="vertical" className="h-4 bg-white/30" />
                <div className="flex items-center space-x-1">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-32">{dataMetadata.filename}</span>
                </div>
              </>
            )}
            {targetCoordinates && (
              <>
                <Separator orientation="vertical" className="h-4 bg-white/30" />
                <div className="flex items-center space-x-1">
                  <Target className="h-3 w-3" />
                  <span>{targetCoordinates.lat.toFixed(2)}, {targetCoordinates.lng.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

function GlobeLegend({ is3D }: { is3D: boolean }) {
  if (!is3D) return null;

  const legendItems = [
    { color: '#ADD8E6', label: '< 5 dBZ', description: 'Light precipitation' },
    { color: '#00BFFF', label: '5-15 dBZ', description: 'Light rain' },
    { color: '#90EE90', label: '15-25 dBZ', description: 'Moderate rain' },
    { color: '#008000', label: '25-35 dBZ', description: 'Heavy rain' },
    { color: '#FFFF00', label: '35-45 dBZ', description: 'Very heavy rain' },
    { color: '#FFA500', label: '45-55 dBZ', description: 'Extreme precipitation' },
    { color: '#FF0000', label: '≥ 55 dBZ', description: 'Severe weather' }
  ];

  return (
    <Card className="absolute bottom-36 right-4 bg-white/90 backdrop-blur-md shadow-xl border-0 z-[1000] max-w-xs">
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Reflectivity Scale</h3>
        <div className="space-y-2">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center space-x-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full border border-gray-300" 
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1">
                <div className="font-medium text-gray-700">{item.label}</div>
                <div className="text-gray-500 text-xs">{item.description}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-600">
          <div><strong>Height:</strong> Rainfall Rate (mm/h)</div>
          <div><strong>Color:</strong> Reflectivity (dBZ)</div>
        </div>
      </div>
    </Card>
  );
}}
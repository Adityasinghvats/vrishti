'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Map, 
  Globe, 
  Sparkles, 
  Navigation,
  Zap,
  ArrowRight
} from 'lucide-react';

// Dynamic import to avoid SSR issues with maps
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 font-medium">Loading Interactive Map...</p>
      </div>
    </div>
  )
});

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Hero Section */}
          <div className="space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-20 animate-pulse"></div>
              </div>
              <div className="relative z-10 flex justify-center space-x-4 mb-6">
                <div className="p-4 rounded-full bg-white shadow-lg animate-bounce" style={{ animationDelay: '0s' }}>
                  <Map className="h-8 w-8 text-blue-600" />
                </div>
                <div className="p-4 rounded-full bg-white shadow-lg animate-bounce" style={{ animationDelay: '0.2s' }}>
                  <Globe className="h-8 w-8 text-purple-600" />
                </div>
                <div className="p-4 rounded-full bg-white shadow-lg animate-bounce" style={{ animationDelay: '0.4s' }}>
                  <Navigation className="h-8 w-8 text-indigo-600" />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Interactive Map Explorer
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Discover the world in stunning detail with our advanced mapping platform. 
                Switch seamlessly between 2D maps and interactive 3D globe views.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 my-12">
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Map className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">2D Mapping</h3>
                <p className="text-sm text-gray-600">
                  High-resolution satellite imagery with interactive markers and detailed overlays
                </p>
              </div>
            </Card>
            
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <Globe className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">3D Globe</h3>
                <p className="text-sm text-gray-600">
                  Immersive 3D globe experience with realistic terrain and smooth animations
                </p>
              </div>
            </Card>
            
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Smart Search</h3>
                <p className="text-sm text-gray-600">
                  Intelligent location search with real-time filtering and categorization
                </p>
              </div>
            </Card>
          </div>

          {/* Features List */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Zap className="h-3 w-3 mr-1" />
              Real-time Updates
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Navigation className="h-3 w-3 mr-1" />
              GPS Integration
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Globe className="h-3 w-3 mr-1" />
              Global Coverage
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              <Map className="h-3 w-3 mr-1" />
              Multi-layer Support
            </Badge>
          </div>

          {/* CTA Button */}
          <div className="pt-4">
            <Button
              onClick={() => setShowWelcome(false)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              Explore the World
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Loading indicator */}
          {!isLoaded && (
            <div className="pt-8">
              <div className="flex items-center justify-center space-x-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Preparing map components...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <MapView />;
}
import { NextResponse } from "next/server";

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

interface RadarData {
  _id: string;
  filename: string;
  content_type: string;
  s3_url: string;
  uploaded_at: string;
  radar_plots: RadarPlot[];
  total_points?: number;
  is_chunked?: boolean;
  processing_status?: string;
}

interface RadarPlot {
  latitude: number;
  longitude: number;
  altitude: number;
  reflectivity: number;
  rainfall_rate: number;
  intensity_category: string;
  elevation_angle: number;
  sweep_number: number;
  timestamp: string;
}

interface Location {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: string;
  reflectivity?: number;
  rainfall_rate?: number;
  altitude?: number;
}

export async function GET(request: Request) {
    try {
       const { searchParams } = new URL(request.url);
       const fileId = searchParams.get('fileId');

       let backendUrl = `${process.env.BACKEND_URL}/api/v1/data`;
       if (fileId) {
           backendUrl += `?file_id=${fileId}`;
       }
       
       
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
       
       const radarData = await fetch(backendUrl, {
         signal: controller.signal,
         headers: {
           'Accept': 'application/json',
           'Content-Type': 'application/json',
         },
       });
       
       clearTimeout(timeoutId);
       
       
       
       // Check response headers for content-length
       const contentLength = radarData.headers.get('content-length');
       
         if (!radarData.ok) {
           throw new Error(`Backend responded with status: ${radarData.status}`);
       }
       
       // Get response as text first to check if it's complete
       const responseText = await radarData.text();

       
       // Parse the JSON
       let data: RadarData;
       try {
         data = JSON.parse(responseText);
       } catch (parseError) {
         console.error('JSON Parse Error:', parseError);
         throw new Error('Invalid JSON response from backend');
       }
       
       
       // Check if the response includes total_points
       if (data.total_points) {
           if (data.total_points !== data.radar_plots.length) {
               console.warn('⚠️  MISMATCH: Backend claims', data.total_points, 'total points but sent', data.radar_plots.length, 'points');
           }
       }
       
       // Check if radar_plots array seems complete
       if (data.radar_plots.length > 0) {
         console.log('First radar plot:', data.radar_plots[0]);
         console.log('Last radar plot:', data.radar_plots[data.radar_plots.length - 1]);
       }

       if (!data || !data.radar_plots || !Array.isArray(data.radar_plots)) {
           console.log('Data validation failed - no radar_plots array found');
           return NextResponse.json({
               error: "Invalid data format received from backend - no radar_plots found"
           }, { status: 500 });
       }
       
       if (data.radar_plots.length === 0) {
           console.log('No radar plots found in data');
           return NextResponse.json({
               error: "No radar plots found"
           }, { status: 500 });
       }
       

       const locations: Location[] = data.radar_plots.map((plot, index) => ({
           id: `radar_${data._id || 'unknown'}_${index}`,
           name: `Radar Point ${index + 1}`,
           description: `Reflectivity: ${plot.reflectivity}dBZ, Rainfall: ${plot.rainfall_rate}mm/h, Alt: ${plot.altitude}m`,
           lat: plot.latitude,
           lng: plot.longitude,
           category: plot.intensity_category || (
               plot.rainfall_rate > 2 ? 'high_rain' :
               plot.rainfall_rate > 1 ? 'medium_rain' : 'low_rain'
           ),
           reflectivity: plot.reflectivity,
           rainfall_rate: plot.rainfall_rate,
           altitude: plot.altitude
       }));
       
       
       // Include metadata in response
       return NextResponse.json({ 
           locations,
           metadata: {
               id: data._id,
               filename: data.filename,
               total_points: data.radar_plots.length,
               content_type: data.content_type || 'unknown',
               uploaded_at: data.uploaded_at || 'unknown',
               is_chunked: data.is_chunked || false,
               processing_status: data.processing_status || 'unknown'
           }
       });

    } catch (error) {
        console.error('Error in API route:', error);
        return NextResponse.json({
            error: `Failed to fetch radar data: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
    }
}
import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

interface FileInfo {
  id: string;
  filename: string;
  uploaded_at: string;
  total_points: number;
  processing_status: string;
  is_chunked?: boolean;
}

export async function GET() {
    try {
        console.log('Fetching available files from backend...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch('http://localhost:8000/api/v1/files', {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch files: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Files fetched successfully:', data.files?.length || 0, 'files');
        
        return NextResponse.json(data);
        
    } catch (error) {
        console.error('Error fetching files:', error);
        return NextResponse.json({
            error: `Failed to fetch files: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
    }
}
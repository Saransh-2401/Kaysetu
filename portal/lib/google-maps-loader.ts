/**
 * Centralized Google Maps API Loader
 * Ensures the Google Maps script is loaded only once across the application
 */

let isLoading = false;
let isLoaded = false;
const callbacks: Array<() => void> = [];

export const loadGoogleMapsScript = (callback?: () => void): void => {
    // If already loaded, call callback immediately
    if (isLoaded || (window as any).google?.maps) {
        isLoaded = true;
        callback?.();
        return;
    }

    // Add callback to queue
    if (callback) {
        callbacks.push(callback);
    }

    // If already loading, just wait for it
    if (isLoading) {
        return;
    }

    // Check if script tag already exists
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
        isLoading = true;
        existingScript.addEventListener('load', () => {
            isLoaded = true;
            isLoading = false;
            callbacks.forEach(cb => cb());
            callbacks.length = 0;
        });
        return;
    }

    // Load the script
    isLoading = true;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === 'undefined') {
        console.warn('Google Maps API Key is missing or undefined.');
    }


    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // Using simple parameters for maximum legacy compatibility
    const params = new URLSearchParams({
        key: apiKey || '',
        libraries: 'places',
        loading: 'async',   // Google best-practice async bootstrap (silences the console warning)
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;


    script.onload = () => {
        isLoaded = true;
        isLoading = false;
        callbacks.forEach(cb => cb());
        callbacks.length = 0;
    };

    script.onerror = () => {
        isLoading = false;
        console.error('Failed to load Google Maps script');
    };

    document.head.appendChild(script);
};

export const isGoogleMapsLoaded = (): boolean => {
    return isLoaded || !!(window as any).google?.maps;
};


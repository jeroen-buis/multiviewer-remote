

import { QueryClient, useQuery } from '@tanstack/react-query';
import { Settings } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // Cache data for 5 seconds
      retry: (failureCount, error: Error) => {
        // Don't retry on client-side errors, but do on timeouts/network issues
        if (error.message?.includes('HTTP error')) {
            const status = parseInt(error.message.match(/status: (\d+)/)?.[1] || '0', 10);
            if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export const getApiUrl = (settings: Settings): string => {
    // Priority 1: Developer query parameter override (for external use/bookmarking)
    const urlParams = new URLSearchParams(window.location.search);
    const devApiUrl = urlParams.get('dev_api_url');
    if (devApiUrl) {
        return devApiUrl;
    }

    // Priority 2: Developer Mode setting override
    if (settings.developerMode && settings.apiOverrideUrl) {
        return settings.apiOverrideUrl;
    }
    
    // Priority 3: Standard construction from host setting
    if (settings.multiviewerHost) {
        return `http://${settings.multiviewerHost.trim()}:10101/api/graphql`;
    }
    
    // Final fallback, should not be reached if settings are loaded correctly.
    return '';
};


const isLocalUrl = (url: string): boolean => {
    try {
        const parsedUrl = new URL(url);
        const { hostname } = parsedUrl;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return true;
        }
        if (hostname.endsWith('.local')) {
            return true;
        }
        // Check for private IP ranges (RFC 1918)
        if (
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
        ) {
            return true;
        }
        return false;
    } catch (e) {
        // If URL parsing fails, assume it's not a valid local URL
        return false;
    }
};

export const fetchGraphQL = async (query: string, operationName: string, multiviewerUrl: string, variables: Record<string, unknown> = {}) => {
    if (!multiviewerUrl) {
        throw new Error("Multiviewer URL is not set.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                query,
                operationName,
                variables
            }),
            signal: controller.signal,
        };
        
        const isHostedSecurely = window.location.protocol === 'https:';

        // The `targetAddressSpace` property is part of the Private Network Access (PNA) spec.
        // It is required when a secure (HTTPS) public website needs to connect to a private/local
        // network endpoint (like Multiviewer running on HTTP). We only apply this PNA flag when
        // the app is hosted on HTTPS, allowing developers to connect to `localhost` from a local
        // `http://` server without triggering PNA security flows.
        if (isLocalUrl(multiviewerUrl) && isHostedSecurely) {
            (fetchOptions as Record<string, unknown>).targetAddressSpace = 'local';
        }

        const response = await fetch(multiviewerUrl, fetchOptions);

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody}`);
        }
        const result = await response.json();
        if (result.errors) {
            throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
        }
        return result.data;
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out. The connection to Multiviewer may have been lost.');
        }
        throw error;
    }
};

export const postMutation = async (mutation: string, operationName: string, multiviewerUrl: string, variables: Record<string, unknown>) => {
    const data = await fetchGraphQL(mutation, operationName, multiviewerUrl, variables);
    // The error handling is already inside fetchGraphQL, so we just return the data.
    return data;
};

// Retries postMutation when the GraphQL error matches a "not-yet-ready" code from MultiViewer.
// PLAYER_NOT_FOUND and SOURCE_INVALID both indicate the new player hasn't finished warming up;
// a brief wait + retry usually succeeds on the second or third attempt.
const READY_STATE_RETRY_CODES = ['PLAYER_NOT_FOUND', 'SOURCE_INVALID'];

export const postMutationWithRetry = async (
    mutation: string,
    operationName: string,
    multiviewerUrl: string,
    variables: Record<string, unknown>,
    options: { maxAttempts?: number; retryDelayMs?: number; retryableCodes?: string[] } = {},
) => {
    const maxAttempts = options.maxAttempts ?? 3;
    const retryDelayMs = options.retryDelayMs ?? 500;
    const retryableCodes = options.retryableCodes ?? READY_STATE_RETRY_CODES;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await postMutation(mutation, operationName, multiviewerUrl, variables);
        } catch (error: unknown) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            const isRetryable = retryableCodes.some((code) => message.includes(code));
            if (!isRetryable || attempt === maxAttempts) {
                throw error;
            }
            console.warn(`${operationName} attempt ${attempt} failed with retryable error; retrying in ${retryDelayMs}ms.`);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }
    throw lastError;
};

const STATIC_DATA_QUERY = `
  query GetStaticData {
    activeSubscriptions {
      subscriptionType
      expiresAt
    }
    systemInfo {
      platform
      arch
    }
    version
  }
`;

const DYNAMIC_DATA_QUERY = `
  query GetDynamicData {
    players {
      id type state { ts paused muted volume live currentTime interpolatedCurrentTime }
      driverData { driverNumber tla firstName lastName teamName }
      streamData { contentId meetingKey sessionKey channelId title }
      bounds { x y width height }
      fullscreen alwaysOnTop maintainAspectRatio
    }
    f1LiveTimingState {
      SessionInfo SessionStatus WeatherData WeatherDataSeries LapCount DriverList TrackStatus TimingData LapSeries TimingAppData RaceControlMessages ChampionshipPrediction
    }
  }
`;

export const useStaticData = (multiviewerUrl: string) => {
  return useQuery({
    queryKey: ['staticData', multiviewerUrl],
    queryFn: () => fetchGraphQL(STATIC_DATA_QUERY, 'GetStaticData', multiviewerUrl),
    enabled: !!multiviewerUrl,
    staleTime: Infinity, // Static data doesn't change
  });
};

export const useDynamicData = (multiviewerUrl: string, refreshInterval: number, isEnabled: boolean) => {
  return useQuery({
    queryKey: ['dynamicData', multiviewerUrl],
    queryFn: () => fetchGraphQL(DYNAMIC_DATA_QUERY, 'GetDynamicData', multiviewerUrl),
    enabled: isEnabled,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: true, // Refetch when user comes back to the tab
  });
};
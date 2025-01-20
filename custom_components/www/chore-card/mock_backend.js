// In-memory mock state storage
const mockStates = {};

// Mock function to simulate loading state
async function loadState(url) {
    const sensorId = url.split('/api/states/sensor.')[1];
    console.log('Mock: Loading state for', sensorId);

    if (mockStates[sensorId]) {
        console.log('Loaded state:', sensorId, mockStates[sensorId]);
        return new Response(
            JSON.stringify({
                state: JSON.stringify(mockStates[sensorId]),
            }),
            { status: 200 }
        );
    } else {
        console.warn('State not found:', sensorId);
        return new Response(null, { status: 404 });
    }
}

// Mock function to simulate saving state
async function saveState(url, body) {
    const sensorId = url.split('/api/states/sensor.')[1];
    const parsedBody = JSON.parse(body);
    mockStates[sensorId] = JSON.parse(parsedBody.state);

    console.log('Saved state:', sensorId, mockStates[sensorId]);
    return new Response(null, { status: 200 });
}

// Override the fetch API to intercept API calls
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
    console.log(`Intercepted fetch request: ${url}`, options);

    if (url.includes('/api/states/sensor.')) {
        const sensorId = url.split('/api/states/sensor.')[1];
        if (sensorId) {
            if (options && options.method === 'GET') {
                return loadState(url);
            } else if (options && options.method === 'POST') {
                return saveState(url, options.body);
            }
        }
    }
    return originalFetch(url, options); // Default behavior for non-mocked endpoints
};

// Self-test to ensure the mock backend works
(async () => {
    const testResponse = await fetch('/api/states/sensor.mock-test', { method: 'GET' });
    if (testResponse.status === 404) {
        console.log('Mock backend test: Fetch override works but no state found.');
    } else {
        console.log('Mock backend test: Fetch override works and state was found.');
    }
})();

console.log('Mock backend initialized for chore card testing.');

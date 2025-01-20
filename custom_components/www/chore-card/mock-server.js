const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
const app = express();
const port = 3000;

// Mock state storage
const mockStates = {};

// Use CORS to allow requests from all origins
app.use(cors());
app.use(bodyParser.json());

// Load initial data from chores.yaml
function loadYamlFile() {
    try {
        const yamlContent = fs.readFileSync('./chores.yaml', 'utf8');
        const yamlData = yaml.load(yamlContent);
        console.log('Loaded initial data from chores.yaml:', yamlData);
        return yamlData;
    } catch (err) {
        console.error('Error loading chores.yaml:', err);
        return null;
    }
}

const initialYamlData = loadYamlFile();
if (initialYamlData) {
    mockStates['chore-card-12345'] = {
        data: initialYamlData.chores || {},
        userPoints: {},
        lastReset: null,
    };

    // Initialize user points
    if (initialYamlData.users) {
        initialYamlData.users.forEach(user => {
            mockStates['chore-card-12345'].userPoints[user.name] = 0;
        });
    }
}

// GET endpoint for state retrieval
app.get('/api/states/sensor.:id', (req, res) => {
    const sensorId = req.params.id;
    console.log(`Fetching state for sensor: ${sensorId}`);
    if (mockStates[sensorId]) {
        res.json({ state: JSON.stringify(mockStates[sensorId]) });
    } else {
        res.status(404).send('Not Found');
    }
});

// POST endpoint for state saving
app.post('/api/states/sensor.:id', (req, res) => {
    const sensorId = req.params.id;
    const parsedBody = JSON.parse(req.body.state);
    mockStates[sensorId] = parsedBody;

    console.log(`Saved state for sensor: ${sensorId}`, mockStates[sensorId]);
    res.status(200).send('OK');
});

// Start the server
app.listen(port, () => {
    console.log(`Mock API server running at http://localhost:${port}`);
});

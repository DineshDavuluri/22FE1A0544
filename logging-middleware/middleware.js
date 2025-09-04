const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJkaW5lc2hkYXZ1bHVyaTE2QGdtYWlsLmNvbSIsImV4cCI6MTc1Njk2OTA2NSwiaWF0IjoxNzU2OTY4MTY1LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNDlhYjI5ZjctOTk2Mi00YTAwLTkxYWItMzk4NjY1MDk5MDM2IiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiZGluZXNoIGRhdnVsdXJpIiwic3ViIjoiZjYzYmNjNDMtOTcwZS00YTdjLTkyZjMtZWE5NWNjODdlN2ZhIn0sImVtYWlsIjoiZGluZXNoZGF2dWx1cmkxNkBnbWFpbC5jb20iLCJuYW1lIjoiZGluZXNoIGRhdnVsdXJpIiwicm9sbE5vIjoiMjJmZTFhMDU0NCIsImFjY2Vzc0NvZGUiOiJZenVKZVUiLCJjbGllbnRJRCI6ImY2M2JjYzQzLTk3MGUtNGE3Yy05MmYzLWVhOTVjYzg3ZTdmYSIsImNsaWVudFNlY3JldCI6ImRmc2V3SGdiYWhjTXFrSlgifQ.iOR6xUNQIhGdwapKRa7VqQs1psr_SQToHWWvCcpTE3M';

const STACKS = ['backend', 'frontend'];
const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const PACKAGES = {
    backend: ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service', 'auth', 'config', 'middleware', 'utils'],
    frontend: ['api', 'component', 'hook', 'page', 'state', 'style', 'auth', 'config', 'middleware', 'utils']
};

function validateInput(stack, level, pkg) {
    return STACKS.includes(stack) && LEVELS.includes(level) && PACKAGES[stack].includes(pkg);
}

async function sendLog(stack, level, pkg, message) {
    stack = (stack || '').toLowerCase();
    level = (level || '').toLowerCase();
    pkg = (pkg || '').toLowerCase();

    if (!validateInput(stack, level, pkg)) {
        throw new Error(`Invalid log input: stack='${stack}', level='${level}', package='${pkg}'`);
    }

    const payload = { stack, level, package: pkg, message };

    try {
        const response = await axios.post(
            'http://20.244.56.144/evaluation-service/logs',
            payload,
            { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }
        );
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
}

app.post('/log', async (req, res) => {
    const { stack, level, package: pkg, message } = req.body;
    try {
        const result = await sendLog(stack, level, pkg, message);
        res.status(200).json(result);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});
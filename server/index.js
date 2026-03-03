import app from './app.js';

const PORT = process.env.PORT || 6008;
app.listen(PORT, () => console.log(`[MODULAR] Server running on http://localhost:${PORT}`));

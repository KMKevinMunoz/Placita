require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' }
});
app.use('/api/auth/login', loginLimiter);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const authRoutes      = require('./src/routes/auth.routes');
const productRoutes   = require('./src/routes/products.routes');
const salesRoutes     = require('./src/routes/sales.routes');
const scalesRoutes    = require('./src/routes/scales.routes');
const ingresosRoutes  = require('./src/routes/ingresos.routes');
const prestamosRoutes = require('./src/routes/prestamos.routes');
const cajaBaseRoutes  = require('./src/routes/caja_base.routes');

app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/sales',     salesRoutes);
app.use('/api/scales',    scalesRoutes);
app.use('/api/ingresos',  ingresosRoutes);
app.use('/api/prestamos', prestamosRoutes);
app.use('/api/caja-base',  cajaBaseRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n🌿 ======================================');
  console.log(`   La Placita corriendo en:`);
  console.log(`   http://localhost:${PORT}`);
  console.log('   ======================================\n');
});

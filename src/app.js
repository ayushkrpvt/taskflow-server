const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes        = require('./routes/auth.routes');
const userRoutes        = require('./routes/users.routes');
const departmentRoutes  = require('./routes/departments.routes');
const projectRoutes     = require('./routes/projects.routes');
const templateRoutes    = require('./routes/templates.routes');
const taskRoutes        = require('./routes/tasks.routes');
const commentRoutes     = require('./routes/comments.routes');
const attachmentRoutes  = require('./routes/attachments.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/projects',    projectRoutes);
app.use('/api/templates',   templateRoutes);
app.use('/api/tasks',       taskRoutes);
app.use('/api/comments',    commentRoutes);
app.use('/api/attachments', attachmentRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;

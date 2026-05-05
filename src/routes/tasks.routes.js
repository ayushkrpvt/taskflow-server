const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/tasks.controller');
const { authenticate } = require('../middleware/auth');
const { atLeast } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/',    atLeast('employee'), ctrl.list);
router.get('/:id', atLeast('employee'), ctrl.get);

router.post('/',
  atLeast('hod'),
  body('project_id').isInt(),
  body('title').notEmpty(),
  body('department_id').isInt(),
  validate,
  ctrl.create
);

router.put('/:id', atLeast('hod'), ctrl.update);

router.patch('/:id/assign',
  atLeast('hod'),
  body('assigned_to').isInt(),
  validate,
  ctrl.assign
);

router.patch('/:id/status',
  atLeast('employee'),
  body('status').isIn(['in_progress', 'submitted', 'completed', 'needs_revision', 'cancelled', 'pending']),
  validate,
  ctrl.updateStatus
);

module.exports = router;

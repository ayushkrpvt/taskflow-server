const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/projects.controller');
const { authenticate } = require('../middleware/auth');
const { allow, atLeast } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/',    atLeast('employee'), ctrl.list);
router.get('/:id', atLeast('employee'), ctrl.get);

router.post('/',
  allow('super_admin'),
  body('name').notEmpty(),
  validate,
  ctrl.create
);

router.put('/:id',
  atLeast('admin'),
  body('name').notEmpty(),
  body('status').isIn(['active', 'on_hold', 'completed', 'cancelled']),
  validate,
  ctrl.update
);

module.exports = router;

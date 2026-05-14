const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/territories.controller');
const { authenticate } = require('../middleware/auth');
const { allow, atLeast } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/', atLeast('employee'), ctrl.list);

router.post('/',
  allow('super_admin', 'admin'),
  body('name').notEmpty(),
  body('type').isIn(['country', 'state', 'zone', 'city']),
  validate,
  ctrl.create
);

router.put('/:id',
  allow('super_admin', 'admin'),
  body('name').notEmpty(),
  validate,
  ctrl.update
);

router.delete('/:id', allow('super_admin', 'admin'), ctrl.remove);

// User territory assignment
router.get('/users/:id', atLeast('hod'), ctrl.getUserTerritories);
router.put('/users/:id', allow('super_admin', 'admin'), body('territory_ids').isArray(), validate, ctrl.setUserTerritories);

module.exports = router;

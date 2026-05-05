const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { allow, atLeast } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/',    atLeast('admin'), ctrl.list);
router.get('/:id', atLeast('hod'),  ctrl.get);

router.post('/',
  allow('super_admin'),
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['super_admin', 'admin', 'hod', 'employee']),
  validate,
  ctrl.create
);

router.put('/:id',
  allow('super_admin'),
  body('name').notEmpty(),
  body('email').isEmail(),
  body('role').isIn(['super_admin', 'admin', 'hod', 'employee']),
  validate,
  ctrl.update
);

router.patch('/:id/password',
  allow('super_admin'),
  body('password').isLength({ min: 8 }),
  validate,
  ctrl.changePassword
);

module.exports = router;

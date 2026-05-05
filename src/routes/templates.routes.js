const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/templates.controller');
const { authenticate } = require('../middleware/auth');
const { allow } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

router.post('/',
  allow('super_admin'),
  body('name').notEmpty(),
  validate,
  ctrl.create
);

router.put('/:id',
  allow('super_admin'),
  body('name').notEmpty(),
  validate,
  ctrl.update
);

module.exports = router;

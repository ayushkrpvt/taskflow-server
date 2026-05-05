const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/attachments.controller');
const { authenticate } = require('../middleware/auth');
const { atLeast } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.post('/presign',
  atLeast('employee'),
  body('task_id').isInt(),
  body('file_name').notEmpty(),
  body('file_type').notEmpty(),
  validate,
  ctrl.presign
);

router.post('/confirm',
  atLeast('employee'),
  body('task_id').isInt(),
  body('original_name').notEmpty(),
  body('storage_key').notEmpty(),
  body('file_url').notEmpty(),
  validate,
  ctrl.confirm
);

router.delete('/:id', atLeast('employee'), ctrl.remove);

module.exports = router;

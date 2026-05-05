const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/comments.controller');
const { authenticate } = require('../middleware/auth');
const { atLeast } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.post('/',
  atLeast('employee'),
  body('task_id').isInt(),
  body('comment').notEmpty(),
  validate,
  ctrl.create
);

router.delete('/:id', atLeast('employee'), ctrl.remove);

module.exports = router;

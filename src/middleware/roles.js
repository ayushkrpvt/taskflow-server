const ROLE_RANK = { super_admin: 4, admin: 3, hod: 2, employee: 1 };

function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function atLeast(role) {
  return (req, res, next) => {
    if ((ROLE_RANK[req.user.role] || 0) < (ROLE_RANK[role] || 0)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = { allow, atLeast };

import { validationResult } from 'express-validator';

// Middleware to handle validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors for a cleaner response
    const formattedErrors = errors.array().map(err => ({
      field: err.param, // Use param instead of path for consistency
      message: err.msg,
      value: err.value,
    }));
    return res.status(400).json({ errors: formattedErrors });
  }
  next();
};

export default validateRequest;
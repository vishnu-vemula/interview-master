import multer from 'multer';
import AppError from '../utils/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new AppError('Only PDF resumes are supported.', 400));
    } else callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export default upload;

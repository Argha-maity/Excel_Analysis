const express = require("express");
const multer = require("multer");
const path = require('path');
const fs = require('fs');

const { 
    handleFileUpload, 
    getFileData, 
    getAllFiles, 
    deleteFile,
    getDashboardStats,
    downloadFile,} = require("../controllers/File");
const { protect } = require("../middleware/auth");

const router = express.Router();

const uploadPath = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files are allowed.'));
        }
    }
});

router.post(
  "/upload",
  protect,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Multer error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      next();
    });
  },
  handleFileUpload
);

router.get("/files", protect, getAllFiles);
router.get('/files/dashboard/stats', protect, getDashboardStats);
router.get('/files/:id/download', protect, downloadFile);
router.get("/files/:id", protect, getFileData);
router.delete("/files/:id", protect, deleteFile);

module.exports = router;
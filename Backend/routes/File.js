const express = require("express");
const multer = require("multer");

const { 
    handleFileUpload, 
    getFileData, 
    getAllFiles, 
    deleteFile,
    getDashboardStats,
    downloadFile,} = require("../controllers/File");
const { protect } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
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

router.post("/upload", protect, upload.single("file"), handleFileUpload);
router.get("/files", protect, getAllFiles);
router.get("/files/:id", protect, getFileData);
router.delete("/files/:id", protect, deleteFile);
router.get('/files/dashboard/stats', protect, getDashboardStats);
router.get('/files/:id/download', protect, downloadFile);


module.exports = router;
const File = require("../models/File");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require('path');

async function handleFileUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const processedData = {};

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = jsonData.shift() || [];
      const rows = jsonData;

      processedData[sheetName] = {
        headers,
        rows,
        columnTypes: detectColumnTypes(headers, rows)
      };
    });

    const file = new File({
      filename: req.file.originalname,       
      originalname: req.file.originalname,
      userId: req.user.id,
      processedData,
      size: req.file.size
    });

    await file.save();

    res.json({
      fileId: file._id,
      filename: file.originalname,
      data: processedData
    });

  } catch (err) {
    console.error("Error in handleFileUpload:", err);
    res.status(500).json({ message: "Failed to process file" });
  }
}

async function getAllFiles(req, res) {
  try {
    const files = await File.find({ userId: req.user.id }).sort({ createdAt: -1 });

    const formatted = files.map(file => ({
      _id: file._id,
      filename: file.filename,
      createdAt: file.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error in getAllFiles:", err);
    res.status(500).json({ message: "Failed to fetch files" });
  }
}

async function getFileData(req, res) {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({
      fileId: file._id,
      filename: file.filename,
      data: file.processedData
    });

  } catch (err) {
    console.error("Error in getFileData:", err);
    res.status(500).json({ message: "Failed to fetch file data" });
  }
}

async function deleteFile(req, res) {
  const { id } = req.params;
  if (!id || id === 'undefined') {
    return res.status(400).json({ message: "Invalid file ID" });
  }

  try {
    const file = await File.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({ message: "File deleted successfully" });
  } catch (err) {
    console.error("Error deleting file:", err);
    res.status(500).json({ message: "Failed to delete file" });
  }
}


function detectColumnTypes(headers, rows) {
  if (rows.length === 0) return {};

  const types = {};
  headers.forEach((header, index) => {
    const sampleValues = rows.slice(0, 5).map(row => row[index]);
    types[header] = guessDataType(sampleValues);
  });
  return types;
}

function guessDataType(values) {
  if (values.every(v => v === null || v === undefined)) return "unknown";
  if (values.every(v => typeof v === "number")) return "number";
  if (values.every(v => !isNaN(Date.parse(v)))) return "date";
  if (values.every(v => typeof v === "boolean")) return "boolean";
  return "string";
}

async function getDashboardStats(req, res) {
  try {
    const userId = req.user.id;

    const totalFiles = await File.countDocuments({ userId });
    const totalCharts = totalFiles * 5; 
    const chartImports = totalFiles * 2; // placeholder

    const filesProcessedChange = "+5 from last month"; // Replace with real logic
    const chartsCreatedChange = "+12 from last week";
    const chartImportsChange = "+3 from last week";

    res.json({
      filesProcessed: totalFiles,
      filesProcessedChange,
      chartsCreated: totalCharts,
      chartsCreatedChange,
      chartImports,
      chartImportsChange,
    });

  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
}

async function downloadFile(req, res) {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.id });

    if (!file) {
      return res.status(404).json({ message: 'File not found in DB' });
    }

    if (!file.filename) {
      return res.status(400).json({ message: 'File filename missing in DB' });
    }


    const filePath = path.join(__dirname, '..', 'uploads', file.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.download(filePath, file.originalname || file.filename); 
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ message: 'Download failed' });
  }
}

module.exports = {
  handleFileUpload,
  getFileData,
  getAllFiles,
  deleteFile,
  getDashboardStats,
  downloadFile,
};
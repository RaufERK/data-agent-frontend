import React, { useState } from 'react';
import { Box, Typography, Button, Paper, TextField, CircularProgress } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const OCRPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/ocr`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setResult(response.data.text || 'Текст не распознан');
      } else {
        setResult(`Ошибка: ${response.data.error}`);
      }
    } catch (error: any) {
      setResult(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        OCR Распознавание
      </Typography>
      
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ mb: 2 }}>
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="upload-file"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="upload-file">
            <Button
              variant="contained"
              component="span"
              startIcon={<UploadIcon />}
              disabled={loading}
            >
              Выбрать изображение
            </Button>
          </label>
          {file && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Выбран файл: {file.name}
            </Typography>
          )}
        </Box>
        
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!file || loading}
          sx={{ mb: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Распознать текст'}
        </Button>
        
        {result && (
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Распознанный текст"
            value={result}
            InputProps={{ readOnly: true }}
            sx={{ mt: 2 }}
          />
        )}
      </Paper>
    </Box>
  );
};

export default OCRPage;


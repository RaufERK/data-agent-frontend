import React, { useState } from 'react';
import { Box, Typography, Button, Paper, TextField, CircularProgress } from '@mui/material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ERDPage: React.FC = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/generate-erd`, { text });
      if (response.data.success) {
        setResult(response.data.dot || 'ERD схема будет здесь');
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
        Генерация ERD
      </Typography>
      
      <Paper sx={{ p: 3, mt: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={10}
          label="Описание аналитической панели"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите описание данных и метрик..."
          sx={{ mb: 2 }}
        />
        
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!text.trim() || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Сгенерировать ERD'}
        </Button>
        
        {result && (
          <TextField
            fullWidth
            multiline
            rows={15}
            label="ERD схема (Graphviz DOT)"
            value={result}
            InputProps={{ readOnly: true }}
            sx={{ mt: 3 }}
          />
        )}
      </Paper>
    </Box>
  );
};

export default ERDPage;


import React from 'react';
import { Box, Typography, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import ImageIcon from '@mui/icons-material/Image';
import SchemaIcon from '@mui/icons-material/Schema';
import DashboardIcon from '@mui/icons-material/Dashboard';

const HomePage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        AI Platform
      </Typography>
      <Typography variant="h6" color="text.secondary" paragraph>
        Платформа для AI-функционала: OCR, ERD генерация, анализ данных
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <ImageIcon sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h5" component="h2">
                OCR Распознавание
              </Typography>
              <Typography color="text.secondary">
                Распознавание текста из изображений с помощью EasyOCR и Tesseract
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" component={Link} to="/ocr">
                Открыть
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <SchemaIcon sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h5" component="h2">
                ERD Генерация
              </Typography>
              <Typography color="text.secondary">
                Автоматическая генерация ERD схем из текстового описания
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" component={Link} to="/erd">
                Открыть
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <DashboardIcon sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h5" component="h2">
                Анализ данных
              </Typography>
              <Typography color="text.secondary">
                Рекомендации по дизайну чартов и анализ структуры данных
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" disabled>
                Скоро
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HomePage;


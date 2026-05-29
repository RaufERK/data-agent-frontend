import React, { useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Card, CardContent,
  LinearProgress, Alert, AlertTitle, Grid, Fade,
} from '@mui/material';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import StorageIcon from '@mui/icons-material/Storage';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useProject } from '../store/ProjectContext';

const MartPage: React.FC = () => {
  const {
    project, buildMart, goToPetalStep, setPetalStatus,
  } = useProject();

  const status = project?.status || 'empty';
  const detailBuilt = (project?.detailTables?.length ?? 0) > 0;
  const buildingMart = status === 'building_mart';
  const martBuilt = status === 'mart_built' || project?.petalStatuses?.mart === 'green';

  useEffect(() => {
    if (detailBuilt && !martBuilt && !buildingMart) {
      buildMart();
    }
  }, [detailBuilt, martBuilt, buildingMart, buildMart]);

  return (
    <Fade in>
      <Box>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          Витрины данных (Data Mart)
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Агрегаты и витрины строятся на основе детального слоя и макетов дашбордов.
          Витрина — это готовая таблица для конкретного дашборда или аналитической задачи.
        </Typography>

        {!detailBuilt && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Сначала постройте детальный слой</AlertTitle>
            Витрины строятся на основе детального слоя (DWH). Перейдите в раздел «Детальный слой» и постройте его.
            <Box sx={{ mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={() => goToPetalStep('detail', 0)}>
                Перейти к детальному слою
              </Button>
            </Box>
          </Alert>
        )}

        {buildingMart && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2, mx: 'auto', maxWidth: 500 }} />
            <Typography variant="body1" color="text.secondary">
              Анализируем детальный слой и макеты дашбордов, строим витрины...
            </Typography>
          </Paper>
        )}

        {martBuilt && (
          <>
            <Alert severity="info" sx={{ mb: 3 }} icon={<ViewModuleIcon />}>
              <AlertTitle>Реальные витрины ещё не материализованы</AlertTitle>
              Моковые витрины отключены. Этот шаг больше не рисует синтетические mart-таблицы.
              Когда backend начнёт возвращать реальные витрины, они будут показаны здесь.
            </Alert>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #42a5f5' }}>
                  <Typography variant="h4" sx={{ color: '#42a5f5' }}>0</Typography>
                  <Typography variant="caption" color="text.secondary">Материализованных витрин</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #66bb6a' }}>
                  <Typography variant="h4" sx={{ color: '#66bb6a' }}>{project?.detailTables?.length ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Таблиц в detail layer</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #ffa726' }}>
                  <Typography variant="h4" sx={{ color: '#ffa726' }}>0</Typography>
                  <Typography variant="caption" color="text.secondary">Синтетических измерений</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #ab47bc' }}>
                  <Typography variant="h4" sx={{ color: '#ab47bc' }}>0</Typography>
                  <Typography variant="caption" color="text.secondary">Подставленных строк</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ color: '#8b949e' }}><StorageIcon /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Место для реальных витрин
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      После подключения backend-материализации здесь будут показаны названия витрин, их метрики, измерения и источники.
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button startIcon={<ArrowBackIcon />} onClick={() => goToPetalStep('detail', 0)}>
                Детальный слой
              </Button>
              <Button variant="contained" endIcon={<ArrowForwardIcon />}
                onClick={() => { setPetalStatus('mart', 'green'); goToPetalStep('model', 0); }}>
                Проектирование (ERD)
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Fade>
  );
};

export default MartPage;

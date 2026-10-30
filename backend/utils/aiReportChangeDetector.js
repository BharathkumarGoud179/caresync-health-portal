/**
 * CareSync Longitudinal Biomarker Trend Analyzer & Anomaly Detector
 * Analyzes health measurements, vital indicators, and lab tests across multiple historical reports.
 * Detects positive/negative trends, trajectory velocity, and critical health drift.
 */

const { analyzeMedicalReport } = require('./aiLabAnalyzer');

/**
 * Standard units and clinical reference mappings
 */
const BIOMARKER_STANDARDS = {
  'Fasting Blood Glucose': { unit: 'mg/dL', optimalMin: 70, optimalMax: 99, directionLowerIsBetter: true },
  'Hemoglobin A1c (HbA1c)': { unit: '%', optimalMin: 4.0, optimalMax: 5.6, directionLowerIsBetter: true },
  'Total Cholesterol': { unit: 'mg/dL', optimalMin: 125, optimalMax: 199, directionLowerIsBetter: true },
  'LDL Cholesterol': { unit: 'mg/dL', optimalMin: 50, optimalMax: 99, directionLowerIsBetter: true },
  'HDL Cholesterol': { unit: 'mg/dL', optimalMin: 45, optimalMax: 90, directionLowerIsBetter: false }, // Higher is better
  'Serum Triglycerides': { unit: 'mg/dL', optimalMin: 50, optimalMax: 149, directionLowerIsBetter: true },
  'Hemoglobin (Hb)': { unit: 'g/dL', optimalMin: 12.5, optimalMax: 17.0, directionLowerIsBetter: null },
  'White Blood Cell (WBC)': { unit: 'cells/mcL', optimalMin: 4500, optimalMax: 11000, directionLowerIsBetter: null },
  'Platelet Count': { unit: '/mcL', optimalMin: 150000, optimalMax: 450000, directionLowerIsBetter: null },
  'Serum Creatinine': { unit: 'mg/dL', optimalMin: 0.6, optimalMax: 1.2, directionLowerIsBetter: true },
  'Thyroid Stimulating Hormone (TSH)': { unit: 'mIU/L', optimalMin: 0.4, optimalMax: 4.0, directionLowerIsBetter: null }
};

/**
 * Analyzes longitudinal changes across an array of patient reports
 * @param {Array} reports - Chronologically sorted reports (oldest to newest or vice versa)
 * @returns {Promise<Object>} Longitudinal trend analysis
 */
async function detectChangesBetweenReports(reports) {
  if (!reports || reports.length === 0) {
    return {
      status: 'insufficient_data',
      message: 'At least 2 reports are required to analyze longitudinal biomarker changes.',
      trends: [],
      overallTrajectory: 'Stable',
      summary: 'No historical reports available for trend analysis.'
    };
  }

  // Sort chronological: oldest to newest
  const sortedReports = [...reports].sort((a, b) => new Date(a.reportDate || a.createdAt) - new Date(b.reportDate || b.createdAt));

  // Ensure each report has aiAnalysis populated
  for (const r of sortedReports) {
    if (!r.aiAnalysis || !r.aiAnalysis.keyBiomarkers || r.aiAnalysis.keyBiomarkers.length === 0) {
      r.aiAnalysis = await analyzeMedicalReport(r);
    }
  }

  // Map biomarkers across timeline: biomarkerName -> [ { date, value, numValue, unit, reportId, reportTitle, status } ]
  const seriesMap = new Map();

  sortedReports.forEach((r) => {
    const reportDate = new Date(r.reportDate || r.createdAt);
    const biomarkers = r.aiAnalysis?.keyBiomarkers || [];

    biomarkers.forEach((b) => {
      const cleanName = b.name.trim();
      const numVal = parseFloat(b.value.toString().replace(/,/g, ''));
      if (isNaN(numVal)) return;

      if (!seriesMap.has(cleanName)) {
        seriesMap.set(cleanName, []);
      }

      seriesMap.get(cleanName).push({
        date: reportDate,
        dateFormatted: reportDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        value: b.value,
        numValue: numVal,
        unit: b.unit || '',
        referenceRange: b.referenceRange || '',
        status: b.status,
        reportId: r._id,
        reportTitle: r.title
      });
    });
  });

  // Calculate trends for biomarkers with at least 2 readings
  const analyzedTrends = [];
  let improvingCount = 0;
  let worseningCount = 0;
  let criticalAlerts = [];

  for (const [name, timeline] of seriesMap.entries()) {
    if (timeline.length >= 2) {
      const initial = timeline[0];
      const latest = timeline[timeline.length - 1];
      const absoluteChange = latest.numValue - initial.numValue;
      const percentChange = initial.numValue !== 0 ? Math.round(((latest.numValue - initial.numValue) / initial.numValue) * 100) : 0;

      // Determine clinical directionality
      const standard = BIOMARKER_STANDARDS[name] || {};
      let trendType = 'neutral'; // 'improving', 'worsening', 'stable'
      let clinicalInterpretation = '';

      if (Math.abs(percentChange) < 3) {
        trendType = 'stable';
        clinicalInterpretation = `Maintained steady physiological baseline (${initial.value} to ${latest.value} ${latest.unit}).`;
      } else if (standard.directionLowerIsBetter === true) {
        if (absoluteChange < 0) {
          trendType = 'improving';
          improvingCount++;
          clinicalInterpretation = `Favorable reduction of ${Math.abs(percentChange)}% (${initial.value} -> ${latest.value} ${latest.unit}). Reflects positive response to care plan or lifestyle adjustment.`;
        } else {
          trendType = 'worsening';
          worseningCount++;
          clinicalInterpretation = `Unfavorable elevation of +${percentChange}% (${initial.value} -> ${latest.value} ${latest.unit}). Suggests increasing metabolic or cardiovascular burden.`;
        }
      } else if (standard.directionLowerIsBetter === false) {
        // Higher is better (e.g. HDL)
        if (absoluteChange > 0) {
          trendType = 'improving';
          improvingCount++;
          clinicalInterpretation = `Favorable increase of +${percentChange}% (${initial.value} -> ${latest.value} ${latest.unit}), promoting higher cardio-protective index.`;
        } else {
          trendType = 'worsening';
          worseningCount++;
          clinicalInterpretation = `Decline of ${Math.abs(percentChange)}% (${initial.value} -> ${latest.value} ${latest.unit}). Consideration of aerobic activity advised.`;
        }
      } else {
        // Target is staying inside optimal range
        if (latest.status === 'Normal' && initial.status !== 'Normal') {
          trendType = 'improving';
          improvingCount++;
          clinicalInterpretation = `Normalizing trend (${initial.value} -> ${latest.value} ${latest.unit}), returning within standard clinical reference thresholds.`;
        } else if (latest.status !== 'Normal' && initial.status === 'Normal') {
          trendType = 'worsening';
          worseningCount++;
          clinicalInterpretation = `Deviation detected from prior normal reading (${initial.value} -> ${latest.value} ${latest.unit}). Follow-up review recommended.`;
        } else {
          trendType = 'neutral';
          clinicalInterpretation = `Shifted from ${initial.value} to ${latest.value} ${latest.unit} (${absoluteChange > 0 ? '+' : ''}${percentChange}%).`;
        }
      }

      if (latest.status === 'Critical' || (trendType === 'worsening' && Math.abs(percentChange) >= 20)) {
        criticalAlerts.push(`${name} shifted by ${absoluteChange > 0 ? '+' : ''}${percentChange}% to ${latest.value} ${latest.unit} (${latest.status}).`);
      }

      analyzedTrends.push({
        name,
        unit: latest.unit,
        baselineDate: initial.dateFormatted,
        baselineValue: initial.value,
        latestDate: latest.dateFormatted,
        latestValue: latest.value,
        absoluteChange: Number(absoluteChange.toFixed(2)),
        percentChange,
        direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'flat',
        trendType,
        clinicalInterpretation,
        readingsCount: timeline.length,
        timeline: timeline.map(t => ({ date: t.dateFormatted, value: t.numValue, status: t.status, reportTitle: t.reportTitle }))
      });
    }
  }

  // Determine overall health trajectory
  let overallTrajectory = 'Stable';
  let trajectoryColor = 'primary';
  if (worseningCount > improvingCount && worseningCount >= 2) {
    overallTrajectory = 'Deteriorating';
    trajectoryColor = 'danger';
  } else if (improvingCount > worseningCount && improvingCount >= 1) {
    overallTrajectory = 'Improving';
    trajectoryColor = 'success';
  } else if (criticalAlerts.length > 0) {
    overallTrajectory = 'Attention Needed';
    trajectoryColor = 'warning';
  }

  // Generate Executive Comparative Summary
  const firstReport = sortedReports[0];
  const lastReport = sortedReports[sortedReports.length - 1];
  const timespanDays = Math.round((new Date(lastReport.reportDate || lastReport.createdAt) - new Date(firstReport.reportDate || firstReport.createdAt)) / (1000 * 60 * 60 * 24));

  let executiveSummary = `Longitudinal comparison of ${sortedReports.length} diagnostic reports across ${timespanDays} days indicates an **${overallTrajectory.toUpperCase()}** overall health trajectory. `;
  if (analyzedTrends.length === 0) {
    executiveSummary += `Common biomarkers were not repeated across these reports. Regular periodic blood panels are recommended to establish multi-point trend tracking.`;
  } else {
    executiveSummary += `Evaluated ${analyzedTrends.length} repeated biomarkers: ${improvingCount} parameter(s) demonstrate positive recovery/improvement, while ${worseningCount} parameter(s) show upward drift requiring clinical vigilance.`;
  }

  return {
    status: 'completed',
    timespanDays,
    reportsComparedCount: sortedReports.length,
    firstReportDate: new Date(firstReport.reportDate || firstReport.createdAt).toLocaleDateString(),
    latestReportDate: new Date(lastReport.reportDate || lastReport.createdAt).toLocaleDateString(),
    overallTrajectory,
    trajectoryColor,
    improvingCount,
    worseningCount,
    stableCount: analyzedTrends.length - improvingCount - worseningCount,
    criticalAlerts,
    summary: executiveSummary,
    trends: analyzedTrends,
    comparedReports: sortedReports.map(r => ({ id: r._id, title: r.title, category: r.category, date: r.reportDate }))
  };
}

module.exports = {
  detectChangesBetweenReports
};

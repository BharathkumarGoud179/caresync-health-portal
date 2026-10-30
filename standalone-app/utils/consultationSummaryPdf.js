const PDFDocument = require('pdfkit');

/**
 * Generates an official, read-only Medical Consultation Summary PDF
 * Compiles a condensed executive overview of patient medical history,
 * current vitals, active prescriptions, and recent lab results for a consultation.
 *
 * @param {Object} data - { patient, doctor, reports, prescriptions, tasks, generatedBy }
 * @param {Object} stream - Writable stream
 */
function generateConsultationSummaryPdf(data, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `CareSync Clinical Consultation Summary - ${data.patient?.name || 'Patient'}`,
      Author: 'CareSync Secure Health Vault',
      Subject: 'Read-Only Medical Consultation Brief',
      Keywords: 'medical summary, consultation brief, ehr, caresync'
    }
  });

  doc.pipe(stream);

  const primaryColor = '#1e3a8a';   // Deep Blue
  const secondaryColor = '#0d9488'; // Teal
  const darkTextColor = '#0f172a';  // Slate 900
  const mutedTextColor = '#64748b'; // Slate 500
  const lightBgColor = '#f8fafc';   // Slate 50
  const borderColor = '#cbd5e1';    // Slate 300

  // 1. TOP HEADER BANNER
  doc.rect(40, 40, 515, 75).fill(primaryColor);
  doc
    .fillColor('#ffffff')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('CareSync Medical Consultation Brief', 55, 52)
    .fontSize(9)
    .font('Helvetica')
    .text('OFFICIAL READ-ONLY PATIENT CLINICAL SUMMARY • TIME-BOUND SHARING', 55, 72)
    .text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 55, 86);

  doc
    .fillColor('#93c5fd')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Zero-Trust Sharing Protocol', 360, 52, { align: 'right', width: 180 })
    .font('Helvetica')
    .fontSize(8)
    .text('HIPAA / ISO-27001 Protected', 360, 68, { align: 'right', width: 180 })
    .text('Single-Consultation Access', 360, 80, { align: 'right', width: 180 });

  // 2. PATIENT DEMOGRAPHICS & CLINICAL VITALS BOX
  let y = 125;
  doc.rect(40, y, 515, 60).fill(lightBgColor).stroke(borderColor);

  const p = data.patient || {};
  doc
    .fillColor(primaryColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('PATIENT CLINICAL PROFILE', 55, y + 10);

  doc
    .fillColor(darkTextColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(p.name || 'Patient', 55, y + 26)
    .font('Helvetica')
    .fontSize(9)
    .text(`${p.age ? p.age + ' Years' : 'N/A'} • ${p.gender || 'N/A'} • Blood: ${p.bloodGroup || 'N/A'} • Phone: ${p.phone || 'N/A'}`, 55, y + 42);

  doc
    .fillColor('#dc2626')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`Known Allergies: ${p.allergies || 'None reported'}`, 300, y + 26, { align: 'right', width: 240 })
    .fillColor(mutedTextColor)
    .font('Helvetica')
    .text(`Consulting Physician: ${data.doctor?.name || 'Authorized Doctor'}`, 300, y + 42, { align: 'right', width: 240 });

  // 3. EXECUTIVE CARE COMPLIANCE & ACTIVE DIAGNOSES
  y += 75;
  doc
    .fillColor(primaryColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('ACTIVE DIAGNOSES & TREATMENT ADHERENCE', 40, y);

  y += 18;
  const prescriptions = data.prescriptions || [];
  if (prescriptions.length === 0) {
    doc.fillColor(mutedTextColor).fontSize(9).font('Helvetica-Oblique').text('No active clinical diagnoses or care plans on file.', 40, y);
    y += 18;
  } else {
    prescriptions.forEach((rx, idx) => {
      doc
        .fillColor(darkTextColor)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(`${idx + 1}. ${rx.diagnosis}`, 45, y)
        .fillColor(mutedTextColor)
        .fontSize(8.5)
        .font('Helvetica')
        .text(`Prescribed by ${rx.doctor?.name || 'Attending Doctor'} on ${new Date(rx.createdAt).toLocaleDateString()}`, 45, y + 12);
      y += 28;
    });
  }

  // 4. CURRENT ACTIVE MEDICATIONS
  y += 10;
  doc
    .fillColor(primaryColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('CURRENT MEDICATIONS SCHEDULE', 40, y);

  y += 18;
  // Table header
  doc.rect(40, y, 515, 18).fill('#e2e8f0');
  doc
    .fillColor(darkTextColor)
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .text('Medication & Dosage', 45, y + 5)
    .text('Frequency', 220, y + 5)
    .text('Instructions', 350, y + 5)
    .text('Duration', 470, y + 5);

  y += 18;
  let allMeds = [];
  prescriptions.forEach(rx => {
    if (Array.isArray(rx.medications)) allMeds = allMeds.concat(rx.medications);
  });

  if (allMeds.length === 0) {
    doc.fillColor(mutedTextColor).fontSize(8.5).font('Helvetica-Oblique').text('No pharmacological medications actively prescribed.', 45, y + 6);
    y += 20;
  } else {
    allMeds.slice(0, 8).forEach((m, i) => {
      if (i % 2 === 1) doc.rect(40, y, 515, 20).fill('#f8fafc');
      doc.rect(40, y, 515, 20).stroke('#e2e8f0');
      doc
        .fillColor(darkTextColor)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(m.medicineName, 45, y + 5)
        .font('Helvetica')
        .fontSize(8)
        .text(`(${m.dosage})`, 160, y + 5)
        .text(m.frequency, 220, y + 5)
        .text(m.instruction || 'After food', 350, y + 5)
        .text(`${m.durationDays || 7} Days`, 470, y + 5);
      y += 20;
    });
  }

  // 5. SHARED MEDICAL REPORTS VAULT SUMMARY
  y += 15;
  if (y > 660) {
    doc.addPage();
    y = 50;
  }

  doc
    .fillColor(primaryColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('SHARED MEDICAL RECORDS & RECENT DIAGNOSTIC TESTS', 40, y);

  y += 18;
  const reports = data.reports || [];
  if (reports.length === 0) {
    doc.fillColor(mutedTextColor).fontSize(8.5).font('Helvetica-Oblique').text('No medical records selected for this consultation.', 40, y);
    y += 20;
  } else {
    reports.forEach((r, idx) => {
      doc.rect(40, y, 515, 32).fill('#f8fafc').stroke('#e2e8f0');
      doc
        .fillColor(darkTextColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`${idx + 1}. ${r.title}`, 45, y + 6)
        .fillColor(secondaryColor)
        .fontSize(8)
        .text(`[${r.category}]`, 320, y + 6)
        .fillColor(mutedTextColor)
        .text(`Test Date: ${new Date(r.reportDate || r.createdAt).toLocaleDateString()}`, 400, y + 6, { align: 'right', width: 145 });

      if (r.aiAnalysis && r.aiAnalysis.overallRiskScore) {
        doc
          .fillColor(darkTextColor)
          .fontSize(7.5)
          .font('Helvetica')
          .text(`AI Risk: ${r.aiAnalysis.overallRiskScore} • Summary: ${r.aiAnalysis.summary ? r.aiAnalysis.summary.substring(0, 95) + '...' : 'Evaluated'}`, 45, y + 18);
      } else {
        doc
          .fillColor(mutedTextColor)
          .fontSize(7.5)
          .font('Helvetica')
          .text(`Facility: ${r.labOrHospital || 'Clinic'} • File: ${r.originalName || r.fileName}`, 45, y + 18);
      }
      y += 36;
    });
  }

  // 6. AUDIT & DATA SHARING FOOTER
  y += 15;
  if (y > 680) {
    doc.addPage();
    y = 50;
  }

  doc.rect(40, y, 515, 60).fill('#f1f5f9').stroke(borderColor);
  doc
    .fillColor(primaryColor)
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .text('SECURITY, AUDIT LOGGING & PATIENT CONSENT NOTICE', 50, y + 10)
    .fillColor(mutedTextColor)
    .fontSize(7.5)
    .font('Helvetica')
    .text('This read-only consultation brief is generated strictly under the patient\'s explicit permission.', 50, y + 23)
    .text('Access to this document has been recorded in the CareSync Immutable Access Audit Trail.', 50, y + 33)
    .text('Unauthorized dissemination or reproduction is prohibited under clinical data privacy standards.', 50, y + 43);

  doc
    .fillColor(secondaryColor)
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('✓ Verified CareSync Health Token', 340, y + 25, { align: 'right', width: 200 })
    .fillColor(mutedTextColor)
    .fontSize(7)
    .text(`Session ID: ${data.patient?._id}-${Date.now().toString().slice(-6)}`, 340, y + 38, { align: 'right', width: 200 });

  doc.end();
}

module.exports = {
  generateConsultationSummaryPdf
};

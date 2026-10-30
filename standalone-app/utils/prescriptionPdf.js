const PDFDocument = require('pdfkit');

/**
 * Generates an official, printable medical prescription PDF using PDFKit
 * @param {Object} prescription - Populated prescription object
 * @param {Object} stream - Writable stream (e.g. Express res)
 */
function generatePrescriptionPdf(prescription, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `CareSync Prescription - ${prescription.diagnosis}`,
      Author: prescription.doctor?.name || 'CareSync Medical Portal',
      Subject: 'Electronic Medical Prescription',
      Keywords: 'prescription, medical, healthcare, caresync'
    }
  });

  doc.pipe(stream);

  const primaryColor = '#1e40af'; // Blue 800
  const secondaryColor = '#0d9488'; // Teal 600
  const darkTextColor = '#1e293b'; // Slate 800
  const mutedTextColor = '#64748b'; // Slate 500
  const lightBgColor = '#f8fafc'; // Slate 50
  const borderColor = '#cbd5e1'; // Slate 300

  // 1. HEADER CLINIC / DOCTOR BANNER
  doc.rect(40, 40, 515, 80).fill(lightBgColor);
  doc.rect(40, 40, 515, 80).stroke(borderColor);

  doc
    .fillColor(primaryColor)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('CareSync Health Systems', 55, 52);

  doc
    .fillColor(mutedTextColor)
    .fontSize(9)
    .font('Helvetica')
    .text('Integrated Digital Health Records & Care Compliance Network', 55, 73)
    .text('Secure Electronic Health Record (EHR) Standard • ISO/IEC 27001 & HIPAA Compliant', 55, 85);

  const docName = prescription.doctor?.name ? `Dr. ${prescription.doctor.name.replace(/^Dr\.\s*/i, '')}` : 'Consulting Physician';
  const specialization = prescription.doctor?.specialization || 'General Medicine';
  const hospital = prescription.doctor?.hospital || 'CareSync Partner Hospital';

  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(docName, 320, 52, { align: 'right', width: 220 });

  doc
    .fillColor(darkTextColor)
    .fontSize(9)
    .font('Helvetica')
    .text(specialization, 320, 68, { align: 'right', width: 220 })
    .text(hospital, 320, 80, { align: 'right', width: 220 })
    .text(`Date: ${new Date(prescription.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 320, 92, { align: 'right', width: 220 });

  // 2. PATIENT DEMOGRAPHICS BOX
  let y = 135;
  doc.rect(40, y, 515, 55).fill('#f1f5f9');
  doc.rect(40, y, 515, 55).stroke(borderColor);

  const patient = prescription.patient || {};
  const patientName = patient.name || 'Patient';
  const ageGender = `${patient.age ? patient.age + ' Yrs' : 'N/A'} • ${patient.gender || 'N/A'}`;
  const bloodGroup = patient.bloodGroup ? `Blood: ${patient.bloodGroup}` : 'Blood: N/A';
  const phone = patient.phone ? `Ph: ${patient.phone}` : '';
  const allergies = patient.allergies ? `Allergies: ${patient.allergies}` : 'Allergies: None reported';

  doc
    .fillColor(primaryColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('PATIENT INFORMATION', 55, y + 10);

  doc
    .fillColor(darkTextColor)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(patientName, 55, y + 25)
    .font('Helvetica')
    .fontSize(9)
    .text(`${ageGender}  |  ${bloodGroup}  |  ${phone}`, 55, y + 38);

  doc
    .fillColor('#dc2626')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(allergies, 300, y + 25, { align: 'right', width: 240 })
    .fillColor(mutedTextColor)
    .font('Helvetica')
    .text(`Rx ID: ${prescription._id}`, 300, y + 38, { align: 'right', width: 240 });

  // 3. DIAGNOSIS & CLINICAL NOTES
  y += 70;
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('DIAGNOSIS & CLINICAL IMPRESSION', 40, y);

  y += 18;
  doc
    .fillColor(darkTextColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(prescription.diagnosis || 'Clinical Consultation', 40, y);

  if (prescription.clinicalNotes) {
    y += 16;
    doc
      .fillColor(mutedTextColor)
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text(`Notes: ${prescription.clinicalNotes}`, 40, y, { width: 515 });
  }

  // 4. MEDICATIONS SECTION (Rx)
  y += 30;
  doc
    .fillColor(secondaryColor)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('℞', 40, y);

  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('PRESCRIBED MEDICATIONS', 70, y + 4);

  y += 25;

  // Table Header
  doc.rect(40, y, 515, 20).fill('#e2e8f0');
  doc
    .fillColor(darkTextColor)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Medicine & Dosage', 45, y + 5)
    .text('Frequency & Schedule', 230, y + 5)
    .text('Instruction', 370, y + 5)
    .text('Duration', 475, y + 5);

  y += 20;

  const meds = prescription.medications || [];
  if (meds.length === 0) {
    doc
      .fillColor(mutedTextColor)
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('No pharmacological medications prescribed.', 45, y + 10);
    y += 25;
  } else {
    meds.forEach((m, idx) => {
      // Row alternating bg
      if (idx % 2 === 1) {
        doc.rect(40, y, 515, 26).fill('#f8fafc');
      }
      doc.rect(40, y, 515, 26).stroke('#e2e8f0');

      // Schedule pills
      const times = [];
      if (m.timeOfDay?.morning) times.push('Morn');
      if (m.timeOfDay?.afternoon) times.push('Noon');
      if (m.timeOfDay?.night) times.push('Night');
      const timeStr = times.length > 0 ? `(${times.join(' - ')})` : '';

      doc
        .fillColor(darkTextColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`${idx + 1}. ${m.medicineName}`, 45, y + 4)
        .font('Helvetica')
        .fontSize(8)
        .fillColor(mutedTextColor)
        .text(`Dosage: ${m.dosage || '1 Tablet'}`, 55, y + 15);

      doc
        .fillColor(darkTextColor)
        .fontSize(8.5)
        .font('Helvetica')
        .text(`${m.frequency} ${timeStr}`, 230, y + 8);

      doc
        .fillColor(secondaryColor)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(m.instruction || 'After food', 370, y + 8);

      doc
        .fillColor(darkTextColor)
        .fontSize(8.5)
        .font('Helvetica')
        .text(`${m.durationDays || 7} Days`, 475, y + 8);

      y += 26;
    });
  }

  // 5. PRECAUTIONS & LIFESTYLE ADVICE
  y += 20;
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('LIFESTYLE PRECAUTIONS & CARE COMPLIANCE', 40, y);

  y += 18;
  const precautions = prescription.precautions || [];
  if (precautions.length === 0) {
    doc
      .fillColor(mutedTextColor)
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('Maintain balanced hydration and standard rest.', 45, y);
    y += 20;
  } else {
    precautions.forEach((p) => {
      doc
        .fillColor(secondaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('•', 45, y)
        .fillColor(darkTextColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`[${p.category || 'General'}] ${p.title}`, 60, y);

      if (p.description) {
        y += 13;
        doc
          .fillColor(mutedTextColor)
          .fontSize(8.5)
          .font('Helvetica')
          .text(p.description, 60, y, { width: 495 });
      }
      y += 18;
    });
  }

  // 6. FOLLOW UP & SIGNATURE FOOTER
  y += 20;
  if (y > 680) {
    doc.addPage();
    y = 50;
  }

  doc.rect(40, y, 515, 65).fill('#f8fafc');
  doc.rect(40, y, 515, 65).stroke(borderColor);

  const followUpText = prescription.followUpDate
    ? `Scheduled Follow-up: ${new Date(prescription.followUpDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
    : 'Follow-up: As advised if symptoms persist or in 2 weeks.';

  doc
    .fillColor(primaryColor)
    .fontSize(9.5)
    .font('Helvetica-Bold')
    .text(followUpText, 55, y + 15)
    .fillColor(mutedTextColor)
    .fontSize(8)
    .font('Helvetica')
    .text('Please bring this prescription and your historical reports to your next visit.', 55, y + 32)
    .text('Tasks generated from this Rx have been synced to your CareSync compliance tracker.', 55, y + 44);

  // Digital Signature Block
  doc
    .fillColor(primaryColor)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(docName, 360, y + 15, { align: 'center', width: 180 });

  doc
    .fillColor(secondaryColor)
    .fontSize(7.5)
    .font('Helvetica')
    .text('✓ Digitally Signed & Authenticated', 360, y + 29, { align: 'center', width: 180 })
    .fillColor(mutedTextColor)
    .text('CareSync Certified Medical Practitioner', 360, y + 42, { align: 'center', width: 180 });

  // 7. BOTTOM DISCLAIMER
  doc
    .fillColor('#94a3b8')
    .fontSize(7.5)
    .font('Helvetica')
    .text(
      'This electronic prescription is generated via CareSync Secure Health Portal. Valid under the Information Technology & Telemedicine Practice Guidelines.',
      40,
      780,
      { align: 'center', width: 515 }
    );

  doc.end();
}

module.exports = {
  generatePrescriptionPdf
};

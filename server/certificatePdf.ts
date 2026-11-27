import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export interface CertificatePdfPayload {
  studentName: string;
  courseTitle: string;
  issuedDate: string;
  verificationCode: string;
  directorName?: string;
  academyName?: string;
  parentAgencyName?: string;
  agencyLogoUrl?: string | null;
}

function formatFrenchDate(rawDate: string): string {
  const trimmed = String(rawDate || '').trim();
  if (!trimmed) return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T12:00:00Z`) : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function resolveSafeLogoBuffer(agencyLogoUrl?: string | null): Buffer | null {
  const raw = String(agencyLogoUrl || '').trim();
  if (raw.startsWith('data:image/')) {
    const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/i.exec(raw);
    if (match && match[2].length <= 2_500_000) {
      try {
        return Buffer.from(match[2], 'base64');
      } catch {
        // fallback to local logo asset below
      }
    }
  }

  const candidatePaths = [
    path.resolve(ROOT_DIR, 'public', 'pwa-512x512.png'),
    path.resolve(ROOT_DIR, 'public', 'pwa-192x192.png'),
    path.resolve(ROOT_DIR, 'public', 'apple-touch-icon.png')
  ];

  for (const candidate of candidatePaths) {
    if (!candidate.startsWith(ROOT_DIR + path.sep)) continue;
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    } catch {
      // ignore read failure and try next candidate
    }
  }

  return null;
}

export function generateCertificatePdfBuffer(payload: CertificatePdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const academyName = (payload.academyName || 'DJIFFA ACADEMY').trim();
    const parentAgencyName = (payload.parentAgencyName || 'DJIFFA DESIGN AGENCY').trim();
    const directorName = (payload.directorName || 'Faith Ariola').trim();
    const studentName = (payload.studentName || 'Apprenant DJIFFA ACADEMY').trim();
    const courseTitle = (payload.courseTitle || 'Formation DJIFFA ACADEMY').trim();
    const verificationCode = (payload.verificationCode || 'DJF-CERT-VALID').trim();
    const formattedDate = formatFrenchDate(payload.issuedDate);

    // A4 Landscape: 841.89 x 595.28 points
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `Certificat ${academyName} - ${studentName}`,
        Author: `${academyName} (${directorName})`,
        Subject: `Certificat d'Accomplissement - ${courseTitle}`,
        Keywords: `DJIFFA ACADEMY, Certificat, ${verificationCode}`
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width; // 841.89
    const H = doc.page.height; // 595.28
    const centerX = W / 2;

    const DARK_BG = '#08080A';
    const PANEL_BG = '#121216';
    const GOLD = '#D4AF37';
    const GOLD_LIGHT = '#F3E5AB';
    const GOLD_DARK = '#8C701E';
    const WHITE = '#F8FAFC';
    const MUTED = '#A1A1AA';
    const SUBTLE_LINE = '#27272A';

    // 1. Deep Obsidian Background
    doc.rect(0, 0, W, H).fill(DARK_BG);

    // Subtle luxury radial-like corner glow rectangles
    doc.save();
    doc.opacity(0.06);
    doc.circle(centerX, 170, 260).fill(GOLD);
    doc.restore();

    // 2. Double Luxury Gold Border Frame
    doc.lineWidth(2.2).strokeColor(GOLD).rect(22, 22, W - 44, H - 44).stroke();
    doc.lineWidth(0.8).strokeColor(GOLD_DARK).rect(30, 30, W - 60, H - 60).stroke();
    doc.lineWidth(0.5).strokeColor(SUBTLE_LINE).rect(38, 38, W - 76, H - 76).stroke();

    // Corner gold ornaments
    const corners: Array<[number, number, number, number]> = [
      [22, 22, 1, 1],
      [W - 22, 22, -1, 1],
      [22, H - 22, 1, -1],
      [W - 22, H - 22, -1, -1]
    ];
    for (const [cx, cy, dx, dy] of corners) {
      doc.save();
      doc.lineWidth(2).strokeColor(GOLD_LIGHT);
      doc
        .moveTo(cx + dx * 6, cy + dy * 24)
        .lineTo(cx + dx * 6, cy + dy * 6)
        .lineTo(cx + dx * 24, cy + dy * 6)
        .stroke();
      doc.restore();
    }

    // 3. Official DJIFFA ACADEMY Logo
    const logoBuffer = resolveSafeLogoBuffer(payload.agencyLogoUrl);
    if (logoBuffer) {
      try {
        doc.save();
        doc.roundedRect(centerX - 27, 48, 54, 54, 10).fill(PANEL_BG);
        doc.lineWidth(1.2).strokeColor(GOLD).roundedRect(centerX - 27, 48, 54, 54, 10).stroke();
        doc.image(logoBuffer, centerX - 23, 52, { fit: [46, 46], align: 'center', valign: 'center' });
        doc.restore();
      } catch {
        // fallback vector monogram
        doc.save();
        doc.roundedRect(centerX - 27, 48, 54, 54, 10).fill(PANEL_BG);
        doc.lineWidth(1.2).strokeColor(GOLD).roundedRect(centerX - 27, 48, 54, 54, 10).stroke();
        doc.font('Times-Bold').fontSize(28).fillColor(GOLD).text('D', centerX - 27, 60, { width: 54, align: 'center' });
        doc.restore();
      }
    } else {
      doc.save();
      doc.roundedRect(centerX - 27, 48, 54, 54, 10).fill(PANEL_BG);
      doc.lineWidth(1.2).strokeColor(GOLD).roundedRect(centerX - 27, 48, 54, 54, 10).stroke();
      doc.font('Times-Bold').fontSize(28).fillColor(GOLD).text('D', centerX - 27, 60, { width: 54, align: 'center' });
      doc.restore();
    }

    // 4. Header Titles
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(GOLD)
      .text(`${parentAgencyName.toUpperCase()}  ·  ${academyName.toUpperCase()}`, 60, 112, {
        width: W - 120,
        align: 'center',
        characterSpacing: 2.2
      });

    doc
      .font('Times-Bold')
      .fontSize(31)
      .fillColor(GOLD_LIGHT)
      .text('CERTIFICAT D’ACCOMPLISSEMENT', 60, 134, {
        width: W - 120,
        align: 'center',
        characterSpacing: 1.5
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Délivré officiellement par ${academyName} en reconnaissance de l’excellence pratique`, 80, 174, {
        width: W - 160,
        align: 'center',
        characterSpacing: 1.1
      });

    // Gold decorative divider under title
    doc.lineWidth(0.8).strokeColor(GOLD_DARK).moveTo(centerX - 110, 194).lineTo(centerX + 110, 194).stroke();

    // 5. Recipient Name & Course Section
    doc
      .font('Times-Italic')
      .fontSize(12.5)
      .fillColor(MUTED)
      .text('Ce certificat officiel atteste que', 80, 210, {
        width: W - 160,
        align: 'center'
      });

    const studentFontSize = studentName.length > 34 ? 23 : studentName.length > 24 ? 26 : 30;
    doc
      .font('Times-Bold')
      .fontSize(studentFontSize)
      .fillColor(WHITE)
      .text(studentName, 80, 232, {
        width: W - 160,
        align: 'center',
        lineBreak: false
      });

    // Underline below student name
    const nameUnderlineHalf = Math.min(240, Math.max(125, studentName.length * 6.8));
    doc
      .lineWidth(1)
      .strokeColor(GOLD)
      .moveTo(centerX - nameUnderlineHalf, 272)
      .lineTo(centerX + nameUnderlineHalf, 272)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#D4D4D8')
      .text(
        'a suivi avec succès l’intégralité des modules pédagogiques, travaux pratiques et évaluations certifiantes du programme :',
        110,
        286,
        {
          width: W - 220,
          align: 'center'
        }
      );

    // Course Title Badge
    const courseBoxW = 580;
    const courseBoxX = centerX - courseBoxW / 2;
    const courseBoxY = 324;
    const courseBoxH = 54;

    doc.save();
    doc.roundedRect(courseBoxX, courseBoxY, courseBoxW, courseBoxH, 8).fill(PANEL_BG);
    doc.lineWidth(1).strokeColor(GOLD_DARK).roundedRect(courseBoxX, courseBoxY, courseBoxW, courseBoxH, 8).stroke();
    doc.restore();

    const courseFontSize = courseTitle.length > 68 ? 12.5 : courseTitle.length > 48 ? 14.5 : 16.5;
    doc
      .font('Times-Bold')
      .fontSize(courseFontSize)
      .fillColor(GOLD)
      .text(`« ${courseTitle} »`, courseBoxX + 18, courseBoxY + (courseTitle.length > 52 ? 12 : 17), {
        width: courseBoxW - 36,
        align: 'center'
      });

    // 6. Footer Separator
    const footerTopY = 406;
    doc.lineWidth(0.7).strokeColor(SUBTLE_LINE).moveTo(72, footerTopY).lineTo(W - 72, footerTopY).stroke();

    // Left Column: Issue Date & Verification Code
    const leftX = 74;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('DATE DE DÉLIVRANCE', leftX, 424, { characterSpacing: 1.1 });

    doc
      .font('Helvetica-Bold')
      .fontSize(11.5)
      .fillColor(WHITE)
      .text(formattedDate, leftX, 438);

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('NUMÉRO UNIQUE DE VÉRIFICATION', leftX, 468, { characterSpacing: 1.1 });

    doc
      .font('Courier-Bold')
      .fontSize(11)
      .fillColor(GOLD)
      .text(verificationCode, leftX, 483);

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#71717A')
      .text('Document officiel enregistré sur DJIFFA ACADEMY', leftX, 505);

    // Center Column: Official Gold Seal
    const sealX = centerX;
    const sealY = 472;
    doc.save();
    doc.circle(sealX, sealY, 44).fill(GOLD_DARK);
    doc.circle(sealX, sealY, 41).fill(GOLD);
    doc.circle(sealX, sealY, 35).lineWidth(1.2).dash(3, { space: 2 }).strokeColor(DARK_BG).stroke();
    doc.undash();
    doc.circle(sealX, sealY, 30).lineWidth(0.8).strokeColor(DARK_BG).stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(DARK_BG)
      .text('SCEAU OFFICIEL', sealX - 34, sealY - 19, { width: 68, align: 'center', characterSpacing: 0.7 });

    doc
      .font('Times-Bold')
      .fontSize(15)
      .fillColor(DARK_BG)
      .text('DA', sealX - 24, sealY - 7, { width: 48, align: 'center' });

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor(DARK_BG)
      .text('DJIFFA ACADEMY', sealX - 34, sealY + 12, { width: 68, align: 'center', characterSpacing: 0.5 });
    doc.restore();

    // Right Column: Faith Ariola Signature & Title
    const rightX = W - 294;
    const rightW = 220;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('DIRECTION GÉNÉRALE', rightX, 424, { width: rightW, align: 'right', characterSpacing: 1.1 });

    // Calligraphic signature curve for Faith Ariola
    doc.save();
    const sigBaseX = W - 210;
    const sigBaseY = 466;
    doc
      .lineWidth(1.7)
      .strokeColor(GOLD_LIGHT)
      .moveTo(sigBaseX, sigBaseY)
      .bezierCurveTo(sigBaseX + 14, sigBaseY - 24, sigBaseX + 34, sigBaseY - 22, sigBaseX + 32, sigBaseY + 2)
      .bezierCurveTo(sigBaseX + 46, sigBaseY - 12, sigBaseX + 64, sigBaseY - 10, sigBaseX + 68, sigBaseY + 1)
      .bezierCurveTo(sigBaseX + 78, sigBaseY - 16, sigBaseX + 94, sigBaseY - 10, sigBaseX + 102, sigBaseY)
      .bezierCurveTo(sigBaseX + 114, sigBaseY + 4, sigBaseX + 126, sigBaseY - 8, sigBaseX + 138, sigBaseY - 4)
      .stroke();
    // Signature flourish underline
    doc
      .lineWidth(0.9)
      .strokeColor(GOLD)
      .moveTo(sigBaseX - 6, sigBaseY + 9)
      .bezierCurveTo(sigBaseX + 45, sigBaseY + 12, sigBaseX + 95, sigBaseY + 6, sigBaseX + 140, sigBaseY + 8)
      .stroke();
    doc.restore();

    doc
      .font('Times-BoldItalic')
      .fontSize(14)
      .fillColor(GOLD_LIGHT)
      .text(directorName, rightX, 480, { width: rightW, align: 'right' });

    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(WHITE)
      .text('Directrice & Fondatrice', rightX, 498, { width: rightW, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(parentAgencyName, rightX, 512, { width: rightW, align: 'right' });

    doc.end();
  });
}

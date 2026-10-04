const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(local, nameBytes, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((n, c) => n + c.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: DOCX_TYPE });
}

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const plain = (s) => String(s).replace(/\s*[—―]\s*/g, ", ").replace(/\s*–\s*/g, " - ");
const esc = (s) => plain(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function para(text, { size = 21, bold = false, before = 0, after = 60, indent = false, rule = false } = {}) {
  const pPr = [
    `<w:spacing w:before="${before}" w:after="${after}"/>`,
    indent ? '<w:ind w:left="360" w:hanging="220"/>' : "",
    rule ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="111111"/></w:pBdr>' : "",
  ].join("");
  const rPr = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/>`;
  return `<w:p><w:pPr>${pPr}</w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value) {
  if (!value || value === "present") return value ? "Present" : "";
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : value;
}

const span = (a, b) => (a || b ? [formatDate(a), formatDate(b || "present")].filter(Boolean).join(" - ") : "");

export function resumeDocx(resume) {
  const c = resume.contact || {};
  const heading = (t) => para(t.toUpperCase(), { size: 22, bold: true, before: 240, after: 80, rule: true });
  const body = [
    para(c.name || "", { size: 36, bold: true, after: 40 }),
    para([c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio].filter(Boolean).join("  ·  "), { size: 19 }),
  ];
  if (resume.summary) body.push(heading("Summary"), para(resume.summary));
  if (resume.experience.length) {
    body.push(heading("Experience"));
    for (const r of resume.experience) {
      body.push(para([r.title, r.company].filter(Boolean).join(", "), { bold: true, before: 120, after: 0 }));
      body.push(para([r.location, span(r.startDate, r.endDate)].filter(Boolean).join("  ·  "), { size: 19, after: 60 }));
      for (const b of r.bullets) body.push(para(`•  ${b}`, { indent: true, after: 40 }));
    }
  }
  if (resume.education.length) {
    body.push(heading("Education"));
    for (const e of resume.education) {
      body.push(para([e.degree, e.field].filter(Boolean).join(", ") || e.school, { bold: true, before: 80, after: 0 }));
      body.push(para([e.school, span(e.startDate, e.endDate)].filter(Boolean).join("  ·  "), { size: 19 }));
    }
  }
  if (resume.skills.length) body.push(heading("Skills"), para(resume.skills.join(", ")));
  if (resume.certifications.length) body.push(heading("Certifications"), ...resume.certifications.map((x) => para(`•  ${x}`, { indent: true, after: 40 })));

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return zip([
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ],
    [
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="864" w:right="1008" w:bottom="864" w:left="1008" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    ],
  ]);
}
